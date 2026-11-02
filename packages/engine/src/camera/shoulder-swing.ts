/** Seconds the TPP camera takes to swing over to the other shoulder (G-275). */
const SHOULDER_SWING = 0.3;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * The shoulder the TPP camera looks over (G-275). The settings set the target; the camera swings
 * across to it instead of jumping, while the simulation's shots move over at once.
 */
export class ShoulderSwing {
  /** 1 right, -1 left, from the settings. The shots start on the same side. */
  target: 1 | -1 = 1;
  /** -1..1, moving towards `target`. */
  private side = 1;

  /** The side for this frame, eased; in first person, where nothing shows it, it just changes. */
  update(dt: number, tpp: boolean): number {
    const step = tpp ? (2 * dt) / SHOULDER_SWING : 2;
    this.side += Math.sign(this.target - this.side) * Math.min(Math.abs(this.target - this.side), step);
    return 2 * smooth((this.side + 1) / 2) - 1;
  }
}
