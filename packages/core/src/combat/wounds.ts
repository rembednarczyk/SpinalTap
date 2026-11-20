/*
 * How wounds slow the player (user notes of 18.11): below half her health she slows down step by
 * step, and badly hurt (`WOUND_CRITICAL` of it and less) she cannot run at all. The same shares
 * make her limp in the picture (ADR-0090 point 14), so what she can do and how she looks agree.
 */

/** Health share below which she starts to slow down (and to limp). */
export const WOUND_FROM = 0.5;
/** Health share at and below which she is badly hurt: slowest, and no running. */
export const WOUND_CRITICAL = 0.15;
/** Her pace when badly hurt, of her pace unhurt. */
export const WOUNDED_PACE = 0.7;

export interface WoundedGait {
  /** Multiplies her speed. */
  readonly pace: number;
  /** May she run? */
  readonly sprint: boolean;
}

/** Her gait at `share` (0..1) of her health. */
export const woundedGait = (share: number): WoundedGait => {
  if (share >= WOUND_FROM) return { pace: 1, sprint: true };
  const k = Math.min(1, (WOUND_FROM - share) / (WOUND_FROM - WOUND_CRITICAL));
  return { pace: 1 - (1 - WOUNDED_PACE) * k, sprint: share > WOUND_CRITICAL };
};
