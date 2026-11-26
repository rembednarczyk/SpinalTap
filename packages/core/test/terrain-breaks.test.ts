import { describe, expect, it } from "vitest";
import { type TerrainGrid, terrainHeightAt } from "../src/world/city-geo";
import { breakCells } from "../src/world/city-geo";

// A 4 x 4 grid of 1 m: the terrace (y 2) north of z 1.6, the street (y 0) south of it, the wall's
// line along z 1.6 from x 0 to x 3 (G-971).
const heights = [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2];
const plain: TerrainGrid = { originX: 0, originZ: 0, cell: 1, cols: 4, rows: 4, heights };
const broken: TerrainGrid = { ...plain, breaks: [[{ x: 0, z: 1.6 }, { x: 3, z: 1.6 }]] };

describe("a terrain grid stepping at its breaklines", () => {
  it("steps at the line itself, not over the cell it crosses", () => {
    // Without the line the step is smeared over the cell from z 1 to z 2.
    expect(terrainHeightAt(plain, 1.5, 1.4)).toBeCloseTo(0.8);
    expect(terrainHeightAt(broken, 1.5, 1.4)).toBe(0);
    expect(terrainHeightAt(broken, 1.5, 1.59)).toBe(0);
    expect(terrainHeightAt(broken, 1.5, 1.61)).toBe(2);
    expect(terrainHeightAt(broken, 1.5, 1.9)).toBe(2);
  });

  it("interpolates as before in the cells the line does not cross", () => {
    for (const [x, z] of [[0.5, 0.5], [2.2, 0.3], [1.7, 2.6]] as const) expect(terrainHeightAt(broken, x, z)).toBe(terrainHeightAt(plain, x, z));
  });

  it("keeps each side continuous across its cells' edges", () => {
    const y = (x: number) => terrainHeightAt({ ...broken, heights: heights.map((h, i) => h + (i % 4) * 0.1) }, x, 1.3);
    for (const x of [1, 2]) expect(Math.abs(y(x - 1e-6) - y(x + 1e-6))).toBeLessThan(1e-4);
  });

  it("cuts only the cells a line passes through", () => {
    expect([...breakCells(broken).keys()].sort((a, b) => a - b)).toEqual([3, 4, 5]);
    expect(breakCells(plain).size).toBe(0);
  });
});
