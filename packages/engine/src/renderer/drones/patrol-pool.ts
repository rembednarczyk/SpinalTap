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

/**
 * Over this many metres of the drop under `BEAM_FROM` the pool grows from nothing (m): to its full
 * size 5 m over the paving, over the bob of the 4.6 m it hangs at. Over the 3 m its radius,
 * `BEAM_SPREAD` drop (BEAM_FROM - drop) / BEAM_GROW, only grows as the drone comes down (it would
 * shrink only under 4 m), so the pool never flashes wider than it lies under the hanging drone.
 */
export const BEAM_GROW = 3;

/** The pool's radius for a drop (m): in 5 cm steps of the drop, so the bob does not stir it while the drone hangs; from nothing at `BEAM_FROM`. */
export const poolRadius = (drop: number): number => {
  const d = Math.round(drop / 0.05) * 0.05;
  return d * BEAM_SPREAD * Math.max(0, Math.min(1, (BEAM_FROM - d) / BEAM_GROW));
};

/**
 * A point of the unit disc (x along world x, z along world z: a round pool needs no heading, so it
 * stays put while the drone sways) on the paving under a pose with the searchlight `drop` metres long.
 */
export const poolPoint = (p: PatrolPose, drop: number, x: number, z: number, surfaceAt: (x: number, z: number) => number): { x: number; y: number; z: number } => {
  // The views' own laying (`layPool`) for one point.
  const out = new Float32Array(3);
  layPool(p.x, p.z, poolRadius(drop), Float32Array.of(x, z), surfaceAt, out);
  return { x: out[0] as number, y: out[1] as number, z: out[2] as number };
};

/**
 * The pool's distinct points (unit disc, x, z pairs) laid on the paving round (x, z) at radius `r`:
 * x, y, z of each, every point read once (`pavingAt`), whatever many triangles share it.
 */
export const layPool = (x: number, z: number, r: number, points: Float32Array, surfaceAt: (x: number, z: number) => number, out: Float32Array): void => {
  for (let k = 0; k * 2 < points.length; k++) {
    const wx = x + (points[k * 2] as number) * r;
    const wz = z + (points[k * 2 + 1] as number) * r;
    out[k * 3] = wx;
    // Each point on the paving where it lies: the pool follows a slope or a kerb, not the height under the drone.
    out[k * 3 + 1] = pavingAt(surfaceAt, wx, wz) + POOL_LIFT;
    out[k * 3 + 2] = wz;
  }
};

/** How far round a point the paving is read (m): a seam narrower than this between two pieces of paving is not the paving. */
export const PAVING_READ = 0.15;

/**
 * The paving's height at (x, z): the middle of nine readings on a 3 x 3 grid `PAVING_READ` apart round
 * the point, so a seam between two pieces (where the terrain shows a few centimetres lower), crossing
 * at most a row or a column of them, does not pull a point of the pool down, while a slope or a kerb
 * still does.
 */
export const pavingAt = (surfaceAt: (x: number, z: number) => number, x: number, z: number): number => {
  const h: number[] = [];
  for (const dx of [-PAVING_READ, 0, PAVING_READ]) for (const dz of [-PAVING_READ, 0, PAVING_READ]) h.push(surfaceAt(x + dx, z + dz));
  return h.sort((a, b) => a - b)[4] as number;
};
