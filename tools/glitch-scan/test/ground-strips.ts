import type { GroundSurface } from "../../../packages/core/src";
import { SQUARE } from "../src/scan-keys.ts";

/**
 * The ground of the generated tables (`*.generated.ts`) as ADR-0078 measures it, stage 1: what the
 * move of the import's polygon operations to Clipper2 is to bring down, counted before it does.
 * - `ground-ring-self-cross`: an outline of a ground piece two of whose edges cross, adjacent ones
 *   aside (G-659; the import's `selfIntersects`, the prototype's measure). Stage 2 (the line buffer
 *   on `inflatePaths`) is to take it to 0.
 * - `ground-strip-overlap`: m² of a chunk covered by two pieces or more, on a 0.25 m raster at the
 *   cells' centres (the prototype's `bench/ground-metrics.ts`). Large today by design: the import
 *   lays the strips over each other in draw order; stage 3 (a partition of the plane) is to take it
 *   to about 0.
 * - `ground-strip-gap`: m² of bare cells of that raster with ground within 0.75 m on both sides,
 *   along x or along z: gaps up to 1.25 m wide between the strips (one to 0.75 m counted whole, a
 *   wider one by its middle, the cells 0.75 m from both sides). Stage 5 (a morphological
 *   closing) is to bring it down by most of it.
 * The pieces on bridges stay out of all three, as in the prototype: they lie apart, on the deck.
 * The areas are findings one per m² (rounded in each 10 m square of the scan's keys), each at a cell it counts.
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = { readonly x: number; readonly z: number };
type Bounds = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** A chunk's ground as the tables hold it: flat outlines, `[x0, z0, x1, z1, …]`. */
export interface GroundChunk {
  readonly id: string;
  readonly bounds: Bounds;
  readonly ground: readonly { readonly surface: GroundSurface; readonly outline: readonly number[]; readonly bridge?: true }[];
}

/** Raster cell (m), as in ADR-0078's measurement. */
export const STRIP_CELL = 0.25;
/** A bare cell is a gap with ground within this many cells of it on both sides (gaps up to 1.25 m). */
export const GAP_REACH = 3;
const CELLS_PER_M2 = 1 / (STRIP_CELL * STRIP_CELL);

const pointsOf = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

const orient = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
/** Proper crossing, as the import's `segmentsCross`: touching and collinear edges do not count. */
const cross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const [d1, d2, d3, d4] = [orient(c, d, a), orient(c, d, b), orient(a, b, c), orient(a, b, d)];
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};

/**
 * True when two non-adjacent edges of the ring cross: the import's `selfIntersects`, with its edges
 * swept along x (sorted by their left ends) instead of tried pair by pair.
 */
export const ringCrossesItself = (ring: readonly Pt[]): boolean => {
  const n = ring.length;
  if (n < 4) return false;
  const lo = (i: number) => Math.min(ring[i]!.x, ring[(i + 1) % n]!.x);
  const hi = (i: number) => Math.max(ring[i]!.x, ring[(i + 1) % n]!.x);
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => lo(p) - lo(q));
  for (let a = 0; a < n; a++) {
    const i = order[a]!;
    const right = hi(i);
    for (let b = a + 1; b < n && lo(order[b]!) <= right; b++) {
      const j = order[b]!;
      const gap = Math.abs(i - j);
      if (gap <= 1 || gap === n - 1) continue;
      if (cross(ring[i]!, ring[(i + 1) % n]!, ring[j]!, ring[(j + 1) % n]!)) return true;
    }
  }
  return false;
};

