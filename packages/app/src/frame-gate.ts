/** What of the session decides whether a held loop still has to run (the loading screen, the menu's preview). */
export interface FrameGateSession {
  readonly screen: string;
  readonly preparing: boolean;
  readonly characterScreenOpen: boolean;
}

/**
 * Frames on demand for a frozen test (G-226, ADR-0046). Under SwiftShader a frame of Lublin
 * takes seconds, and every `page.evaluate` (a teleport, a step, F5) waited behind the frame the
 * loop was drawing from the old spot. Held, the loop draws nothing by itself: a test asks for
 * `n` frames and waits for `frames()` to reach the count `request` returns. The loading screen
 * and the character menu's preview run as always, since their frames are the work itself.
 * Off by default: the game outside tests draws every frame.
 */
export class FrameGate {
  private held = false;
  private owed = 0;
  private count = 0;

  /** Frames drawn so far (the debug `frames()`). */
  get drawn(): number {
    return this.count;
  }

  get holding(): boolean {
    return this.held;
  }

  /** Holds the loop (frames on demand) or lets it draw every frame again, which forgets the frames owed. */
  hold(on: boolean): void {
    this.held = on;
    if (!on) this.owed = 0;
  }

  /** Asks for `n` more drawn frames; returns the `drawn` count to wait for. */
  request(n: number): number {
    this.owed += Math.max(0, Math.floor(n));
    return this.count + this.owed;
  }

  /** Whether the loop runs this animation frame: always unless held with nothing owed in plain play. */
  runs(session: FrameGateSession): boolean {
    if (!this.held || this.owed > 0) return true;
    return session.screen !== "playing" || session.preparing || session.characterScreenOpen;
  }

  /** A frame of the game was drawn (the pacer may skip one, which then stays owed). */
  frameDrawn(): void {
    this.count++;
    if (this.owed > 0) this.owed--;
  }
}
