import type { DomainEvents, EntityId, EventBus, RenderPort, AudioPort } from "@seki/core";
import type { DialogueView, NarrativeRuntime } from "@seki/narrative";
import { SIM_HZ } from "@seki/sim";
import { type DialogueIntents, type UiStore, patchUi } from "@seki/ui";
import type { Focus, SimRef } from "./shared";

/** Mouth movement per character of a spoken line, seconds. */
const TALK_SECONDS_PER_CHAR = 0.05;

const toDialogueVm = (v: DialogueView) => ({ lines: v.lines, choices: v.choices, ended: v.ended });

export interface DialogueControllerDeps {
  readonly bus: EventBus<DomainEvents>;
  readonly narrative: NarrativeRuntime;
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly render: RenderPort;
  readonly audio: AudioPort;
  readonly focus: Focus;
}

/** The conversation on screen: ink lines and choices, and the partner's mouth while it talks. */
export class DialogueController implements DialogueIntents {
  private dialogueOpen = false;
  /** Who the player is talking to (from InteractionStarted), for the mouth movement. */
  private talkTarget: EntityId | null = null;

  constructor(private readonly deps: DialogueControllerDeps) {
    // Subscribed before the event presenter, which opens the conversation on the same event.
    deps.bus.on("InteractionStarted", (e) => {
      if (e.kind === "dialogue" || e.kind === "shop") this.talkTarget = e.targetId;
    });
    // A street encounter (ADR-0032) talks through its NPC the same way.
    deps.bus.on("EncounterStarted", (e) => {
      if (!this.dialogueOpen) this.talkTarget = e.npcId;
    });
  }

  get isOpen(): boolean {
    return this.dialogueOpen;
  }

  open(dialogueId: string): void {
    const sim = this.deps.sim();
    this.dialogueOpen = true;
    const view = this.deps.narrative.start(dialogueId, sim.domain, { tick: sim.tick, ticksPerSecond: SIM_HZ });
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.speak(view)), prompt: null });
    this.deps.focus.panel();
  }

  choose(index: number): void {
    if (!this.dialogueOpen) return;
    this.deps.audio.play("ui-select");
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.speak(this.deps.narrative.choose(index))) });
  }

  /** Closes the panel without telling the simulation (a load, the title screen, an interruption). */
  closeSilently(): void {
    if (this.talkTarget !== null) this.deps.render.playEffect({ kind: "talk", entityId: this.talkTarget, seconds: 0 });
    this.talkTarget = null;
    this.dialogueOpen = false;
    patchUi(this.deps.ui, { dialogue: null });
  }

  closeDialogue(): void {
    if (!this.dialogueOpen) return;
    this.closeSilently();
    this.deps.sim().enqueue({ type: "end-dialogue" });
    this.deps.focus.settle();
  }

  /** Violence cut the talk short: ink drops the half-finished knot so it can start over. */
  interrupt(): void {
    if (this.dialogueOpen) this.deps.narrative.interrupt();
  }

  /**
   * The conversation partner's mouth moves while its new lines are on screen: about one
   * reading speed (a twentieth of a second per character), narration excluded.
   */
  private speak(view: DialogueView): DialogueView {
    const target = this.talkTarget;
    if (target !== null) {
      const alias = this.deps.sim().domain.character.alias;
      const chars = view.lines.filter((l) => l.speaker !== null && l.speaker !== alias).reduce((n, l) => n + l.text.length, 0);
      this.deps.render.playEffect({ kind: "talk", entityId: target, seconds: chars === 0 ? 0 : Math.min(6, Math.max(0.6, chars * TALK_SECONDS_PER_CHAR)) });
    }
    return view;
  }
}
