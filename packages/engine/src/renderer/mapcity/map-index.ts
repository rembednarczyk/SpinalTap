import { SpatialHash } from "@seki/core";
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

/**
 * Ids by the 32 m bins their boxes touch, core's `SpatialHash`: candidates for point queries.
 * Each id is in once; adding it again moves it.
 */
export class BinIndex {
  private readonly grid = new SpatialHash<number>(BIN);
  private readonly handles = new Map<number, number>();

  add(id: number, box: Box2): void {
    this.remove(id);
    this.handles.set(id, this.grid.insert(id, box.minX, box.minZ, box.maxX, box.maxZ));
  }

  remove(id: number): void {
    const handle = this.handles.get(id);
    if (handle === undefined) return;
    this.handles.delete(id);
    this.grid.remove(handle);
  }

  /** Ids whose box contains (x, z), in the order they were added. */
  at(x: number, z: number): Iterable<number> {
    return this.grid.at(x, z);
  }

  /** Ids whose box meets `box`, each once, in the order they were added. */
  within(box: Box2): Set<number> {
    return new Set(this.grid.query(box.minX, box.minZ, box.maxX, box.maxZ));
  }
}
