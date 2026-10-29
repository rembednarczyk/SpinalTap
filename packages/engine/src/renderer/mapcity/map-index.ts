import type { Box2 } from "./polygon";

/** Side of the batching cells of the map city (m): one facade, signs and ground mesh each. */
export const MAP_CELL = 128;

/** Bin of the neighbour lookups (m). */
const BIN = 32;

export const cellKey = (x: number, z: number, size = MAP_CELL): string => `${Math.floor(x / size)}:${Math.floor(z / size)}`;

/** Keys of every cell of `size` a box touches. */
export const cellsOf = (b: Box2, size = MAP_CELL): string[] => {
  const out: string[] = [];
  for (let i = Math.floor(b.minX / size); i <= Math.floor(b.maxX / size); i++) {
    for (let j = Math.floor(b.minZ / size); j <= Math.floor(b.maxZ / size); j++) out.push(`${i}:${j}`);
  }
  return out;
};

export const cellBounds = (key: string, size = MAP_CELL): Box2 => {
  const [i, j] = key.split(":").map(Number) as [number, number];
  return { minX: i * size, maxX: (i + 1) * size, minZ: j * size, maxZ: (j + 1) * size };
};

export const grow = (b: Box2, d: number): Box2 => ({ minX: b.minX - d, maxX: b.maxX + d, minZ: b.minZ - d, maxZ: b.maxZ + d });

/** Ids by the 32 m bins their boxes touch: candidates for point queries. */
export class BinIndex {
  private readonly bins = new Map<string, Set<number>>();
  private readonly boxes = new Map<number, Box2>();

  add(id: number, box: Box2): void {
    this.remove(id);
    this.boxes.set(id, box);
    for (const k of cellsOf(box, BIN)) {
      let s = this.bins.get(k);
      if (!s) {
        s = new Set();
        this.bins.set(k, s);
      }
      s.add(id);
    }
  }

  remove(id: number): void {
    const box = this.boxes.get(id);
    if (!box) return;
    this.boxes.delete(id);
    for (const k of cellsOf(box, BIN)) {
      const s = this.bins.get(k);
      s?.delete(id);
      if (s && s.size === 0) this.bins.delete(k);
    }
  }

  /** Ids whose box contains (x, z). */
  *at(x: number, z: number): Iterable<number> {
    const s = this.bins.get(cellKey(x, z, BIN));
    if (!s) return;
    for (const id of s) {
      const b = this.boxes.get(id);
      if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) yield id;
    }
  }
}
