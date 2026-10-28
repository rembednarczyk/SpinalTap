/** Most flashes the whole frame may show within one second (WCAG 2.3.1, XAG 118; ADR-0028). */
export const MAX_FLASHES_PER_SECOND = 3;

/**
 * Counts flash onsets in a sliding one-second window, shared by every effect that brightens the
 * whole frame. An effect asks before it flashes; when the window is full it holds what is on
 * screen instead. A steady pulse (heat) reserves its own share up front. Time is the renderer's
 * own (seconds of frames drawn), never the wall clock.
 */
export class FlashLimiter {
  private readonly onsets: number[] = [];
  private now = 0;
  private reserved = 0;

  constructor(private readonly perSecond = MAX_FLASHES_PER_SECOND) {}

  advance(dt: number): void {
    this.now += Math.max(0, dt);
    while (this.onsets.length > 0 && (this.onsets[0] ?? 0) <= this.now - 1) this.onsets.shift();
  }

  /** Flashes per second a periodic effect takes for itself while it runs. */
  reserve(perSecond: number): void {
    this.reserved = Math.max(0, Math.min(this.perSecond, perSecond));
  }

  /** True (and counted) when another flash may start now. */
  tryFlash(): boolean {
    if (this.onsets.length + this.reserved >= this.perSecond) return false;
    this.onsets.push(this.now);
    return true;
  }

  /** Flashes started within the last second. */
  get recent(): number {
    return this.onsets.length;
  }
}
