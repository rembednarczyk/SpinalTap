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
}

/** A corridor of even grade from `a` (height `ya`) to `b` (height `yb`), `width` wide, blending over `blend`. */
export interface Ramp {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly ya: number;
  readonly yb: number;
  readonly width: number;
  readonly blend: number;
}

/** 1 inside, 0 beyond `blend`, smooth between. */
const weight = (d: number, blend: number): number => {
  if (d <= 0) return 1;
  if (d >= blend) return 0;
  const t = 1 - d / blend;
  return t * t * (3 - 2 * t);
};

const rectDistance = (r: GroundRect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** Height at (x, z) after the ramps and then the pads, from the original height `h`. */
export const shapeHeight = (x: number, z: number, h: number, pads: readonly Pad[], ramps: readonly Ramp[]): number => {
  let out = h;
  for (const r of ramps) {
    const dx = r.b.x - r.a.x;
    const dz = r.b.z - r.a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - r.a.x) * dx + (z - r.a.z) * dz) / len2));
    const d = Math.hypot(x - r.a.x - t * dx, z - r.a.z - t * dz) - r.width / 2;
    const w = weight(d, r.blend);
    if (w > 0) out += (r.ya + (r.yb - r.ya) * t - out) * w;
  }
  for (const p of pads) {
    const w = weight(rectDistance(p.rect, x, z), p.blend);
    if (w > 0) out += (p.y - out) * w;
  }
  return out;
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
 * Ramps along every flight of steps of the map (`highway=steps`): one per segment, from the
 * terrain at its ends, so a path down a scarp walks at an even grade.
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
