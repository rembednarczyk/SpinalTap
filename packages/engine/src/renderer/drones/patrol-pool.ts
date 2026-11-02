import { BEAM_FROM, type PatrolPose } from "./patrol-flight";

/**
 * Where the low patrol's searchlight pool lies on the paving (ADR-0058 stage 7b): its template is a
 * unit disc (`patrol-models.ts`), widened by the drop under the drone and laid on the paving. Pure:
 * the views draw it from here, the glitch scan checks its rim against the paving from here.
 */

/** The pool lies this much over the paving (m), clear of its lift's flicker. */
export const POOL_LIFT = 0.02;
/** The pool's radius for each metre of drop (m). */
export const BEAM_SPREAD = 0.3;

/** How far the searchlight reaches down under a pose to the paving, or null when it is off (higher than `BEAM_FROM`). */
export const poolDrop = (p: PatrolPose): number | null => {
  const drop = p.y - p.ground - POOL_LIFT;
  return drop <= BEAM_FROM ? drop : null;
};

/** The pool's radius for a drop (m): in 5 cm steps of the drop, so the bob does not stir it while the drone hangs. */
export const poolRadius = (drop: number): number => Math.round(drop / 0.05) * 0.05 * BEAM_SPREAD;

/**
 * A point of the unit disc (x along world x, z along world z: a round pool needs no heading, so it
 * stays put while the drone sways) on the paving under a pose with the searchlight `drop` metres long.
 */
export const poolPoint = (p: PatrolPose, drop: number, x: number, z: number, surfaceAt: (x: number, z: number) => number): { x: number; y: number; z: number } => {
  const r = poolRadius(drop);
  const wx = p.x + x * r;
  const wz = p.z + z * r;
  // Each point on the paving where it lies: the pool follows a slope or a kerb, not the height under the drone.
  return { x: wx, y: pavingAt(surfaceAt, wx, wz) + POOL_LIFT, z: wz };
};

/** How far round a point the paving is read (m): a seam narrower than this between two pieces of paving is not the paving. */
export const PAVING_READ = 0.1;

/**
 * The paving's height at (x, z): the middle of five readings, at the point and `PAVING_READ` either
 * way along x and z, so a hairline seam between two pieces (where the terrain shows a few
 * centimetres lower) does not pull a point of the pool down, while a slope or a kerb still does.
 */
export const pavingAt = (surfaceAt: (x: number, z: number) => number, x: number, z: number): number => {
  const h = [surfaceAt(x, z), surfaceAt(x + PAVING_READ, z), surfaceAt(x - PAVING_READ, z), surfaceAt(x, z + PAVING_READ), surfaceAt(x, z - PAVING_READ)].sort((a, b) => a - b);
  return h[2] as number;
};
