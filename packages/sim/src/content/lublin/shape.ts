import { type GroundPoint, type TerrainGrid, terrainHeightAt } from "@seki/core";
import type { LublinChunkData } from "./types";

/**
 * Shaping the map's terrain for the game (ADR-0045): pads flattened under the hand-made set
 * pieces and the interiors, and ramps of even grade along the city's steps. A shaped height is
 * a pure function of the position and the original height there, so neighbouring chunks keep
 * the same heights where their grids meet (ADR-0043's seams).
 */

/** An axis-aligned rectangle on the ground. */
export interface GroundRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Ground levelled to `y` over `rect`, blending into the terrain over `blend` metres around it. */
export interface Pad {
  readonly rect: GroundRect;
  readonly y: number;
  readonly blend: number;
  /** Its row in `docs/topografia.md` (T-NNN): the departure from the NMT written down (ADR-0042, the scan's `pad-unregistered`). */
  readonly row?: string;
}

/** A corridor of even grade from `a` (height `ya`) to `b` (height `yb`), `width` wide, blending over `blend`. */
export interface Ramp {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly ya: number;
  readonly yb: number;
  readonly width: number;
  readonly blend: number;
  /**
   * Its ends cut square across it, blending over `blend` past them, not rounded: a wide ramp's
   * round end reaches half its width past it (G-349, a bridge's abutment 13 m wide).
   */
  readonly square?: boolean;
  /**
   * Laid over the pads, not under them: a ramp between two terraces (ADR-0074's stairs from T1
   * down to T2) keeps its grade where a terrace's blend reaches over it.
   */
  readonly over?: boolean;
  /** Only raises the ground: where it lies under the ramp (beside a flight's top, G-686), not over it. */
  readonly fill?: boolean;
  /** The highest it leaves the ground at (x, z), cutting it if need be: under a bridge's deck (G-686), else the terrain pokes through it. */
  readonly ceiling?: (x: number, z: number) => number;
}

/** 1 inside, 0 beyond `blend`, smooth between. */
const weight = (d: number, blend: number): number => {
  if (d <= 0) return 1;
  if (d >= blend) return 0;
  const t = 1 - d / blend;
  return t * t * (3 - 2 * t);
};

const rectDistance = (r: GroundRect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/**
 * Area of a flat outline `[x0, z0, …]` placed at (ox, oz) inside a rectangle: the outline
 * clipped to each side in turn (exact for a concave outline too, its slivers along a side have
 * no area).
 */
export const rectOverlap = (r: GroundRect, flat: readonly number[], ox: number, oz: number): number => {
  let pts: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i]! + ox, flat[i + 1]! + oz]);
  const sides: readonly (readonly [axis: 0 | 1, sign: 1 | -1, at: number])[] = [
    [0, 1, r.minX],
    [0, -1, r.maxX],
    [1, 1, r.minZ],
    [1, -1, r.maxZ],
  ];
  for (const [axis, sign, at] of sides) {
    const out: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const sa = sign * (a[axis] - at);
      const sb = sign * (b[axis] - at);
      if (sa >= 0) out.push(a);
      if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
        const t = sa / (sa - sb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = out;
    if (pts.length < 3) return 0;
  }
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};

/** Height at (x, z) after the ramps laid under the pads (`over` false) or over them (true). */
const rampsOver = (x: number, z: number, h: number, ramps: readonly Ramp[], over: boolean): number => {
  let out = h;
  for (const r of ramps) {
    if ((r.over ?? false) !== over) continue;
    const dx = r.b.x - r.a.x;
    const dz = r.b.z - r.a.z;
    const len2 = dx * dx + dz * dz || 1;
    const along = ((x - r.a.x) * dx + (z - r.a.z) * dz) / len2;
    const t = Math.max(0, Math.min(1, along));
    // Square: past an end along the axis, and off its side across it.
    const across = Math.abs((x - r.a.x) * dz - (z - r.a.z) * dx) / Math.sqrt(len2);
    const d = r.square
      ? Math.hypot((along - t) * Math.sqrt(len2), Math.max(0, across - r.width / 2))
      : Math.hypot(x - r.a.x - t * dx, z - r.a.z - t * dz) - r.width / 2;
    const w = weight(d, r.blend);
    if (w <= 0) continue;
    const y = r.ya + (r.yb - r.ya) * t;
    if (!r.fill || y > out) out += (y - out) * w;
    if (r.ceiling) out = Math.min(out, r.ceiling(x, z));
  }
  return out;
};

/** Height at (x, z) after the ramps, then the pads, then the ramps laid over them, from the original height `h`. */
export const shapeHeight = (x: number, z: number, h: number, pads: readonly Pad[], ramps: readonly Ramp[]): number => {
  let out = rampsOver(x, z, h, ramps, false);
  for (const p of pads) {
    const w = weight(rectDistance(p.rect, x, z), p.blend);
    if (w > 0) out += (p.y - out) * w;
  }
  return rampsOver(x, z, out, ramps, true);
};

/** The grid with every point shaped. */
export const shapeGrid = (g: TerrainGrid, pads: readonly Pad[], ramps: readonly Ramp[]): TerrainGrid => {
  const heights = g.heights.map((h, i) => {
    const x = g.originX + (i % g.cols) * g.cell;
    const z = g.originZ + Math.floor(i / g.cols) * g.cell;
    return shapeHeight(x, z, h, pads, ramps);
  });
  return { ...g, heights };
};

