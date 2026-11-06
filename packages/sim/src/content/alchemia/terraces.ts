import type { GroundRect, Pad, Ramp } from "../lublin/shape";
import { HALL, T0, T1, type Piece, box, piece } from "./plan";

/**
 * The terraces round the food hall (ADR-0074 §1, stage 1), shaped into the game's terrain as pads
 * and ramps of `lublin/sites.ts` with their rows in `docs/topografia.md`:
 * - T0, the car park's level along the hall's back wall (-2.2, measured): the grid's line under
 *   the back wall levelled to it, so the car park meets the hall's roof flush;
 * - T1, the square in front of the hall (-6.4, the mean of the NMT there), its floor's level;
 * - a ramp down each side of the hall from T0 to T1 (4.2 m over 25 m), on the lines of the grid
 *   at its walls, so the slope meets the walls along whole cells. The east one is drawn as steps
 *   on its slope (ADR-0045's steps on ramps), the west one stays a paved ramp.
 * The terraces and the ramps are one floor of the terrain: walkers go from T0 to T1 without the
 * level graph; the hall inside its walls is the graph's (`nav.ts`).
 */

/** The square in front of the hall, levelled (T1). */
export const T1_RECT: GroundRect = { minX: 396, maxX: 444, minZ: HALL.maxZ - 2, maxZ: 76 };
/** The line of the grid under the back wall, levelled to the car park (T0). */
export const T0_LINE: GroundRect = { minX: HALL.minX - 4, maxX: HALL.maxX + 4, minZ: HALL.minZ, maxZ: HALL.minZ };

/** The ramps beside the hall: their axes from the car park (z 31) to T1 at the hall's front line of the grid. */
const RAMP_FROM = HALL.minZ - 1;
const RAMP_TO = HALL.maxZ - 2;
export const WEST_RAMP: Ramp = { a: { x: HALL.minX - 3, z: RAMP_FROM }, b: { x: HALL.minX - 3, z: RAMP_TO }, ya: T0, yb: T1, width: 6, blend: 2, square: true };
export const EAST_RAMP: Ramp = { a: { x: HALL.maxX + 3, z: RAMP_FROM }, b: { x: HALL.maxX + 3, z: RAMP_TO }, ya: T0, yb: T1, width: 6, blend: 2, square: true };

export const ALCHEMIA_PADS: readonly Pad[] = [
  { rect: T1_RECT, y: T1, blend: 8, row: "T-198" },
  { rect: T0_LINE, y: T0, blend: 0, row: "T-197" },
];
export const ALCHEMIA_RAMPS: readonly Ramp[] = [WEST_RAMP, EAST_RAMP];

/** Height of a ramp's axis at z. */
export const rampY = (r: Ramp, z: number): number => {
  const t = Math.max(0, Math.min(1, (z - r.a.z) / (r.b.z - r.a.z)));
  return r.ya + (r.yb - r.ya) * t;
};

/** The east ramp's steps: drawn, not solid (bodies walk its even slope), a metre of going each. */
export const terracePieces = (): Piece[] => {
  const out: Piece[] = [];
  const r = EAST_RAMP;
  const half = r.width / 2 - 0.3;
  for (let z = r.a.z; z < r.b.z - 1e-6; z += 1) {
    const top = rampY(r, z) + 0.02;
    out.push(piece(box(r.a.x - half, r.a.x + half, z, z + 1, rampY(r, z + 1) - 0.3, top), "step", false, false));
  }
  return out;
};
