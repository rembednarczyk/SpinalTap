/**
 * The dig of a building site (ADR-0087 step 3): a rectangle along the site's long axis over its
 * lowest free ground, 35-55% of the site's area (the share from the seed), dug `depth` m under the
 * lowest terrain in it and blending into the terrain over `blend` m round it. The blend and one
 * terrain cell past it (the grid is bilinear) stay on free ground inside the fence, so the fence,
 * the pavements and the walls round the site keep the map's terrain. Where it does not fit it
 * shrinks, down to `SMALLEST` of the site, else the site has no dig.
 */
import { type SiteGround } from "./construction-ground.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** Side of the raster the dig is fitted on (m). */
const R = 0.5;
/** Ratios of the rectangle's sides tried, its long side along the site's long axis first. */
const ASPECTS = [1, 1.5, 2.5, 1 / 1.5, 1 / 2.5];
/** The least share of the site's area a dig is, and the least area (m²). */
const SMALLEST = 0.15;
const LEAST = 25;
/** How much a dig that does not fit shrinks before the next try. */
const SHRINK = 0.85;

export interface DigPlan {
  /** The rectangle's corners, counter-clockwise. */
  readonly outline: readonly Pt[];
  /** The dig's floor (world y): the lowest terrain in it less `depth`. */
  readonly y: number;
  readonly depth: number;
  readonly blend: number;
  readonly area: number;
}

/** The depth and the blend of a dig from the seed's draw `t` in [0, 1): 1.2-1.6 m deep, its sides at about 1:2. */
export const digShape = (t: number): { readonly depth: number; readonly blend: number } => {
  const depth = Math.round((1.2 + 0.4 * t) * 100) / 100;
  return { depth, blend: Math.round((2 * depth + 0.6) * 100) / 100 };
};

/** Free ground in the ring on a raster along the axis `deg` (degrees from +x towards +z), with summed counts and heights. */
const raster = (ring: readonly Pt[], g: SiteGround, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const U = { x: Math.cos(a), z: Math.sin(a) };
  const V = { x: -Math.sin(a), z: Math.cos(a) };
  const us = ring.map((p) => p.x * U.x + p.z * U.z);
  const vs = ring.map((p) => p.x * V.x + p.z * V.z);
  const [u0, v0] = [Math.min(...us), Math.min(...vs)];
  const cols = Math.ceil((Math.max(...us) - u0) / R);
  const rows = Math.ceil((Math.max(...vs) - v0) / R);
  const W = cols + 1;
  // Summed-area tables of the free cells and of their heights, (cols + 1) x (rows + 1).
  const count = new Float64Array(W * (rows + 1));
  const sum = new Float64Array(W * (rows + 1));
  const world = (u: number, v: number): Pt => ({ x: U.x * u + V.x * v, z: U.z * u + V.z * v });
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = world(u0 + (i + 0.5) * R, v0 + (j + 0.5) * R);
      const ok = pointInRing(p, ring) && g.free(p);
      const k = (j + 1) * W + (i + 1);
      count[k] = (ok ? 1 : 0) + count[k - 1]! + count[k - W]! - count[k - W - 1]!;
      sum[k] = (ok ? g.heightAt(p) : 0) + sum[k - 1]! + sum[k - W]! - sum[k - W - 1]!;
    }
  const box = (t: Float64Array, i0: number, j0: number, i1: number, j1: number): number => t[j1 * W + i1]! - t[j0 * W + i1]! - t[j1 * W + i0]! + t[j0 * W + i0]!;
  return { cols, rows, u0, v0, world, count: (i0: number, j0: number, i1: number, j1: number) => box(count, i0, j0, i1, j1), heights: (i0: number, j0: number, i1: number, j1: number) => box(sum, i0, j0, i1, j1) };
};

/**
 * The dig of a site of `area` m² inside its fence's `ring`, its share `share` (0.35-0.55) of the
 * area, its shape from `digShape`, along the site's long axis `deg`; null where no dig of
 * `SMALLEST` of the area fits.
 */
export const planDig = (ring: readonly Pt[], area: number, g: SiteGround, deg: number, share: number, shape: { readonly depth: number; readonly blend: number }): DigPlan | null => {
  const r = raster(ring, g, deg);
  const c = ring.reduce((s, p) => ({ x: s.x + p.x / ring.length, z: s.z + p.z / ring.length }), { x: 0, z: 0 });
  // The blend, one terrain cell past it on the diagonal, and the fence's own clearance.
  const m = Math.ceil((shape.blend + g.cellAt(c) * Math.SQRT2 + 0.3) / R);
  for (let target = share * area; target >= Math.max(LEAST, SMALLEST * area); target *= SHRINK) {
    let best: { i: number; j: number; cu: number; cv: number; mean: number } | null = null;
    for (const aspect of ASPECTS) {
      const cu = Math.round(Math.sqrt(target * aspect) / R);
      const cv = Math.round(Math.sqrt(target / aspect) / R);
      for (let j = m; j + cv + m <= r.rows; j++)
        for (let i = m; i + cu + m <= r.cols; i++) {
          const grown = (cu + 2 * m) * (cv + 2 * m);
          if (r.count(i - m, j - m, i + cu + m, j + cv + m) < grown) continue;
          const mean = r.heights(i, j, i + cu, j + cv) / (cu * cv);
          if (!best || mean < best.mean - 1e-9) best = { i, j, cu, cv, mean };
        }
    }
    if (!best) continue;
    const { i, j, cu, cv } = best;
    const [ua, ub, va, vb] = [r.u0 + i * R, r.u0 + (i + cu) * R, r.v0 + j * R, r.v0 + (j + cv) * R];
    const outline = [r.world(ua, va), r.world(ub, va), r.world(ub, vb), r.world(ua, vb)].map((p) => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 }));
    let low = Infinity;
    for (let jj = 0; jj <= cv; jj++) for (let ii = 0; ii <= cu; ii++) low = Math.min(low, g.heightAt(r.world(ua + (ub - ua) * (ii / cu), va + (vb - va) * (jj / cv))));
    return { outline, y: Math.round((low - shape.depth) * 100) / 100, depth: shape.depth, blend: shape.blend, area: Math.round(cu * cv * R * R) };
  }
  return null;
};
