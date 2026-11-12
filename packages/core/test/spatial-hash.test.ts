import { describe, expect, it } from "vitest";
import { SpatialHash } from "../src";

type Box = { id: number; minX: number; minZ: number; maxX: number; maxZ: number };

/** A small linear congruential sequence: the test needs spread, not quality. */
const sequence = (seed: number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const boxes = (n: number, seed: number): Box[] => {
  const next = sequence(seed);
  return Array.from({ length: n }, (_, id) => {
    const [x, z] = [(next() - 0.5) * 400, (next() - 0.5) * 400];
    const [w, d] = [next() < 0.2 ? 0 : next() * 40, next() * 25];
    return { id, minX: x, minZ: z, maxX: x + w, maxZ: z + d };
  });
};

const meets = (b: Box, minX: number, minZ: number, maxX: number, maxZ: number): boolean => b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ;

const filled = (cell: number, items: readonly Box[]): SpatialHash<Box> => {
  const grid = new SpatialHash<Box>(cell);
  for (const b of items) grid.insert(b, b.minX, b.minZ, b.maxX, b.maxZ);
  return grid;
};

describe("SpatialHash", () => {
  it("finds every box meeting a query, once, in the order they went in", () => {
    for (const [cell, seed] of [
      [4, 1],
      [16, 2],
      [128, 3],
    ] as const) {
      const items = boxes(500, seed);
      const grid = filled(cell, items);
      const next = sequence(seed + 100);
      for (let q = 0; q < 200; q++) {
        const [x, z, w, d] = [(next() - 0.5) * 450, (next() - 0.5) * 450, next() * 60, next() * 60];
        const want = items.filter((b) => meets(b, x, z, x + w, z + d));
        expect(grid.query(x, z, x + w, z + d)).toEqual(want);
        const seen: Box[] = [];
        grid.some(x, z, x + w, z + d, (b) => (seen.push(b), false));
        expect(seen.sort((p, r) => p.id - r.id)).toEqual(want);
      }
    }
  });

  it("finds the boxes holding a point, edges included", () => {
    const items = boxes(300, 7);
    const grid = filled(10, items);
    const next = sequence(8);
    for (let q = 0; q < 300; q++) {
      const [x, z] = [(next() - 0.5) * 400, (next() - 0.5) * 400];
      expect(grid.at(x, z)).toEqual(items.filter((b) => meets(b, x, z, x, z)));
    }
    const edge = new SpatialHash<string>(8);
    edge.insert("a", 0, 0, 8, 8);
    expect(edge.at(8, 8)).toEqual(["a"]);
    expect(edge.at(-8, 0)).toEqual([]);
    expect(edge.query(8, 8, 9, 9)).toEqual(["a"]);
    expect(edge.query(8.001, 0, 9, 9)).toEqual([]);
  });

  it("queries a square round a point", () => {
    const grid = new SpatialHash<string>(4);
    grid.insertPoint("near", 3, 0);
    grid.insertPoint("far", 6, 0);
    expect(grid.queryRadius(0, 0, 3)).toEqual(["near"]);
    expect(grid.queryRadius(0, 0, 6)).toEqual(["near", "far"]);
  });

  it("takes items out and puts them back at the end", () => {
    const grid = new SpatialHash<string>(4);
    const a = grid.insert("a", 0, 0, 10, 1);
    grid.insert("b", 1, 0, 2, 1);
    expect(grid.size).toBe(2);
    grid.remove(a);
    grid.remove(a);
    expect(grid.size).toBe(1);
    expect(grid.query(-10, -10, 20, 20)).toEqual(["b"]);
    grid.insert("a", 0, 0, 10, 1);
    expect(grid.query(-10, -10, 20, 20)).toEqual(["b", "a"]);
    expect(grid.at(1.5, 0.5)).toEqual(["b", "a"]);
    grid.clear();
    expect(grid.size).toBe(0);
    expect(grid.query(-10, -10, 20, 20)).toEqual([]);
  });

  it("stops at the first item `some` is told to, and works far off the origin", () => {
    const grid = new SpatialHash<number>(1);
    for (let i = 0; i < 5; i++) grid.insertPoint(i, i * 0.1, 0);
    let calls = 0;
    expect(grid.some(0, 0, 1, 0, (i) => (calls++, i === 1))).toBe(true);
    expect(calls).toBe(2);
    expect(grid.some(5, 5, 6, 6, () => true)).toBe(false);
    const far = new SpatialHash<string>(1);
    far.insert("far", 3e6, -3e6, 3e6 + 1, -3e6);
    expect(far.at(3e6 + 0.5, -3e6)).toEqual(["far"]);
    expect(far.query(3e6 + 1, -3e6, 3e6 + 2, -3e6 + 1)).toEqual(["far"]);
  });

  it("refuses a cell that is not above 0", () => {
    expect(() => new SpatialHash(0)).toThrow();
    expect(() => new SpatialHash(Number.NaN)).toThrow();
  });
});
