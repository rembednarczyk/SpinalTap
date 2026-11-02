import { BEAM_FROM, type PatrolPose } from "./patrol-flight";

/**
 * Where the low patrol's searchlight pool lies on the paving (ADR-0058 stage 7b): its template is a
 * unit disc (`patrol-models.ts`), widened by the drop under the drone and laid on the paving. Pure:
 * the views draw it from here, the glitch scan checks its rim against the paving from here.
 */

/** The pool lies this much over the paving (m), clear of its lift's flicker. */
export const POOL_LIFT = 0.04;
/** The pool's radius for each metre of drop (m). */
export const BEAM_SPREAD = 0.3;

/** How far the searchlight reaches down under a pose to the paving, or null when it is off (higher than `BEAM_FROM`). */
export const poolDrop = (p: PatrolPose): number | null => {
  const drop = p.y - p.ground - POOL_LIFT;
  return drop <= BEAM_FROM ? drop : null;
};

/** A point of the unit disc (x, z in the drone's frame) on the paving under a pose with the searchlight `drop` metres long. */
export const poolPoint = (p: PatrolPose, drop: number, x: number, z: number, _surfaceAt: (x: number, z: number) => number): { x: number; y: number; z: number } => {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const r = drop * BEAM_SPREAD;
  return { x: p.x + (x * c + z * s) * r, y: p.y - drop, z: p.z + (-x * s + z * c) * r };
};
