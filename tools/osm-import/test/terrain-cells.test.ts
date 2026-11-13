import { describe, expect, it } from "vitest";
import { CELLS } from "../src/terrain.ts";

const divides = (len: number, cell: number) => Math.abs(len / cell - Math.round(len / cell)) < 1e-9;

describe("the terrain's cells (G-758)", () => {
  it("are each a multiple of every finer one, so the grids of any two chunks share the coarser one's points on their seam", () => {
    const apart = CELLS.flatMap((a) => CELLS.filter((b) => b < a && !divides(a, b)).map((b) => `${a} by ${b}`));
    expect(apart).toEqual([]);
  });
});
