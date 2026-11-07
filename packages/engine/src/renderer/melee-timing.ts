/**
 * Timing of a melee swing on screen (ADR-0019), shared by the TPP rig and the FPP viewmodel.
 * The simulation starts a swing with `MeleeSwing` (strike, windup, recovery) and lands it
 * exactly `windup` seconds later; the renderer reads nothing else. The blow crosses the front
 * at that moment: the strike (wound up to followed through) is centred on the windup's end.
 */

/** Seconds from the wound-up pose to the follow-through. */
export const SWING_STRIKE = 0.09;

/**
 * The combo's finisher (ADR-0019: the third strike, the most damage, the longest windup and
 * recovery) is the heavy blow, an overhead cut; the strikes before it are light ones.
 */
export const HEAVY_STRIKE = 2;

export type MeleeMove = "light" | "heavy";

export const moveOf = (strike: number): MeleeMove => (strike >= HEAVY_STRIKE ? "heavy" : "light");

export interface SwingPhase {
  /** 0 ready .. 1 wound up. */
  readonly cock: number;
  /** 0 wound up .. 1 followed through; 0.5 is the moment the simulation lands the blow. */
  readonly through: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** How long before the landing the strike starts: half of it, or half the windup when that is shorter. */
const lead = (windup: number): number => Math.min(SWING_STRIKE / 2, Math.max(0, windup) / 2);

/** Seconds from the start of the swing to its end: back at the ready when the simulation's recovery ends. */
export const swingEnd = (windup: number, recovery: number): number => Math.max(0, windup) + Math.max(SWING_STRIKE - lead(windup), recovery);

/**
 * Where a swing is `elapsed` seconds after it started: `cock` takes the weapon from the ready
 * to the wound-up pose, `through` carries it on to the follow-through in SWING_STRIKE, half
 * way at `windup` (the landing), and both fall back to 0 by the end of the recovery.
 */
export const swingPhase = (elapsed: number, windup: number, recovery: number): SwingPhase => {
  const start = Math.max(0, windup) - lead(windup);
  if (elapsed < start) return { cock: smooth(elapsed / Math.max(1e-3, start)), through: 0 };
  const strike = elapsed - start;
  if (strike < SWING_STRIKE) return { cock: 1, through: smooth(strike / SWING_STRIKE) };
  const end = swingEnd(windup, recovery);
  const back = 1 - smooth(Math.min(1, (elapsed - start - SWING_STRIKE) / Math.max(1e-3, end - start - SWING_STRIKE)));
  return { cock: back, through: back };
};
