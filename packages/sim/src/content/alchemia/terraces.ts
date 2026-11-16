import { KRAKOWSKIE_CHUNKS } from "../lublin/krakowskie.generated";
import type { GroundRect, Pad, Ramp } from "../lublin/shape";
import { HALL, T0, T1, type Piece, box, piece } from "./plan";
import { T2_PADS, T2_STAIRS } from "./plaza";

/**
 * The terraces round the food hall (ADR-0074 §1, stage 1), shaped into the game's terrain as pads
 * and ramps of `lublin/sites.ts` with their rows in `docs/topografia.md`:
 * - T0, the car park's level along the hall's back wall (-2.2, measured): the grid's line under
 *   the back wall (or the first inside it) levelled to it, so the car park meets the hall's roof flush;
 * - T1, the square in front of the hall (-6.4, the mean of the NMT along the front, -8.6..-3.7
 *   over the square), its floor's level, cut back from Świętoduska's sidewalk (T-209): the street
 *   keeps the NMT (ADR-0042);
 * - a ramp down each side of the hall from T0 to T1 (4.2 m over 25 m), along its walls. The east one is drawn as steps
 *   on its slope (ADR-0045's steps on ramps), the west one stays a paved ramp.
 * The terraces and the ramps are one floor of the terrain: walkers go from T0 to T1 without the
 * level graph; the hall inside its walls is the graph's (`nav.ts`).
 */

/**
 * The square in front of the hall, levelled (T1), north and east blending 8 m into the slope down
 * to T2. On the west Świętoduska's sidewalk runs north-east along the plot (x 394.5 at z 56, 402.8
 * at z 76), so the square steps back with it with a 2 m blend: the sidewalk's cell of the grid
 * keeps the NMT and the square ends a cell east of it. The strip before Fumiko's hatch and door
 * (z up to 62) reaches the hall's west wall, the rest from x 408. East it ends at x 443: its blend
 * keeps off Lubartowska's sidewalk past the Arkady's south end within 0.3 m (G-460; 0.37 m from x 444
 * on the 2.5 m grid, G-758).
 */
export const T1_RECT: GroundRect = { minX: 412, maxX: 443, minZ: HALL.maxZ - 2, maxZ: 76 };
const T1_WEST: GroundRect = { ...T1_RECT, minX: 408 };
const T1_HATCH: GroundRect = { ...T1_RECT, minX: HALL.minX, maxZ: 62 };
/** The map's grid under the hall (its chunk's). */
const GRID = KRAKOWSKIE_CHUNKS.find((c) => c.bounds.minX <= HALL.minX && c.bounds.maxX >= HALL.maxX && c.bounds.minZ <= HALL.minZ && c.bounds.maxZ >= HALL.maxZ)!.terrain;
/**
 * The line of the grid under the back wall, or the first inside it where none runs under it (G-758,
 * the 2.5 m grid: z 32.5), levelled to the car park (T0). Not the row outside it as well: metro B's
 * opening is on it (`metro-pavilion.ts`).
 */
const T0_Z = GRID.originZ + Math.ceil((HALL.minZ - GRID.originZ) / GRID.cell - 1e-9) * GRID.cell;
export const T0_LINE: GroundRect = { minX: HALL.minX - 4, maxX: HALL.maxX + 4, minZ: T0_Z, maxZ: T0_Z };

/** The ramps beside the hall: their axes from the car park (z 31) to T1 at the hall's front line of the grid. */
const RAMP_FROM = HALL.minZ - 1;
const RAMP_TO = HALL.maxZ - 2;
export const WEST_RAMP: Ramp = { a: { x: HALL.minX - 3, z: RAMP_FROM }, b: { x: HALL.minX - 3, z: RAMP_TO }, ya: T0, yb: T1, width: 6, blend: 2, square: true };
export const EAST_RAMP: Ramp = { a: { x: HALL.maxX + 3, z: RAMP_FROM }, b: { x: HALL.maxX + 3, z: RAMP_TO }, ya: T0, yb: T1, width: 6, blend: 2, square: true };

export const ALCHEMIA_PADS: readonly Pad[] = [
  { rect: T1_RECT, y: T1, blend: 8, row: "T-207" },
  { rect: T1_WEST, y: T1, blend: 2, row: "T-207" },
  { rect: T1_HATCH, y: T1, blend: 2, row: "T-207" },
  { rect: T0_LINE, y: T0, blend: 0, row: "T-206" },
  // T2 (stage 2), after T1: its bands reach over T1's blend to the north.
  ...T2_PADS,
];
export const ALCHEMIA_RAMPS: readonly Ramp[] = [WEST_RAMP, EAST_RAMP, T2_STAIRS];

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
