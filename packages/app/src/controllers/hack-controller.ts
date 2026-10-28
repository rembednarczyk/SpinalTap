import type { AudioPort, BreachDaemonId, InputFrame, QuickhackSlotInput } from "@seki/core";
import { type HackIntents, type UiStore, patchUi } from "@seki/ui";
import type { Focus, SimRef } from "./shared";

/** Daemons of a terminal when nobody says otherwise. */
const DEFAULT_DAEMONS: readonly BreachDaemonId[] = ["icepick", "datamine", "mass_vulnerability"];

export interface HackControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly audio: AudioPort;
  readonly focus: Focus;
  readonly inControl: () => boolean;
}

/** Scanner, the touch scanner and the breach minigame (ADR-0028). */
export class HackController implements HackIntents {
  /** Terminal of the breach minigame on screen, or null. */
  private breachKey: string | null = null;
  /** Touch: the scanner button is on, and a hack tapped in its list waits for the next step. */
  private touchScan = false;
  private touchHack: QuickhackSlotInput = 0;

  constructor(private readonly deps: HackControllerDeps) {}

  get breachOpen(): boolean {
    return this.breachKey !== null;
  }

  /** The scanner is held: the key in this frame or the touch button. */
  scanning(input: InputFrame): boolean {
    return input.scan || this.touchScan;
  }

  /**
   * The touch scanner: the HUD button and a tap on the hack list go into the input frame here,
   * as the keyboard's Z and number keys do. The virtual pad can take this over.
   */
  withTouchScan(input: InputFrame): InputFrame {
    const hack = this.touchHack;
    this.touchHack = 0;
    if (!this.touchScan && hack === 0) return input;
    const scan = input.scan || this.touchScan;
    return { ...input, scan, quickhack: input.quickhack || (scan ? hack : 0) };
  }

  setScan(on: boolean): void {
    this.touchScan = on;
    if (!on) this.touchHack = 0;
  }

  pickQuickhack(slot: Exclude<QuickhackSlotInput, 0>): void {
    if (this.touchScan) this.touchHack = slot;
  }

  /**
   * Shows the breach minigame for a terminal (debug API for now; the terminals of the
   * simulation will open it). The player stands still while it is on screen.
   */
  openBreach(terminalKey: string, daemons: readonly BreachDaemonId[] = DEFAULT_DAEMONS): void {
    if (!this.deps.inControl() && this.breachKey === null) return;
    this.breachKey = terminalKey;
    patchUi(this.deps.ui, { breach: { terminalKey, daemons: daemons.slice(0, 3) }, prompt: null });
    this.deps.focus.panel();
  }

  /** The minigame ended: the simulation applies what was won (`breach-result`). */
  submitBreach(daemons: readonly BreachDaemonId[]): void {
    const terminalKey = this.breachKey;
    if (terminalKey === null) return;
    this.breachKey = null;
    patchUi(this.deps.ui, { breach: null });
    this.deps.sim().enqueue({ type: "breach-result", terminalKey, daemons: [...daemons] });
    this.deps.audio.play(daemons.length > 0 ? "quest-update" : "denied");
    this.deps.focus.settle();
  }

  /** A breach cut short sends nothing: the terminal stays as it was. */
  closeSilently(): void {
    this.breachKey = null;
    patchUi(this.deps.ui, { breach: null });
  }

  /** A new game or a load: the touch scanner is off. */
  reset(): void {
    this.touchScan = false;
    this.touchHack = 0;
  }
}
