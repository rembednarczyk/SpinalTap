import type { Vec3 } from "@seki/core";
import type { Rect } from "../content/builders";

/**
 * The plain geometry of the ground's ray (`GroundField.rayHit`, ADR-0043): through the chunks'
 * rectangles and the cells of their grids, and into the quadratic of the terrain within a cell.
 */

/** Is (x, z) in the rectangle, edges included? */
export const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** Distance along the ray (XZ part of `dir`) from (x, z) to where it leaves the rectangle; -1 when outside. */
export const rectExit = (r: Rect, x: number, z: number, dir: Vec3): number => {
  if (!inside(r, x, z)) return -1;
  const tx = dir.x > 1e-12 ? (r.maxX - x) / dir.x : dir.x < -1e-12 ? (r.minX - x) / dir.x : Infinity;
  const tz = dir.z > 1e-12 ? (r.maxZ - z) / dir.z : dir.z < -1e-12 ? (r.minZ - z) / dir.z : Infinity;
  return Math.min(tx, tz);
};

/** The span [lo, hi] of ray distances where a coordinate `p` moving at `d` per metre is within [min, max]; null when never. */
const slab = (p: number, d: number, min: number, max: number): readonly [number, number] | null => {
  if (Math.abs(d) <= 1e-12) return p < min || p > max ? null : [-Infinity, Infinity];
  const a = (min - p) / d;
  const b = (max - p) / d;
  return a < b ? [a, b] : [b, a];
};

/** Distance along the ray (XZ part of `dir`) from (x, z) outside the rectangle to where it goes in; Infinity when it never does. */
export const rectEntry = (r: Rect, x: number, z: number, dir: Vec3): number => {
  if (inside(r, x, z)) return Infinity;
  const sx = slab(x, dir.x, r.minX, r.maxX);
  const sz = sx && slab(z, dir.z, r.minZ, r.maxZ);
  if (!sx || !sz) return Infinity;
  const lo = Math.max(0, sx[0], sz[0]);
  return lo <= Math.min(sx[1], sz[1]) ? lo : Infinity;
};

/**
 * Ray distance to the next grid line of a coordinate `f` (in cells) moving at `df` cells per
 * metre, among the lines 0..last (outside them the grid is clamped: the height does not change
 * along that axis). Infinity when there is none ahead.
 */
export const nextLine = (f: number, df: number, last: number): number => {
  if (Math.abs(df) < 1e-12) return Infinity;
  if (df > 0) {
    if (f >= last) return Infinity;
    const target = f < 0 ? 0 : Math.floor(f + 1e-9) + 1;
    return (Math.min(target, last) - f) / df;
  }
  if (f <= 0) return Infinity;
  const target = f > last ? last : Math.ceil(f - 1e-9) - 1;
  return (Math.max(target, 0) - f) / df;
};

/**
 * First u in [0, 1] where the quadratic through (0, f0), (½, fm), (1, f1) goes below zero, or
 * null. Inside one grid cell the ray's height above the terrain is exactly such a quadratic.
 */
export const firstBelow = (f0: number, fm: number, f1: number): number | null => {
  if (f0 < 0) return 0;
  const a = 2 * f0 - 4 * fm + 2 * f1;
  const b = -3 * f0 + 4 * fm - f1;
  if (Math.abs(a) < 1e-12) {
    if (b >= 0) return null;
    const r = -f0 / b;
    return r <= 1 ? r : null;
  }
  const disc = b * b - 4 * a * f0;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const lo = Math.min((-b - s) / (2 * a), (-b + s) / (2 * a));
  const hi = Math.max((-b - s) / (2 * a), (-b + s) / (2 * a));
  // f0 >= 0: a dip (a > 0) goes below between the roots, an arch (a < 0) after the second.
  const r = a > 0 ? lo : hi;
  return r >= 0 && r <= 1 ? r : null;
};
