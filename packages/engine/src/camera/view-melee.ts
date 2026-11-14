import { moveOf, swingEnd, swingPhase } from "../renderer/melee-timing";

export interface ViewOffset {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

/** Wound-up and follow-through offsets of the FPP melee viewmodel per strike of the combo. */
const VIEW_SWINGS: readonly { readonly cocked: ViewOffset; readonly through: ViewOffset }[] = [
  // Forehand: from the right shoulder across to the left.
  { cocked: { x: 0.14, y: 0.08, z: -0.08, rx: -0.4, ry: 0.5, rz: -0.9 }, through: { x: -0.42, y: -0.02, z: 0.06, rx: 0.2, ry: -0.7, rz: 0.9 } },
  // Backhand: from the left back to the right.
  { cocked: { x: -0.3, y: 0.04, z: -0.06, rx: -0.3, ry: -0.6, rz: 0.8 }, through: { x: 0.18, y: -0.04, z: 0.08, rx: 0.2, ry: 0.6, rz: -0.9 } },
  // Overhead: up over the head, then down through the centre.
  { cocked: { x: -0.06, y: 0.24, z: -0.12, rx: -1.1, ry: 0, rz: -0.1 }, through: { x: -0.1, y: -0.2, z: 0.08, rx: 1.0, ry: 0, rz: 0 } },
];

/**
 * Offset of the FPP melee viewmodel `elapsed` seconds into a swing (zero before and after), on
 * the rig's timing: half way through the sweep when the simulation lands the blow.
 */
export const viewSwingOffset = (strike: number, elapsed: number, windup: number, recovery: number): ViewOffset => {
  // The light strikes alternate forehand and backhand; the heavy finisher is the overhead cut.
  const poses = VIEW_SWINGS[moveOf(strike) === "heavy" ? 2 : ((strike % 2) + 2) % 2] ?? VIEW_SWINGS[0]!;
  const { cock, through } = swingPhase(elapsed, windup, recovery);
  const mix = (k: keyof ViewOffset) => poses.cocked[k] * cock + (poses.through[k] - poses.cocked[k]) * through;
  return { x: mix("x"), y: mix("y"), z: mix("z"), rx: mix("rx"), ry: mix("ry"), rz: mix("rz") };
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const STILL: ViewOffset = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

/**
 * The FPP melee viewmodel's own state: the eased guard and the swing under way. Split off the
 * camera rig (ADR-0031), which asks it once a frame for the guard share and the swing's offset.
 */
export class ViewMelee {
  /** A baton or a blade is in hand: the guard and the swings apply only then. */
  held = false;
  /** Eased 0..1 guard. */
  private guard = 0;
  private swing: { strike: number; windup: number; recovery: number; elapsed: number } | null = null;

  /** Plays the swing, timed like the simulation's (ADR-0019). */
  start(strike: number, windup: number, recovery: number): void {
    this.swing = { strike, windup, recovery, elapsed: 0 };
  }

  /**
   * Advances by `dt`: the guard share (eased towards the held guard, dropped during a swing) and
   * the swing's offset (zero with no swing or no melee weapon).
   */
  step(guardHeld: number, dt: number): { readonly guard: number; readonly offset: ViewOffset } {
    const want = this.held && guardHeld > 0.5 && !this.swing ? 1 : 0;
    this.guard += (want - this.guard) * Math.min(1, dt * (want > this.guard ? 16 : 8));
    return { guard: smooth(this.guard), offset: this.advance(dt) };
  }

  private advance(dt: number): ViewOffset {
    const sw = this.swing;
    if (!sw || !this.held) {
      this.swing = null;
      return STILL;
    }
    sw.elapsed += dt;
    if (sw.elapsed >= swingEnd(sw.windup, sw.recovery)) this.swing = null;
    return viewSwingOffset(sw.strike, sw.elapsed, sw.windup, sw.recovery);
  }
}
