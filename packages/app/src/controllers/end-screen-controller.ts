import { END_SCREEN, endScreenDue, seenFlag } from "@seki/core";
import { type EndScreenIntents, type UiStore, patchUi } from "@seki/ui";
import { endScreenVm } from "../presenters/end-screen";
import type { Focus, SimRef } from "./shared";

export interface EndScreenControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly focus: Focus;
}

/**
 * The end screen after the main thread's epilogue (ADR-0095 stage 2). The session loop asks it
 * every step once the player is in control and calm; it opens once, after the epilogue's
 * conversation has closed, and going back to the city marks it seen (`seen:end_screen`, in the
 * save), so the game goes on as free play.
 */
export class EndScreenController implements EndScreenIntents {
  private open = false;

  constructor(private readonly deps: EndScreenControllerDeps) {}

  get isOpen(): boolean {
    return this.open;
  }

  /** Opens the screen when the epilogue has played and the screen has not been seen yet. */
  showIfDue(): void {
    const sim = this.deps.sim();
    if (this.open || sim.session.dialogueActive || !endScreenDue(sim.domain)) return;
    this.open = true;
    patchUi(this.deps.ui, { endScreen: endScreenVm(sim.domain), prompt: null });
    this.deps.focus.panel();
  }

  closeEndScreen(): void {
    if (!this.open) return;
    const sim = this.deps.sim();
    sim.enqueue({ type: "set-flag", flag: seenFlag(END_SCREEN) });
    // The command phase runs now: the screen is gone before the next step could ask again.
    sim.applyPendingCommands();
    this.open = false;
    patchUi(this.deps.ui, { endScreen: null });
    this.deps.focus.settle();
  }
}
