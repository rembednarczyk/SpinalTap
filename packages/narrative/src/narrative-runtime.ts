import { Compiler, type Story } from "inkjs/full";
import {
  type DomainState,
  type GameCommand,
  CONTRACT_KINDS,
  CONTRACT_SITES,
  FACTION_IDS,
  QUEST_DEFINITIONS,
  STORY_CHOICES,
  type StoryChoiceId,
  activeMainStep,
  contractKind,
  contractSecondsLeft,
  isContractKind,
  dayPhase,
  hourOf,
  hasFlag,
  hasMemory,
  isFactionId,
  isMemoryId,
  isStoryChoiceId,
  isStoryOption,
  resolveEnding,
  stanceOf,
} from "@seki/core";
import type { DialogueLine, DialogueView } from "./dialogue-view";

const SPEAKERS: Readonly<Record<string, string>> = {
  KAITO: "Kaito",
  UME: "Babcia Ume",
  MORI: "Doktor Mori",
  REN: "Ren",
  TECH: "Technik Kagami",
  KUROSAWA: "Kurosawa",
  HANA: "Hana",
  OYAJI: "Oyaji",
};
const SPEAKER_RE = /^([A-Z]+):\s*(.*)$/;

export class InkCompileError extends Error {}

/** Simulation time for a conversation (narrative does not depend on sim, so the rate comes along). */
export interface ConversationClock {
  readonly tick: number;
  readonly ticksPerSecond: number;
}

export const compileInk = (source: string): Story => {
  const compiler = new Compiler(source);
  let story: Story | null = null;
  try {
    story = compiler.Compile();
  } catch {
    // inkjs throws a generic error; the useful detail is in compiler.errors.
  }
  if (!story || compiler.errors.length > 0) throw new InkCompileError(compiler.errors.join("\n") || "ink compilation failed");
  return story;
};

/** The main-quest step id the ink scripts branch on. */
const mainStepId = (domain: DomainState): string => activeMainStep(domain.quests, QUEST_DEFINITIONS)?.step.id ?? "";

/**
 * Runs ink conversations. Domain state flows in through synced ink variables and has_flag();
 * effects flow out as GameCommands, which the app queues into the simulation.
 */
export class NarrativeRuntime {
  private readonly story: Story;
  private domain: DomainState | null = null;
  private dialogueId = "";
  /** Flags raised during the current conversation, visible to has_flag() before the sim applies them. */
  private pendingFlags = new Set<string>();
  /** ink state from before the current conversation, kept until it has an effect. */
  private checkpoint: string | null = null;
  /** Commands the current conversation has sent. */
  private effects = 0;

  constructor(
    source: string,
    private readonly sink: (command: GameCommand) => void,
  ) {
    this.story = compileInk(source);
    this.bindExternals();
  }

  private emit(command: GameCommand): void {
    this.effects += 1;
    this.sink(command);
  }

  /**
   * Opens the knot `dialogueId`. `clock` (the simulation tick and rate) lets the dialogue read
   * how much time a delivery has left; without it the time reads as 0.
   */
  start(dialogueId: string, domain: DomainState, clock?: ConversationClock): DialogueView {
    this.checkpoint = this.story.state.toJson();
    this.effects = 0;
    this.domain = domain;
    this.dialogueId = dialogueId;
    this.pendingFlags = new Set();
    this.story.variablesState.$("quest_step", mainStepId(domain));
    this.story.variablesState.$("alias", domain.character.alias ?? "");
    const contract = domain.contracts.active;
    this.story.variablesState.$("contract_state", contract?.status ?? "");
    this.story.variablesState.$("contract_site", contract ? CONTRACT_SITES[contract.siteId].label : "");
    this.story.variablesState.$("contracts_done", domain.contracts.completed);
    const kind = contract ? contractKind(contract) : null;
    this.story.variablesState.$("contract_kind", kind ?? "");
    this.story.variablesState.$("contract_giver", kind ? CONTRACT_KINDS[kind].giver : "");
    this.story.variablesState.$("contract_reward", contract?.reward ?? 0);
    const left = contract && clock ? contractSecondsLeft(contract, clock.tick, clock.ticksPerSecond) : null;
    this.story.variablesState.$("contract_time_left", left ?? 0);
    for (const f of FACTION_IDS) this.story.variablesState.$(`${f}_stance`, stanceOf(domain.reputation[f]));
    // The domain owns the main-thread choices; ink sees them as plain string variables.
    for (const choice of Object.keys(STORY_CHOICES) as StoryChoiceId[]) {
      this.story.variablesState.$(`choice_${choice}`, domain.story.choices[choice] ?? "");
    }
    this.story.variablesState.$("act1_ending", resolveEnding(domain.story.choices));
    this.story.variablesState.$("story_ending", domain.story.ending ?? "");
    this.story.variablesState.$("act2_ending", domain.story.act2Ending ?? "");
    this.story.variablesState.$("game_hour", hourOf(domain.clock));
    this.story.variablesState.$("time_of_day", dayPhase(domain.clock));
    this.story.ChoosePathString(dialogueId);
    return this.continue();
  }

