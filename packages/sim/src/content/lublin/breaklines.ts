import { type GroundPoint, type TerrainGrid, terrainHeightAt } from "@seki/core";
import { type Ramp, refineGrid, shapeGrid } from "./shape";

/**
 * Breaklines under retaining walls (T-351, G-968): the NMT jumps 1-2.8 m within a metre or two
 * under the walls along Królewska, and the import's grid smears that over about 8 m, so the
 * terrace sinks towards the wall, the pavement climbs it and the flight between the walls climbs
 * 0.39 m instead of its 2.4 m. Pattern: the breaklines of a TIN or NMT (GUGiK's NMT, LandXML's
 * `Breaklines`): the surface may not be interpolated across the line. Here, on a grid refined to
 * `BREAK_CELL`, each point within `band` of a line takes the level of its own side, read on the
 * coarse grid `read` metres out from the line, where the game's ground meets the NMT within 0.1 m
 * (the probe of 25.11, `docs/plany/archikatedra-otoczenie.md` §1.3); the shaping fades out over
 * `FADE` metres at the line's ends, so the terrain past them is left as it is. Where we differ
 * from a TIN: the grid stays a regular lattice, so the step is a cell (1.25 m) wide; the wall's
 * face, 0.5 m thick, covers most of it.
 */

/** A wall the terrain steps under: its axis, which side is the upper one, and the regions left to other shaping. */
export interface Breakline {
  /** The OSM way of the wall (`docs/topografia.md` T-351). */
  readonly id: string;
  readonly line: readonly GroundPoint[];
  /** How far from the line the points take their side's level (m). */
  readonly band: number;
  /** How far out from the line that level is read (m): past the old grid's smear, where it meets the NMT. */
  readonly read: number;
  /** Boxes left out (a flight between two walls, laid by its own ramp). */
  readonly skip?: readonly { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }[];
}

/** The cell of a grid under a breakline (m): a quarter of the import's 5 m, half the flights' 2.5 m. */
export const BREAK_CELL = 1.25;
/** Over how many metres the shaping fades out at a line's ends. */
const FADE = 3;

/** The flight w565845673 between the two walls' ends: its box, left to its ramp. */
const KATEDRALNY_FLIGHT = { minX: 584.2, maxX: 590.3, minZ: -200.4, maxZ: -197.2 } as const;

/**
 * Plac Katedralny's terrace over Królewska (T-351): w590597335 from its south-west corner to its
 * end by the flight, w232362979 from the flight to the cathedral's front (its stretch at x 605-612
 * stands where the NMT has no step, G-969). The terrace is on their north side.
 */
export const BREAKLINES: readonly Breakline[] = [
  {
    id: "w590597335",
    line: [
      { x: 554.7, z: -200.5 },
      { x: 582.3, z: -198.4 },
      { x: 582.7, z: -198.3 },
      { x: 583.2, z: -197.6 },
      { x: 584, z: -197.2 },
      { x: 589.1, z: -196.7 },
    ],
    band: 4,
    read: 5.5,
    skip: [KATEDRALNY_FLIGHT],
  },
  {
    id: "w232362979",
    line: [
      { x: 584.6, z: -200.8 },
      { x: 591, z: -200.2 },
      { x: 604.8, z: -199.4 },
    ],
    band: 4,
    read: 5.5,
    skip: [KATEDRALNY_FLIGHT],
  },
];

/** The nearest point of a polyline to p: the point, the unit normal to the left of its segment, the distance and how far from either end along the line. */
const nearest = (line: readonly GroundPoint[], p: GroundPoint) => {
  const total = line.slice(1).reduce((a, q, i) => a + Math.hypot(q.x - line[i]!.x, q.z - line[i]!.z), 0);
  let best = { d: Infinity, foot: p, n: { x: 0, z: 0 }, fromEnd: 0 };
  let run = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len)));
    const foot = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    const d = Math.hypot(p.x - foot.x, p.z - foot.z);
    const along = run + t * len;
    if (d < best.d) best = { d, foot, n: { x: -(b.z - a.z) / len, z: (b.x - a.x) / len }, fromEnd: Math.min(along, total - along) };
    run += len;
  }
  return best;
};

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const inBox = (b: NonNullable<Breakline["skip"]>[number], x: number, z: number): boolean => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/**
 * Is (x, z) where a line may move the ground: within its band, or in a box it leaves to a flight's
 * ramp, grown by a cell's diagonal (the grid is bilinear, so a moved point moves the ground that far).
 */
