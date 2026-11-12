import type { Rect } from "../content/builders";

/** Edge of a bucket of the chunk index, metres. */
const BUCKET = 64;
/** Cells of the plane whose candidates are kept, at most: past it they are found anew. */
const MAX_CELLS = 1 << 16;
/** Cells further than this many buckets (500 km) off the chunks ask every chunk; nearer ones have a small-integer key. */
const FAR = 1 << 13;
/** Slack of the candidates' test, metres: rounding never leaves the nearest chunk out. */
const SLACK = 1e-6;

const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
export const distanceTo = (r: Rect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
/** Least distance between a point of one rectangle and a point of the other. */
const rectGap = (a: Rect, b: Rect): number => Math.hypot(Math.max(a.minX - b.maxX, 0, b.minX - a.maxX), Math.max(a.minZ - b.maxZ, 0, b.minZ - a.maxZ));
/** Greatest distance from a point of `cell` to `r`: at a corner, the distance to a box being convex. */
const farthest = (r: Rect, cell: Rect): number =>
  Math.max(distanceTo(r, cell.minX, cell.minZ), distanceTo(r, cell.maxX, cell.minZ), distanceTo(r, cell.minX, cell.maxZ), distanceTo(r, cell.maxX, cell.maxZ));

/**
 * Which chunk's ground is used at a point (ADR-0043): the first in table order holding it, found
 * in a bucket of a fixed grid; outside every chunk the nearest one, the first among equals, the
 * shafts left out. The nearest is looked for among the candidates of the point's cell of the
 * plane, found once per cell (G-391): a ray far off the map asked every chunk at every step.
 * Not core's `SpatialHash`, on purpose: the ground is asked at every step of every ray, so the
 * buckets are a dense array anchored at the chunks' corner, read without a hash or an allocation,
 * and each cell of the plane keeps its nearest candidates, a state a grid of items has no place for.
 */
export class ChunkIndex {
  private readonly x0: number;
  private readonly z0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: readonly (readonly number[])[];
  private readonly near = new Map<number, readonly number[]>();
  /** The cell asked last, and its candidates: a ray steps through one cell many times running. */
  private lastKey = -1;
  private lastNear: readonly number[] = [];

  /** `bounds` in table order, the first `cuts` of them shafts; not `bucketed`, only the nearest is looked for (the old flat street). */
  constructor(
    private readonly bounds: readonly Rect[],
    private readonly cuts: number,
    bucketed: boolean,
  ) {
    const minX = Math.min(...bounds.map((b) => b.minX), 0);
    const minZ = Math.min(...bounds.map((b) => b.minZ), 0);
    const maxX = Math.max(...bounds.map((b) => b.maxX), 0);
    const maxZ = Math.max(...bounds.map((b) => b.maxZ), 0);
    this.x0 = minX;
    this.z0 = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / BUCKET) + 1);
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / BUCKET) + 1);
    const buckets: number[][] = Array.from({ length: this.cols * this.rows }, () => []);
    if (bucketed) {
      bounds.forEach((b, i) => {
        const [c0, c1] = [Math.floor((b.minX - minX) / BUCKET), Math.floor((b.maxX - minX) / BUCKET)];
        const [r0, r1] = [Math.floor((b.minZ - minZ) / BUCKET), Math.floor((b.maxZ - minZ) / BUCKET)];
        for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) buckets[r * this.cols + col]?.push(i);
      });
    }
    this.buckets = buckets;
  }

  /** Index of the chunk whose ground is used at (x, z), or -1 with no chunks. */
  at(x: number, z: number): number {
    const col = Math.floor((x - this.x0) / BUCKET);
    const row = Math.floor((z - this.z0) / BUCKET);
    if (col >= 0 && row >= 0 && col < this.cols && row < this.rows) {
      for (const i of this.buckets[row * this.cols + col] ?? []) if (inside(this.bounds[i] as Rect, x, z)) return i;
    }
    const near = this.candidates(col, row);
    // One candidate is the nearest at any finite point (at an infinite one no chunk is nearer than Infinity).
    if (near.length === 1 && Number.isFinite(x) && Number.isFinite(z)) return near[0] as number;
    let best = -1;
    let bestD = Infinity;
    for (const i of near) {
      const d = distanceTo(this.bounds[i] as Rect, x, z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** The chunks that may be nearest to a point of the cell (`nearest`), kept per cell. */
  private candidates(col: number, row: number): readonly number[] {
    if (!(Math.abs(col) <= FAR && Math.abs(row) <= FAR)) return this.nearest(null);
    const key = (col + FAR) * (2 * FAR + 1) + (row + FAR);
    if (key === this.lastKey) return this.lastNear;
    let found = this.near.get(key);
    if (!found) {
      if (this.near.size >= MAX_CELLS) this.near.clear();
      const x = this.x0 + col * BUCKET;
      const z = this.z0 + row * BUCKET;
      found = this.nearest({ minX: x, maxX: x + BUCKET, minZ: z, maxZ: z + BUCKET });
      this.near.set(key, found);
    }
    this.lastKey = key;
    this.lastNear = found;
    return found;
  }

  /**
   * The chunks (no shafts) in table order no further from the cell than the least of their
   * farthest distances from it, or all of them without a cell. A point's nearest chunk is no
   * further from it than that, so it and every chunk as near are among them, and the first of
   * the nearest is the one all the chunks give.
   */
  private nearest(cell: Rect | null): number[] {
    const out: number[] = [];
    let reach = Infinity;
    if (cell) for (let i = this.cuts; i < this.bounds.length; i++) reach = Math.min(reach, farthest(this.bounds[i] as Rect, cell));
    for (let i = this.cuts; i < this.bounds.length; i++) if (!cell || rectGap(this.bounds[i] as Rect, cell) <= reach + SLACK) out.push(i);
    return out;
  }
}
