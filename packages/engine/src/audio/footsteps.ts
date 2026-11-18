/** Below this horizontal speed (m/s) the heroine is standing, not walking. */
export const STEP_MIN_SPEED = 0.6;

/** Seconds between footsteps: ~0.5 s walking (4.2 m/s), ~0.3 s sprinting. */
export const stepInterval = (speed: number): number => Math.min(0.7, Math.max(0.26, 2.1 / Math.max(speed, 1e-3)));

/**
 * Turns speed over time into footstep events. The first step lands soon after starting to
 * move, not a full interval later, and stopping resets the gait.
 */
/**
 * The shortest gap between two footsteps heard (s): a dash or a sprint brings the feet down
 * faster than a step's sound lasts, and the extra ones are dropped, not queued (user notes of 18.11).
 */
export const MIN_STEP_GAP = 0.2;

/** Walking this long (s) with no footfall from the picture, the footsteps keep their own clock again. */
const LOST_FIGURE = 1.2;

export class FootstepClock {
  private phase = 0.7;
  private foot = 0;
  /** The figure's footfalls lead once any came: the clock then waits. */
  private led = false;
  private pending = 0;
  private last = Number.NEGATIVE_INFINITY;
  /** When a footfall last came: walking this long without one, the clock leads again (a figure not drawn). */
  private felt = Number.NEGATIVE_INFINITY;

  /** Footfalls of the figure in the picture since the last pose. */
  feel(n: number): void {
    this.led = true;
    this.pending += n;
  }

  /**
   * The footsteps to play at `now`: the figure's footfalls, one at most per `MIN_STEP_GAP`, while
   * they lead; the clock's (`advance`) before any came.
   */
  take(speed: number, dt: number, now: number): number {
    const n = this.pending;
    this.pending = 0;
    if (n > 0) this.felt = now;
    if (!this.led || (speed >= STEP_MIN_SPEED && now - this.felt > LOST_FIGURE)) return this.advance(speed, dt);
    if (n === 0 || speed < STEP_MIN_SPEED || now - this.last < MIN_STEP_GAP - 1e-6) return 0;
    this.last = now;
    return 1;
  }

  /** Advances by `dt` seconds; returns how many steps fell into it (0 or 1 at normal rates). */
  advance(speed: number, dt: number): number {
    if (dt <= 0) return 0;
    if (speed < STEP_MIN_SPEED) {
      this.phase = 0.7;
      return 0;
    }
    this.phase += dt / stepInterval(speed);
    let steps = 0;
    while (this.phase >= 1) {
      this.phase -= 1;
      steps++;
    }
    return steps;
  }

  /** Alternates -1 / 1 for a slight left/right offset of each step. */
  nextFoot(): number {
    this.foot ^= 1;
    return this.foot ? -1 : 1;
  }
}