export const nearBreakline = (x: number, z: number, lines: readonly Breakline[] = BREAKLINES): boolean => {
  const m = BREAK_CELL * Math.SQRT2;
  return lines.some((l) => nearest(l.line, { x, z }).d <= l.band + m || (l.skip ?? []).some((b) => x >= b.minX - m - 1.5 && x <= b.maxX + m + 1.5 && z >= b.minZ - m - 1.5 && z <= b.maxZ + m + 1.5));
};

/** Does the grid reach within a band of one of the lines? */
const reaches = (g: TerrainGrid, lines: readonly Breakline[]): boolean => {
  const [maxX, maxZ] = [g.originX + (g.cols - 1) * g.cell, g.originZ + (g.rows - 1) * g.cell];
  return lines.some((l) => l.line.some((p) => p.x >= g.originX - l.band && p.x <= maxX + l.band && p.z >= g.originZ - l.band && p.z <= maxZ + l.band));
};

/** A flight between a breakline's two levels: its foot and top, where each level is read off the coarse grid, and its width. */
export interface BreakFlight {
  readonly id: string;
  readonly foot: GroundPoint;
  readonly top: GroundPoint;
  readonly readFoot: GroundPoint;
  readonly readTop: GroundPoint;
  readonly width: number;
}

/**
 * The flight w565845673 between the walls' ends (15 steps, 2.4 m): from the pavement's level, read
 * 5.5 m south of its foot, to the terrace's, read 5.5 m north of its top (the lines' `read`).
 */
export const BREAK_FLIGHTS: readonly BreakFlight[] = [
  { id: "w565845673", foot: { x: 584.5, z: -199 }, top: { x: 589.9, z: -198.5 }, readFoot: { x: 584.5, z: -204.5 }, readTop: { x: 589.9, z: -193 }, width: 2.6 },
];

/** The flights' ramps on the coarse grid's levels: a level landing a cell on past the top. */
export const breakRamps = (g: TerrainGrid, flights: readonly BreakFlight[]): Ramp[] =>
  flights.flatMap((f) => {
    const ya = terrainHeightAt(g, f.readFoot.x, f.readFoot.z);
    const yb = terrainHeightAt(g, f.readTop.x, f.readTop.z);
    const d = Math.hypot(f.top.x - f.foot.x, f.top.z - f.foot.z) || 1;
    const on = { x: f.top.x + ((f.top.x - f.foot.x) / d) * BREAK_CELL, z: f.top.z + ((f.top.z - f.foot.z) / d) * BREAK_CELL };
    return [
      { a: f.foot, b: f.top, ya, yb, width: f.width, blend: 0, square: true },
      { a: f.top, b: on, ya: yb, yb, width: f.width, blend: 0, square: true },
    ];
  });

/** The grid with the lines' steps laid: refined to `BREAK_CELL` where a line reaches it, each point near a line at its side's level, then the flights between them. */
export const breakGrid = (g: TerrainGrid, lines: readonly Breakline[] = BREAKLINES, flights: readonly BreakFlight[] = BREAK_FLIGHTS): TerrainGrid => {
  if (!reaches(g, lines)) return g;
  const fine = refineGrid(g, BREAK_CELL);
  const heights = fine.heights.map((h, i) => {
    const x = fine.originX + (i % fine.cols) * fine.cell;
    const z = fine.originZ + Math.floor(i / fine.cols) * fine.cell;
    // The nearest line within its band decides: by two walls' ends each would pull its own way.
    let best: { l: Breakline; near: ReturnType<typeof nearest> } | null = null;
    for (const l of lines) {
      if (l.skip?.some((b) => inBox(b, x, z))) continue;
      const near = nearest(l.line, { x, z });
      // A line whose end the point lies past has no say there (its weight is nought).
      if (near.d <= l.band && near.fromEnd > 0.05 && (!best || near.d < best.near.d)) best = { l, near };
    }
    if (!best) return h;
    const { l, near } = best;
    // Which side of the line the point is on: the side's level is read `read` out on it.
    const side = (x - near.foot.x) * near.n.x + (z - near.foot.z) * near.n.z >= 0 ? 1 : -1;
    const level = terrainHeightAt(g, near.foot.x + near.n.x * side * l.read, near.foot.z + near.n.z * side * l.read);
    return h + (level - h) * smooth(near.fromEnd / FADE);
  });
  return shapeGrid({ ...fine, heights }, [], breakRamps(g, flights));
};