/** Original height of the map at (x, z): the first chunk holding the point, or the nearest one. */
export const mapHeight = (chunks: readonly LublinChunkData[], x: number, z: number): number => {
  let best: LublinChunkData | null = null;
  let bestD = Infinity;
  for (const c of chunks) {
    const d = rectDistance(c.bounds, x, z);
    if (d === 0) return terrainHeightAt(c.terrain, x, z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ? terrainHeightAt(best.terrain, x, z) : 0;
};

/**
 * Ramps along the named flights of steps of the map (`highway=steps` with a name: only those
 * are in a chunk's `streets`, 3 of 69 flights): one per segment, from the terrain at its ends,
 * so a path down a scarp walks at an even grade. The unnamed flights are left to the terrain,
 * which follows the NMT along them (roads audit 31.10, G-087).
 */
export const stepRamps = (chunks: readonly LublinChunkData[], width = 3, blend = 1.5): Ramp[] => {
  const out: Ramp[] = [];
  for (const c of chunks) {
    for (const s of c.streets) {
      if (s.kind !== "steps") continue;
      for (let i = 0; i + 3 < s.line.length; i += 2) {
        const a = { x: s.line[i]!, z: s.line[i + 1]! };
        const b = { x: s.line[i + 2]!, z: s.line[i + 3]! };
        out.push({ a, b, ya: mapHeight(chunks, a.x, a.z), yb: mapHeight(chunks, b.x, b.z), width, blend });
      }
    }
  }
  return out;
};

/** The rise of one outdoor step (m): what a flight's mapped `step_count` climbs by. */
export const STEP_RISE = 0.16;
/** How far a flight's top may lie under its foot and the terrain be left as it is (m): a flight about level is G-229's. */
const TOP_UNDER_FOOT = 0.1;

/**
 * The coarsest cell a grid keeps under a flight's ramp (m). The grid is bilinear, so a ramp moves
 * the ground up to a cell past its band: on a 5 m grid a raised portal lifted the square in front
 * of it 3.4 m off the flight (G-236). It divides the import's 5 and 10 m cells.
 */
export const FLIGHT_CELL = 2.5;

/**
 * Ramps along the flights of steps whose map `incline` the terrain contradicts (G-236): the NMT
 * under a building is interpolated, so the ground at a church's portal may lie below the foot of
 * the steps up to it. Such a flight gets an even grade from its foot, kept at the terrain's
 * height, up its `step_count` risers (or as far as the terrain fell), one ramp per segment, on its
 * band only: no blend, so the ground beside it stays the map's past one cell of a grid of at most
 * `FLIGHT_CELL` (`flightGrid`). The others are left to the terrain, which climbs them the right way.
 */
export const flightRamps = (chunks: readonly LublinChunkData[], width = 3, blend = 0): Ramp[] => {
  const out: Ramp[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    for (const f of c.flights ?? []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const pts: GroundPoint[] = [];
      for (let i = 0; i + 1 < f.line.length; i += 2) pts.push({ x: f.line[i]!, z: f.line[i + 1]! });
      const foot = pts[0];
      const top = pts[pts.length - 1];
      if (!foot || !top || pts.length < 2) continue;
      const yFoot = mapHeight(chunks, foot.x, foot.z);
      const fall = yFoot - mapHeight(chunks, top.x, top.z);
      if (fall <= TOP_UNDER_FOOT) continue;
      const rise = f.steps !== undefined ? f.steps * STEP_RISE : fall;
      const along = [0];
      for (let i = 1; i < pts.length; i++) along.push(along[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
      const length = along[along.length - 1]! || 1;
      // The landing a cell on past the top, level with it: else the grid's points just beyond
      // (in the portal the steps lead into) pull the top back down towards the interpolated NMT.
      // First, so the flight's own grade wins where the two overlap at the top.
      const last = pts[pts.length - 2]!;
      const d = Math.hypot(top.x - last.x, top.z - last.z) || 1;
      const on = { x: top.x + ((top.x - last.x) / d) * FLIGHT_CELL, z: top.z + ((top.z - last.z) / d) * FLIGHT_CELL };
      out.push({ a: top, b: on, ya: yFoot + rise, yb: yFoot + rise, width, blend });
      for (let i = 0; i + 1 < pts.length; i++) {
        out.push({ a: pts[i]!, b: pts[i + 1]!, ya: yFoot + (rise * along[i]!) / length, yb: yFoot + (rise * along[i + 1]!) / length, width, blend });
      }
    }
  }
  return out;
};

/**
 * The grid at `cell` where its own cell is coarser and a whole multiple of it, else as it is.
 * Bilinear between the old points, so the surface is the same and so are the edges a neighbour
 * meets (ADR-0043's seams); only the points a ramp then shapes move.
 */
export const refineGrid = (g: TerrainGrid, cell: number): TerrainGrid => {
  const k = Math.round(g.cell / cell);
  if (k < 2 || Math.abs(g.cell / cell - k) > 1e-9) return g;
  const cols = (g.cols - 1) * k + 1;
  const rows = (g.rows - 1) * k + 1;
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(terrainHeightAt(g, g.originX + c * cell, g.originZ + r * cell));
  return { originX: g.originX, originZ: g.originZ, cell, cols, rows, heights };
};

/** The grid refined to `FLIGHT_CELL` when the band of one of `ramps` (flights' ramps), grown by a cell, reaches over it; else as it is. */
export const flightGrid = (g: TerrainGrid, ramps: readonly Ramp[]): TerrainGrid => {
  const [maxX, maxZ] = [g.originX + (g.cols - 1) * g.cell, g.originZ + (g.rows - 1) * g.cell];
  const reaches = (p: Ramp) => {
    const m = p.width / 2 + p.blend + g.cell;
    return Math.min(p.a.x, p.b.x) - m <= maxX && Math.max(p.a.x, p.b.x) + m >= g.originX && Math.min(p.a.z, p.b.z) - m <= maxZ && Math.max(p.a.z, p.b.z) + m >= g.originZ;
  };
  return ramps.some(reaches) ? refineGrid(g, FLIGHT_CELL) : g;
};
