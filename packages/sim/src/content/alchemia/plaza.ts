import type { GroundPoint } from "@seki/core";
import { KRAKOWSKIE_CHUNKS } from "../lublin/krakowskie.generated";
import { STARE_MIASTO_CHUNKS } from "../lublin/stare-miasto.generated";
import type { GroundRect, Pad, Ramp } from "../lublin/shape";
import { ARKADY, ARKADY_ARCADE_SPAN, arkadyLineX, arkadyPoint } from "./arkady";
import { type Box, type Piece, T1, box, piece } from "./plan";

/**
 * The lower square T2 (ADR-0074 §1, stage 2) on the floor of the hollow between Świętoduska and
 * the Arkady, where the Hebi hollow of ADR-0063 lay (T-186): levelled in front of the Arkady's
 * arcade and under it, so the arcade's floor is level; west of it the NMT stays, the west half of
 * the plot falling north to Świętoduska as it does, and so does the ground east of the building
 * (Lubartowska's pavement, ADR-0042). The wide stairs from T1 come down onto it with seats along
 * them; a memorial stone with the square's name (Plac Ofiar Getta: no neon, no adverts and no
 * jobs by it, §6) stands in a green bed on its west edge, with two more beds along that edge.
 *
 * T2 is pads (`docs/topografia.md` T-217): bands 4 m deep along the world's z from the square's west
 * edge to the arcade (the building lies askew), blending over 4 m into the slopes round them, and
 * the points of the terrain's grids (4 m west of x 460, 2.5 m east of it) of every cell the arcade's
 * floor touches, each alone. Some of those lie a little past the east face, so the ground along it
 * dips under the pavement laid there (`arkady.ts`, level with the map's ground beyond it).
 * The stairs are a ramp laid over the pads (T-219): T1's blend to the north would steepen their foot.
 */

/** The square's level: the floor of the hollow, the Hebi stash's once (NMT at (442; 93)). */
export const T2 = ARKADY.ground;

/** The map's own terrain where the Arkady stand (both districts' grids meet at x 460). */
const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS];

/** The square's bands: their south edges 4 m apart, its west edge kept off Świętoduska's pavement. */
const BAND = 4;
const westOf = (z: number): number => (z < 100 ? 424 : z < 108 ? 426 : z < 116 ? 428 : z < 120 ? 432 : z < 124 ? 436 : 440);
/** The bands reach into the building up to this line across it, so their blend stays inside it. */
const INTO = 1.2;

const bands = (): GroundRect[] => {
  const out: GroundRect[] = [];
  for (let z = 88; z < 128; z += BAND) out.push({ minX: westOf(z), maxX: arkadyLineX(INTO, z), minZ: z, maxZ: z + BAND });
  return out;
};

export const T2_RECTS: readonly GroundRect[] = bands();

/**
 * The arcade's floor in the building's frame: from its first pier (the south span is closed) to its
 * north end wall, and 0.3 m before the arches past the first pier (before it the 4 m grid's next
 * cell west would pull T1's slope down by the stairs, G-460).
 */
const ARCADE = { ...ARKADY_ARCADE_SPAN, c0: -0.3, c1: ARKADY.arcade, before: ARKADY_ARCADE_SPAN.a0 + ARKADY.pier } as const;

/** The grid points of every cell of the map's terrain the arcade's floor touches, once each. */
const arcadePoints = (): GroundPoint[] => {
  const seen = new Map<string, GroundPoint>();
  for (let a = ARCADE.a0; a <= ARCADE.a1 + 1e-9; a += 0.25) {
    for (let c = a < ARCADE.before ? 0 : ARCADE.c0; c <= ARCADE.c1 + 1e-9; c += 0.25) {
      const p = arkadyPoint(a, c);
      const chunk = CHUNKS.find((k) => p.x >= k.bounds.minX && p.x <= k.bounds.maxX && p.z >= k.bounds.minZ && p.z <= k.bounds.maxZ);
      if (!chunk) continue;
      const g = chunk.terrain;
      const i = Math.floor((p.x - g.originX) / g.cell);
      const j = Math.floor((p.z - g.originZ) / g.cell);
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const q = { x: g.originX + (i + di) * g.cell, z: g.originZ + (j + dj) * g.cell };
        seen.set(`${q.x},${q.z}`, q);
      }
    }
  }
  return [...seen.values()].sort((p, q) => p.z - q.z || p.x - q.x);
};

/** A pad on one grid point alone: no other point of a grid of 2.5 m or more is within its blend. */
const POINT_BLEND = 1;

export const T2_PADS: readonly Pad[] = [
  ...T2_RECTS.map((rect): Pad => ({ rect, y: T2, blend: 4, row: "T-217" })),
  ...arcadePoints().map((p): Pad => ({ rect: { minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z }, y: T2, blend: POINT_BLEND, row: "T-217" })),
];

/** The stairs from T1 down to T2, west of the Arkady's south end. */
export const T2_STAIRS: Ramp = { a: { x: 431, z: 76 }, b: { x: 431, z: 92 }, ya: T1, yb: T2, width: 10, blend: 2, square: true, over: true };

/** Height of the stairs' axis at z. */
const stairsY = (z: number): number => {
  const r = T2_STAIRS;
  const t = Math.max(0, Math.min(1, (z - r.a.z) / (r.b.z - r.a.z)));
  return r.ya + (r.yb - r.ya) * t;
};

/** The memorial stone with the square's name, in its green bed: over 10 m from every job's spot (§6), the nearest the raid's lookout and the stash's ambush. */
export const MEMORIAL: Box = box(428.7, 430.3, 112.0, 112.4, T2 - 0.2, T2 + 1.6);
const MEMORIAL_BED: Box = box(428.3, 431.7, 110.4, 114.6, T2 - 0.3, T2 + 0.3);

/** The square's green along its west edge: knee-high beds (seats too). */
const BEDS: readonly Box[] = [box(424.6, 429, 93, 98, T2 - 0.3, T2 + 0.45), box(432.5, 436, 117, 120.5, T2 - 0.3, T2 + 0.45)];

/** The stairs' steps (drawn; bodies walk the even grade) and the seats down each side of them (solid). */
const stairPieces = (): Piece[] => {
  const out: Piece[] = [];
  const r = T2_STAIRS;
  const half = r.width / 2;
  for (let z = r.a.z; z < r.b.z - 1e-6; z += 1) {
    out.push(piece(box(r.a.x - half + 1, r.a.x + half - 1, z, z + 1, stairsY(z + 1) - 0.3, stairsY(z) + 0.02), "step", false, false));
  }
  for (const x of [r.a.x - half, r.a.x + half - 1]) {
    for (let z = r.a.z + 1; z < r.b.z - 1; z += 2) out.push(piece(box(x, x + 1, z, z + 1.6, stairsY(z + 1.6) - 0.3, stairsY(z) + 0.45), "bench", false));
  }
  return out;
};

/** Every drawn piece of T2 in the world's axes. */
export const plazaPieces = (): Piece[] => [...stairPieces(), piece(MEMORIAL, "memorial", false), piece(MEMORIAL_BED, "green", false), ...BEDS.map((b) => piece(b, "green", false))];

/** Is (x, z) on T2's bands (the square before the arcade)? */
export const onT2 = (x: number, z: number): boolean => T2_RECTS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
