import { Compiler, type Story } from "inkjs/full";
import {
  type DomainState,
  type GameCommand,
  CONTRACT_SITES,
  QUEST_DEFINITIONS,
  currentStep,
  hasFlag,
  isFactionId,
  isMemoryId,
} from "@seki/core";
import type { DialogueLine, DialogueView } from "./dialogue-view";

const SPEAKERS: Readonly<Record<string, string>> = { KAITO: "Kaito", UME: "Babcia Ume" };
const SPEAKER_RE = /^([A-Z]+):\s*(.*)$/;

export class InkCompileError extends Error {}

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
const activeMainStep = (domain: DomainState): string => {
  for (const q of QUEST_DEFINITIONS) {
    const step = currentStep(domain.quests, q);
    if (q.main && step) return step.id;
  }
  return "";
};

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

  constructor(
    source: string,
    private readonly emit: (command: GameCommand) => void,
  ) {
    this.story = compileInk(source);
    this.bindExternals();
  }

  start(dialogueId: string, domain: DomainState): DialogueView {
    this.domain = domain;
    this.dialogueId = dialogueId;
    this.pendingFlags = new Set();
    this.story.variablesState.$("quest_step", activeMainStep(domain));
    this.story.variablesState.$("alias", domain.character.alias ?? "");
    const contract = domain.contracts.active;
    this.story.variablesState.$("contract_state", contract?.status ?? "");
    this.story.variablesState.$("contract_site", contract ? CONTRACT_SITES[contract.siteId].label : "");
    this.story.variablesState.$("contracts_done", domain.contracts.completed);
    this.story.ChoosePathString(dialogueId);
    return this.continue();
  }

  choose(index: number): DialogueView {
    this.story.ChooseChoiceIndex(index);
    return this.continue();
  }

  /** ink state (visit counts, variables) as JSON, for the save snapshot. */
  saveState(): string {
    return this.story.state.toJson();
  }

  loadState(json: string): void {
    this.story.state.LoadJson(json);
  }

  resetState(): void {
    this.story.ResetState();
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
    this.story.BindExternalFunction("unlock_memory", (id: string) => {
      if (!isMemoryId(id)) throw new Error(`ink: unknown memory "${id}"`);
      this.emit({ type: "unlock-memory", memoryId: id });
    });
  }
}
