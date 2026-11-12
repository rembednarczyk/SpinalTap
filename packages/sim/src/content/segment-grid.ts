import { type GroundPoint, SpatialHash } from "@seki/core";

type Pt = GroundPoint;

/** Horizontal distance from (x, z) to the segment a..b. */
export const segmentDistance = (x: number, z: number, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};

/** A line crosses another at 30 degrees and more (the import's rule for a way through a barrier, ADR-0077). */
const CROSS_SINE = 0.5;

/** Edge of a cell of the grid, metres. */
const CELL = 8;

/**
 * Segments in an 8 m `SpatialHash` by their boxes, for the distance from a point to the nearest
 * (the content's routes, lanes and flights).
 */
export class SegmentGrid {
  private readonly grid = new SpatialHash<readonly [Pt, Pt]>(CELL);

  add(a: Pt, b: Pt): void {
    this.grid.insert([a, b], Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
  }

  /** Calls `visit` once with each segment whose box comes within a cell of (x, z), every one within a cell of it among them. */
  eachNear(x: number, z: number, visit: (a: Pt, b: Pt) => void): void {
    this.grid.some(x - CELL, z - CELL, x + CELL, z + CELL, ([a, b]) => {
      visit(a, b);
      return false;
    });
  }

  /** Is (x, z) closer than `r` (at most a cell) to a segment; with `across`, only to one crossing that direction at 30 degrees and more? */
  near(x: number, z: number, r: number, across?: Pt): boolean {
    return this.grid.some(x - r, z - r, x + r, z + r, ([a, b]) => {
      if (across && Math.abs(sineOf(across, { x: b.x - a.x, z: b.z - a.z })) < CROSS_SINE) return false;
      return segmentDistance(x, z, a, b) < r;
    });
  }
}

/** The sine of the angle between two directions. */
export const sineOf = (u: Pt, v: Pt): number => (u.x * v.z - u.z * v.x) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z) || 1);