  choose(index: number): DialogueView {
    this.story.ChooseChoiceIndex(index);
    return this.continue();
  }

  /**
   * The conversation was cut short (ADR-0016). If it has not changed anything yet, ink goes
   * back to where it was before it started (visit counts, once-only choices), so starting it
   * again plays exactly the same. Once it has sent commands, ink keeps what it saw, matching
   * the effects the simulation has applied, so nothing is offered or paid twice. Either way
   * the flow is ended: no pending choices linger in the state or in a save.
   * Returns true when the state was rolled back.
   */
  interrupt(): boolean {
    const rollback = this.checkpoint !== null && this.effects === 0;
    if (rollback && this.checkpoint !== null) this.story.state.LoadJson(this.checkpoint);
    else this.story.state.ForceEnd();
    this.checkpoint = null;
    this.effects = 0;
    this.pendingFlags = new Set();
    this.dialogueId = "";
    return rollback;
  }

  /** True between `start` and the end of the conversation (no choices left) or `interrupt`. */
  get inConversation(): boolean {
    return this.dialogueId !== "" && this.story.currentChoices.length > 0;
  }

  /** ink state (visit counts, variables) as JSON, for the save snapshot. */
  saveState(): string {
    return this.story.state.toJson();
  }

  loadState(json: string): void {
    this.story.state.LoadJson(json);
    this.checkpoint = null;
  }

  resetState(): void {
    this.story.ResetState();
    this.checkpoint = null;
  }

  private continue(): DialogueView {
    const lines: DialogueLine[] = [];
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? "").trim();
      if (text) lines.push(this.parseLine(text));
    }
    const choices = this.story.currentChoices.map((c) => ({ index: c.index, text: c.text }));
    return { dialogueId: this.dialogueId, lines, choices, ended: choices.length === 0 };
  }

  private parseLine(text: string): DialogueLine {
    const m = SPEAKER_RE.exec(text);
    if (!m) return { speaker: null, text };
    const [, code = "", body = ""] = m;
    const speaker = code === "SEKI" ? (this.domain?.character.alias ?? "Ty") : (SPEAKERS[code] ?? code);
    return { speaker, text: body };
  }

  private bindExternals(): void {
    this.story.BindExternalFunction("set_flag", (name: string) => {
      this.pendingFlags.add(name);
      this.emit({ type: "set-flag", flag: name });
    });
    this.story.BindExternalFunction(
      "has_flag",
      (name: string) => this.pendingFlags.has(name) || (!!this.domain && hasFlag(this.domain.flags, name)),
      true,
    );
    this.story.BindExternalFunction("change_rep", (faction: string, delta: number) => {
      if (!isFactionId(faction)) throw new Error(`ink: unknown faction "${faction}"`);
      this.emit({ type: "change-reputation", faction, delta });
    });
    this.story.BindExternalFunction("set_alias", (alias: string) => {
      if (this.domain) this.domain = { ...this.domain, character: { ...this.domain.character, alias } };
      this.emit({ type: "set-alias", alias });
    });
    this.story.BindExternalFunction("accept_contract", () => this.emit({ type: "accept-contract" }));
    this.story.BindExternalFunction("complete_contract", () => this.emit({ type: "complete-contract" }));
    this.story.BindExternalFunction("offer_contract", (kind: string) => {
      if (!isContractKind(kind)) throw new Error(`ink: unknown contract kind "${kind}"`);
      this.emit({ type: "accept-contract", kind });
    });
    this.story.BindExternalFunction("deliver_contract", () => this.emit({ type: "deliver-contract" }));
    this.story.BindExternalFunction("unlock_memory", (id: string) => {
      if (!isMemoryId(id)) throw new Error(`ink: unknown memory "${id}"`);
      this.emit({ type: "unlock-memory", memoryId: id });
    });
    this.story.BindExternalFunction(
      "has_memory",
      (id: string) => {
        if (!isMemoryId(id)) throw new Error(`ink: unknown memory "${id}"`);
        return !!this.domain && hasMemory(this.domain.character, id);
      },
      true,
    );
    this.story.BindExternalFunction("story_choice", (choice: string, option: string) => {
      if (!isStoryChoiceId(choice) || !isStoryOption(choice, option)) throw new Error(`ink: unknown story choice "${choice}=${option}"`);
      this.emit({ type: "story-choice", choice, option });
    });
    this.story.BindExternalFunction("end_act", () => this.emit({ type: "resolve-ending" }));
    this.story.BindExternalFunction("end_act2", () => this.emit({ type: "resolve-ending", act: 2 }));
  }
}
