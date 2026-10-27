/** Below this horizontal speed (m/s) the heroine is standing, not walking. */
export const STEP_MIN_SPEED = 0.6;

/** Seconds between footsteps: ~0.5 s walking (4.2 m/s), ~0.3 s sprinting. */
export const stepInterval = (speed: number): number => Math.min(0.7, Math.max(0.26, 2.1 / Math.max(speed, 1e-3)));

/**
 * Turns speed over time into footstep events. The first step lands soon after starting to
 * move, not a full interval later, and stopping resets the gait.
 */
export class FootstepClock {
  private phase = 0.7;
  private foot = 0;

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
