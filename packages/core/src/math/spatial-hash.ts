/**
 * A uniform grid over the XZ plane: the Spatial Partition pattern of "Game Programming Patterns"
 * (Robert Nystrom), in its fixed-grid, spatial-hash form. An item goes into every cell of side
 * `cell` its box touches (cell `floor(x / cell)`, `floor(z / cell)`), and a query visits the
 * cells of a box and hands back the items whose boxes meet it, each once. Unlike the book's grid
 * of linked units, cells live in a hash map, so the plane has no bounds, and items are boxes, not
 * points; a moved item is taken out and put back (`remove`, `insert`).
 *
 * The simulation is deterministic, so `query` and `at` give the items in the order they went in.
 * Boxes are closed: one touching the query's edge meets it. Self-contained, so the importer's
 * tools load it by path.
 */

/** Cells this far off the origin have a numeric key; further ones a string (4 m cells: 4000 km). */
const NEAR = 1 << 20;

type Key = number | string;

const keyOf = (i: number, k: number): Key => (i > -NEAR && i < NEAR && k > -NEAR && k < NEAR ? (i + NEAR) * 2 * NEAR + (k + NEAR) : `${i}:${k}`);

export class SpatialHash<T> {
  /** The handles of the items in each cell, ascending: the order they went in. */
  private readonly cells = new Map<Key, number[]>();
  private readonly items: (T | undefined)[] = [];
  /** minX, minZ, maxX, maxZ of each handle; NaN once removed. */
  private readonly boxes: number[] = [];
  /** The query each handle was last seen by, so an item in many cells comes back once. */
  private readonly seen: number[] = [];
  private stamp = 0;
  private count = 0;

  /** `cell`: side of a cell (m), above 0. */
  constructor(readonly cell: number) {
    if (!(cell > 0)) throw new Error(`SpatialHash: cell ${cell} must be above 0`);
  }

  /** Items in the grid. */
  get size(): number {
    return this.count;
  }

  /** Puts `item` in every cell its box touches; the handle `remove` takes. */
  insert(item: T, minX: number, minZ: number, maxX: number, maxZ: number): number {
    const h = this.items.length;
    this.items.push(item);
    this.boxes.push(minX, minZ, maxX, maxZ);
    this.seen.push(0);
    this.count++;
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let k = Math.floor(minZ / c); k <= Math.floor(maxZ / c); k++) {
        const key = keyOf(i, k);
        const list = this.cells.get(key);
        if (list) list.push(h);
        else this.cells.set(key, [h]);
      }
    }
    return h;
  }

  /** Puts `item` in the cell of the point (`x`, `z`). */
  insertPoint(item: T, x: number, z: number): number {
    return this.insert(item, x, z, x, z);
  }

  /** Takes out the item of `handle` (a handle once removed is ignored). */
  remove(handle: number): void {
    const b = this.boxes;
    const minX = b[4 * handle];
    if (minX === undefined || Number.isNaN(minX)) return;
    const [minZ, maxX, maxZ] = [b[4 * handle + 1] as number, b[4 * handle + 2] as number, b[4 * handle + 3] as number];
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let k = Math.floor(minZ / c); k <= Math.floor(maxZ / c); k++) {
        const key = keyOf(i, k);
        const list = this.cells.get(key);
        const at = list?.indexOf(handle) ?? -1;
        if (!list || at < 0) continue;
        list.splice(at, 1);
        if (list.length === 0) this.cells.delete(key);
      }
    }
    this.items[handle] = undefined;
    this.count--;
    b[4 * handle] = b[4 * handle + 1] = b[4 * handle + 2] = b[4 * handle + 3] = NaN;
  }

  /** Empties the grid; handles start again from 0. */
  clear(): void {
    this.cells.clear();
    this.items.length = 0;
    this.boxes.length = 0;
    this.seen.length = 0;
    this.stamp = 0;
    this.count = 0;
  }

  /** Items whose boxes hold the point (`x`, `z`), in the order they went in. */
  at(x: number, z: number): T[] {
    const out: T[] = [];
    const list = this.cells.get(keyOf(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return out;
    const b = this.boxes;
    for (const h of list) {
      const o = 4 * h;
      if (x >= (b[o] as number) && x <= (b[o + 2] as number) && z >= (b[o + 1] as number) && z <= (b[o + 3] as number)) out.push(this.items[h] as T);
    }
    return out;
  }

  /** Items whose boxes meet the box, each once, in the order they went in. */
  query(minX: number, minZ: number, maxX: number, maxZ: number): T[] {
    const found: number[] = [];
    const cells = this.collect(minX, minZ, maxX, maxZ, (h) => {
      found.push(h);
      return false;
    });
    // One cell's handles are ascending already; from more, they are sorted back into order.
    if (cells > 1 && found.length > 1) found.sort((p, q) => p - q);
    return found.map((h) => this.items[h] as T);
  }

  /** Items whose boxes meet the square `r` round (`x`, `z`): `query` of that box. */
  queryRadius(x: number, z: number, r: number): T[] {
    return this.query(x - r, z - r, x + r, z + r);
  }

  /**
   * Calls `visit` with each item whose box meets the box, once, cell by cell (not the order of
   * `query`, but the same for the same grid), until it returns true; whether one did. For the
   * hot loops that need no order: it neither sorts nor allocates.
   */
  some(minX: number, minZ: number, maxX: number, maxZ: number, visit: (item: T) => boolean): boolean {
    let hit = false;
    this.collect(minX, minZ, maxX, maxZ, (h) => (hit = visit(this.items[h] as T)));
    return hit;
  }

  /** Walks the cells of the box with each new handle meeting it until `take` says stop; the cells walked. */
  private collect(minX: number, minZ: number, maxX: number, maxZ: number, take: (h: number) => boolean): number {
    const stamp = ++this.stamp;
    const [c, b, seen] = [this.cell, this.boxes, this.seen];
    let cells = 0;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let k = Math.floor(minZ / c); k <= Math.floor(maxZ / c); k++) {
        cells++;
        const list = this.cells.get(keyOf(i, k));
        if (!list) continue;
        for (const h of list) {
          if (seen[h] === stamp) continue;
          seen[h] = stamp;
          const o = 4 * h;
          if ((b[o + 2] as number) < minX || (b[o] as number) > maxX || (b[o + 3] as number) < minZ || (b[o + 1] as number) > maxZ) continue;
          if (take(h)) return cells;
        }
      }
    }
    return cells;
  }
}
