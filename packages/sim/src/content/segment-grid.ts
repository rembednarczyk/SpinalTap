import type { GroundPoint } from "@seki/core";

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

/** Segments bucketed by 8 m, for the distance from a point to the nearest (the content's routes, lanes and flights). */
export class SegmentGrid {
  private readonly cells = new Map<string, [Pt, Pt][]>();
  private static readonly CELL = 8;

  add(a: Pt, b: Pt): void {
    const c = SegmentGrid.CELL;
    for (let i = Math.floor(Math.min(a.x, b.x) / c); i <= Math.floor(Math.max(a.x, b.x) / c); i++) {
      for (let k = Math.floor(Math.min(a.z, b.z) / c); k <= Math.floor(Math.max(a.z, b.z) / c); k++) {
        const key = `${i}:${k}`;
        const list = this.cells.get(key);
        if (list) list.push([a, b]);
        else this.cells.set(key, [[a, b]]);
      }
    }
  }

  /** Is (x, z) closer than `r` (at most a cell) to a segment; with `across`, only to one crossing that direction at 30 degrees and more? */
  near(x: number, z: number, r: number, across?: Pt): boolean {
    const c = SegmentGrid.CELL;
    const cx = Math.floor(x / c);
    const cz = Math.floor(z / c);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let k = cz - 1; k <= cz + 1; k++) {
        for (const [a, b] of this.cells.get(`${i}:${k}`) ?? []) {
          if (across && Math.abs(sineOf(across, { x: b.x - a.x, z: b.z - a.z })) < CROSS_SINE) continue;
          if (segmentDistance(x, z, a, b) < r) return true;
        }
      }
    }
    return false;
  }
}

/** The sine of the angle between two directions. */
export const sineOf = (u: Pt, v: Pt): number => (u.x * v.z - u.z * v.x) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z) || 1);
