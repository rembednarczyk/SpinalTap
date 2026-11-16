import { type AudioPort, textRef } from "@seki/core";
import { type Screen, type UiStore, type WaitIntents, patchUi } from "@seki/ui";
import { type WaitFacts, waitBlock } from "../presenters/wait";
import { type Focus, type SimRef, pushToastTimed } from "./shared";

export interface WaitControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly audio: AudioPort;
  readonly focus: Focus;
  readonly screen: () => Screen;
  readonly setScreen: (screen: Screen) => void;
  /** Playing with no other panel or menu up (from the pause menu it opens anyway). */
  readonly canOpen: () => boolean;
  readonly facts: () => WaitFacts;
  /** The HUD after the jump: the clock, the day and the light. */
  readonly syncHud: () => void;
}

/** The window's range of whole hours. */
const MAX_HOURS = 24;
const MINUTES_PER_HOUR = 60;

/**
 * Waiting: the window that lets game hours pass in one jump, through the `wait` command
 * (ADR-0017). It opens from the pause menu or by its key, the clock standing while it is up; in
 * a fight, an alarm, a pursuit or a takedown it stays shut and says why.
 */
export class WaitController implements WaitIntents {
  private open = false;

  constructor(private readonly deps: WaitControllerDeps) {}

  get isOpen(): boolean {
    return this.open;
  }

  openWait(): void {
    const { ui, screen } = this.deps;
    const paused = screen() === "paused";
    if (this.open || (!paused && !this.deps.canOpen())) return;
    const blocked = this.sync();
    if (blocked) {
      pushToastTimed(ui, "system", textRef("wait.blockedTitle"), textRef(`wait.blocked.${blocked}`));
      return;
    }
    this.open = true;
    patchUi(ui, { wait: { clockSeconds: this.deps.sim().clock.seconds }, prompt: null });
    this.deps.audio.play("ui-select");
    // From the pause menu the window takes the menu's place over the game.
    if (paused) this.deps.setScreen("playing");
    this.deps.focus.panel();
  }

  closeWait(): void {
    if (!this.open) return;
    this.closeSilently();
    this.deps.focus.settle();
  }

  waitHours(hours: number): void {
    if (!this.open) return;
    const whole = Math.min(MAX_HOURS, Math.max(1, Math.round(hours)));
    if (!Number.isFinite(whole) || this.sync()) {
      this.closeWait();
      return;
    }
    const sim = this.deps.sim();
    sim.enqueue({ type: "wait", minutes: whole * MINUTES_PER_HOUR });
    // The clock stands while the window is up: the command phase runs now, as in the pause menu.
    sim.applyPendingCommands();
    this.closeWait();
    this.deps.syncHud();
  }

  /** The pause menu's reason, kept in the store; returns it. */
  sync(): ReturnType<typeof waitBlock> {
    const waitBlocked = waitBlock(this.deps.sim(), this.deps.facts());
    patchUi(this.deps.ui, { waitBlocked });
    return waitBlocked;
  }

  /** Closes the window without moving the pointer. */
  closeSilently(): void {
    this.open = false;
    patchUi(this.deps.ui, { wait: null });
  }
}
