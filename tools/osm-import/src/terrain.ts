/**
 * Chunk terrain (ADR-0042): the NMT 1 m resampled on the world grid, smoothed, then sampled at
 * the coarsest cell that still follows it: about 2-4 m on the scarps of the Old Town and the
 * castle hill, 5-10 m on the flat. The contract's `TerrainGrid` has one cell per chunk, so a
 * chunk is as fine as its steepest part.
 */
import { type TerrainGrid } from "../../../packages/core/src/world/city-geo.ts";
import { type HeightSource } from "./dtm.ts";
import { type Rect, r1 } from "./geometry.ts";

/** Heights on a 1 m world lattice: `v[r * cols + c]` at (x0 + c, z0 + r). */
export interface Field {
  readonly x0: number;
  readonly z0: number;
  readonly cols: number;
  readonly rows: number;
  readonly v: Float64Array;
}

export const sampleField = (src: HeightSource, rect: Rect, pad: number): Field => {
  const x0 = rect.minX - pad;
  const z0 = rect.minZ - pad;
  const cols = Math.round(rect.maxX - rect.minX + 2 * pad) + 1;
  const rows = Math.round(rect.maxZ - rect.minZ + 2 * pad) + 1;
  const v = new Float64Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) v[r * cols + c] = src({ x: x0 + c, z: z0 + r });
  return { x0, z0, cols, rows, v };
};

/** Separable Gaussian blur with edge clamping. */
export const blur = (f: Field, sigma: number): Field => {
  if (sigma <= 0) return f;
  const rad = Math.ceil(sigma * 3);
  const k: number[] = [];
  for (let i = -rad; i <= rad; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const w = k.map((x) => x / sum);
  const pass = (src: Float64Array, horizontal: boolean): Float64Array => {
    const out = new Float64Array(src.length);
    for (let r = 0; r < f.rows; r++) {
      for (let c = 0; c < f.cols; c++) {
        let s = 0;
        for (let i = -rad; i <= rad; i++) {
          const cc = horizontal ? Math.min(Math.max(c + i, 0), f.cols - 1) : c;
          const rr = horizontal ? r : Math.min(Math.max(r + i, 0), f.rows - 1);
          s += w[i + rad]! * src[rr * f.cols + cc]!;
        }
        out[r * f.cols + c] = s;
      }
    }
    return out;
  };
  return { ...f, v: pass(pass(f.v, true), false) };
};

/** Bilinear value of the field at a world point (clamped). */
export const fieldAt = (f: Field, x: number, z: number): number => {
  const fx = Math.min(Math.max(x - f.x0, 0), f.cols - 1);
  const fz = Math.min(Math.max(z - f.z0, 0), f.rows - 1);
  const c0 = Math.min(Math.floor(fx), f.cols - 2);
  const r0 = Math.min(Math.floor(fz), f.rows - 2);
  const tx = fx - c0;
  const tz = fz - r0;
  const g = (r: number, c: number) => f.v[r * f.cols + c]!;
  return (g(r0, c0) * (1 - tx) + g(r0, c0 + 1) * tx) * (1 - tz) + (g(r0 + 1, c0) * (1 - tx) + g(r0 + 1, c0 + 1) * tx) * tz;
};

/** Cells tried, coarsest first; a cell must divide the chunk's sides so neighbours meet on a node. */
export const CELLS = [10, 8, 5, 4, 2.5, 2] as const;
/**
 * How closely the grid must follow the smoothed terrain (metres): 99 % of the 1 m points within
 * `p99`, none beyond `max`. Retaining walls and stairs are what usually breaks it.
 */
export const TERRAIN_TOLERANCE = { p99: 0.35, max: 1 } as const;
/** Smoothing of the 1 m model before anything is measured: removes kerbs, steps and survey noise. */
export const BASE_SIGMA = 1.5;

const divides = (len: number, cell: number) => Math.abs(len / cell - Math.round(len / cell)) < 1e-9;

export interface ChunkTerrain {
  readonly grid: TerrainGrid;
  readonly maxError: number;
  readonly p99Error: number;
}

const gridFrom = (f: Field, rect: Rect, cell: number, altitude: number): TerrainGrid => {
  const cols = Math.round((rect.maxX - rect.minX) / cell) + 1;
  const rows = Math.round((rect.maxZ - rect.minZ) / cell) + 1;
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(r1(fieldAt(f, rect.minX + c * cell, rect.minZ + r * cell) - altitude));
  return { originX: rect.minX, originZ: rect.minZ, cell, cols, rows, heights };
};

const gridAt = (g: TerrainGrid, x: number, z: number): number => {
  const fx = Math.min(Math.max((x - g.originX) / g.cell, 0), g.cols - 1);
  const fz = Math.min(Math.max((z - g.originZ) / g.cell, 0), g.rows - 1);
  const c0 = Math.min(Math.floor(fx), g.cols - 2);
  const r0 = Math.min(Math.floor(fz), g.rows - 2);
  const tx = fx - c0;
  const tz = fz - r0;
  const h = (r: number, c: number) => g.heights[r * g.cols + c]!;
  return (h(r0, c0) * (1 - tx) + h(r0, c0 + 1) * tx) * (1 - tz) + (h(r0 + 1, c0) * (1 - tx) + h(r0 + 1, c0 + 1) * tx) * tz;
};

/** The chunk's grid at the coarsest cell within `TERRAIN_TOLERANCE` of the smoothed 1 m model. */
export const chunkTerrain = (raw: Field, rect: Rect, altitude: number): ChunkTerrain => {
  const truth = blur(raw, BASE_SIGMA);
  const w = rect.maxX - rect.minX;
  const h = rect.maxZ - rect.minZ;
  const cells = CELLS.filter((c) => divides(w, c) && divides(h, c));
  let best: ChunkTerrain | null = null;
  for (const cell of cells) {
    const smooth = cell * 0.4 > BASE_SIGMA ? blur(raw, cell * 0.4) : truth;
    const grid = gridFrom(smooth, rect, cell, altitude);
    const errors: number[] = [];
    for (let z = rect.minZ; z <= rect.maxZ; z++) {
      for (let x = rect.minX; x <= rect.maxX; x++) errors.push(Math.abs(gridAt(grid, x, z) - (fieldAt(truth, x, z) - altitude)));
    }
    errors.sort((a, b) => a - b);
    best = { grid, maxError: errors[errors.length - 1]!, p99Error: errors[Math.floor(0.99 * (errors.length - 1))]! };
    if (best.maxError <= TERRAIN_TOLERANCE.max && best.p99Error <= TERRAIN_TOLERANCE.p99) return best;
  }
  if (!best) throw new Error(`no terrain cell divides ${w} × ${h}`);
  return best;
};