/** `ground-ring-self-cross`: one per outline of the ground, off the bridges, that crosses itself. */
export const groundRingSelfCross = (chunks: readonly GroundChunk[]): Finding[] =>
  chunks.flatMap((c) =>
    c.ground.flatMap((g) => {
      if (g.bridge) return [];
      const ring = pointsOf(g.outline);
      if (!ringCrossesItself(ring)) return [];
      const x = ring.reduce((s, p) => s + p.x, 0) / ring.length;
      const z = ring.reduce((s, p) => s + p.z, 0) / ring.length;
      return [{ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${c.id}: ${g.surface}, ${ring.length} points` }];
    }),
  );

/** A chunk's raster: the pieces over each cell (capped at 255), filled even-odd at the cells' centres. */
export interface StripRaster {
  readonly bounds: Bounds;
  readonly w: number;
  readonly h: number;
  readonly count: Uint8Array;
}

/** Scanline fill of every ground piece of the chunk off the bridges (the prototype's `rasterize`). */
export const stripRaster = (chunk: GroundChunk): StripRaster => {
  const b = chunk.bounds;
  const w = Math.round((b.maxX - b.minX) / STRIP_CELL);
  const h = Math.round((b.maxZ - b.minZ) / STRIP_CELL);
  const count = new Uint8Array(w * h);
  for (const g of chunk.ground) {
    if (g.bridge || g.outline.length < 6) continue;
    const ring = pointsOf(g.outline);
    let [z0, z1] = [Infinity, -Infinity];
    for (const p of ring) [z0, z1] = [Math.min(z0, p.z), Math.max(z1, p.z)];
    const r0 = Math.max(0, Math.floor((z0 - b.minZ) / STRIP_CELL));
    const r1 = Math.min(h - 1, Math.ceil((z1 - b.minZ) / STRIP_CELL));
    for (let row = r0; row <= r1; row++) {
      const z = b.minZ + (row + 0.5) * STRIP_CELL;
      const xs: number[] = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [p, q] = [ring[i]!, ring[j]!];
        if (p.z > z !== q.z > z) xs.push(p.x + ((z - p.z) * (q.x - p.x)) / (q.z - p.z));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k]! - b.minX) / STRIP_CELL - 0.5));
        const c1 = Math.min(w - 1, Math.ceil((xs[k + 1]! - b.minX) / STRIP_CELL - 0.5) - 1);
        for (let c = c0; c <= c1; c++) if (count[row * w + c]! < 255) count[row * w + c]!++;
      }
    }
  }
  return { bounds: b, w, h, count };
};

/** A cell of the raster that overlaps: two pieces or more over it. */
const overlapCell = ({ w, count }: StripRaster) => (c: number, r: number): boolean => count[r * w + c]! > 1;

/** A bare cell with ground within `GAP_REACH` cells on both sides, along x or along z (the prototype's `gapCells`). */
const gapCell = ({ w, h, count }: StripRaster) => {
  const covered = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && count[r * w + c]! > 0;
  const near = (c: number, r: number, dc: number, dr: number) => {
    for (let k = 1; k <= GAP_REACH; k++) if (covered(c + dc * k, r + dr * k)) return true;
    return false;
  };
  return (c: number, r: number): boolean =>
    count[r * w + c] === 0 && ((near(c, r, -1, 0) && near(c, r, 1, 0)) || (near(c, r, 0, -1) && near(c, r, 0, 1)));
};

/**
 * One finding per m² of the cells `pick` takes from each chunk's raster, rounded in each square of
 * the scan's keys (`SQUARE`, by the finding's place): the cells are counted square by square and a
 * finding falls on every 16th, half a square metre in. Not counted on across the city (G-756): a
 * piece moved in one chunk then moved the findings of every cell after it, in that chunk and the
 * next ones, and squares far from it gained or lost their key.
 */
const perSquareMetre = (rasters: readonly StripRaster[], pick: (r: StripRaster) => (c: number, r: number) => boolean, what: string): Finding[] => {
  const out: Finding[] = [];
  // A square of the keys, `scan-keys.ts`'s: the place rounded to the metre, then its square. A
  // chunk's last half metre rounds into the next chunk's square, counted apart in each chunk.
  const square = (v: number) => Math.floor(Number(v.toFixed(0)) / SQUARE);
  for (const raster of rasters) {
    const counts = pick(raster);
    const { minX, minZ } = raster.bounds;
    const [x0, z0] = [square(minX + STRIP_CELL / 2), square(minZ + STRIP_CELL / 2)];
    // Each column's square from the chunk's first, each row's first counter.
    const col = Int32Array.from({ length: raster.w }, (_, c) => square(minX + (c + 0.5) * STRIP_CELL) - x0);
    const nx = (col[raster.w - 1] ?? 0) + 1;
    const rows = Int32Array.from({ length: raster.h }, (_, r) => (square(minZ + (r + 0.5) * STRIP_CELL) - z0) * nx);
    const counted = new Int32Array(nx * ((rows[raster.h - 1] ?? 0) / nx + 1));
    for (let r = 0; r < raster.h; r++) {
      const row = rows[r]!;
      for (let c = 0; c < raster.w; c++) {
        if (!counts(c, r) || counted[row + col[c]!]!++ % CELLS_PER_M2 !== CELLS_PER_M2 / 2 - 1) continue;
        const x = minX + (c + 0.5) * STRIP_CELL;
        const z = minZ + (r + 0.5) * STRIP_CELL;
        out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${what} ${x.toFixed(2)},${z.toFixed(2)}` });
      }
    }
  }
  return out;
};

/** `ground-strip-overlap`: m² of the city's ground under two pieces or more. */
export const groundStripOverlap = (rasters: readonly StripRaster[]): Finding[] => perSquareMetre(rasters, overlapCell, "overlap");

/** `ground-strip-gap`: m² of bare gaps up to 1.25 m wide between the city's ground pieces. */
export const groundStripGap = (rasters: readonly StripRaster[]): Finding[] => perSquareMetre(rasters, gapCell, "gap");
