/**
 * Rings by the 10 m cells their boxes reach, for many point-in-ring queries (`kerbFills` marches
 * out from every half metre of every carriageway's edge). A cell, when first asked, keeps of each
 * ring only the edges a ray from one of its points to +x may cross, so a long carriageway's or a
 * park's ring is not walked whole for every point; the test on the edges kept is `pointInRing`'s,
 * the answer the same.
 *
 * Not core's `SpatialHash`, on purpose: the cells are a dense array over the items' extent (a
 * hash map's lookup was much of a march's time) and each keeps a state of its own, the clipped
 * edges, that a grid of items has no place for.
 */
import { type Pt, type Rect } from "./geometry.ts";

const CELL = 10;
/** Slack round a cell for the rounding of `Math.floor(p / CELL)` (m): an edge kept on the fence is only tested. */
const EPS = 1e-6;

type Cell<T> = { readonly i: number; readonly k: number; readonly items: T[]; edges?: (readonly number[])[] };

/** The edges of `ring` (ends `a` = `ring[i]`, `b` = `ring[i - 1]`, as `pointInRing` pairs them) a ray to +x from a point of cell `i`, `k` may cross. */
const cellEdges = (ring: readonly Pt[], i: number, k: number): readonly number[] => {
  const [x0, z0, z1] = [i * CELL - EPS, k * CELL - EPS, (k + 1) * CELL + EPS];
  const out: number[] = [];
  for (let a = 0, j = ring.length - 1; a < ring.length; j = a++) {
    const p = ring[a]!;
    const q = ring[j]!;
    if ((p.z < z1 || q.z < z1) && (p.z > z0 || q.z > z0) && (p.x > x0 || q.x > x0)) out.push(p.x, p.z, q.x, q.z);
  }
  return out;
};

// Not `pointInRingEvenOdd` of core: the same rule, but over a flat list of edges of several rings (ax, az, bx, bz), not one ring's points.
const inside = (x: number, z: number, e: readonly number[]): boolean => {
  let odd = false;
  for (let n = 0; n < e.length; n += 4) {
    const ax = e[n]!;
    const az = e[n + 1]!;
    const bx = e[n + 2]!;
    const bz = e[n + 3]!;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) odd = !odd;
  }
  return odd;
};

export class RingBins<T extends { readonly box: Rect; readonly ring: readonly Pt[] }> {
  /** The cells of the items' extent, row by row: an array, as a map's lookup was much of a march's time. */
  private readonly cells: (Cell<T> | undefined)[] = [];
  private readonly i0: number;
  private readonly k0: number;
  private readonly ni: number;
  private readonly nk: number;
  constructor(items: readonly T[]) {
    let [i0, i1, k0, k1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const { box } of items) {
      [i0, i1] = [Math.min(i0, Math.floor(box.minX / CELL)), Math.max(i1, Math.floor(box.maxX / CELL))];
      [k0, k1] = [Math.min(k0, Math.floor(box.minZ / CELL)), Math.max(k1, Math.floor(box.maxZ / CELL))];
    }
    [this.i0, this.k0] = items.length > 0 ? [i0, k0] : [0, 0];
    [this.ni, this.nk] = items.length > 0 ? [i1 - i0 + 1, k1 - k0 + 1] : [0, 0];
    for (const item of items)
      for (let i = Math.floor(item.box.minX / CELL); i <= Math.floor(item.box.maxX / CELL); i++)
        for (let k = Math.floor(item.box.minZ / CELL); k <= Math.floor(item.box.maxZ / CELL); k++) {
          const n = (i - this.i0) * this.nk + (k - this.k0);
          const cell = this.cells[n];
          if (cell) cell.items.push(item);
          else this.cells[n] = { i, k, items: [item] };
        }
  }
  /** Whether a ring holds the point (`x`, `z`). */
  holds(x: number, z: number): boolean {
    return this.scan(x, z, () => true);
  }
  /** Calls `found` with each item whose ring holds the point (`x`, `z`), in order, until it says stop; whether it did. */
  scan(x: number, z: number, found: (item: T) => boolean): boolean {
    const [i, k] = [Math.floor(x / CELL) - this.i0, Math.floor(z / CELL) - this.k0];
    if (i < 0 || i >= this.ni || k < 0 || k >= this.nk) return false;
    const cell = this.cells[i * this.nk + k];
    if (!cell) return false;
    const edges = (cell.edges ??= cell.items.map((it) => cellEdges(it.ring, cell.i, cell.k)));
    for (let n = 0; n < cell.items.length; n++) {
      const b = cell.items[n]!.box;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && inside(x, z, edges[n]!) && found(cell.items[n]!)) return true;
    }
    return false;
  }
}
