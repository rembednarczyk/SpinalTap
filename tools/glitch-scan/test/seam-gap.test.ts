import { describe, expect, it } from "vitest";
import { chunkSeams, seamGaps } from "./seam-gap";

/**
 * The glitch scan's check `seam-gap` (G-748) on two chunks side by side, a x 0..10 and b x 10..20,
 * z 0..2: their seam is x 10, z 0..2, nine samples every 0.25 m.
 */

const a = { id: "a", bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 2 } };
const b = { id: "b", bounds: { minX: 10, maxX: 20, minZ: 0, maxZ: 2 } };
/** b's terrain `step` metres over a's from z `from` on. */
const ledge = (step: number, from = 0) => (chunk: string, _x: number, z: number) => (chunk === "b" && z >= from ? step : 0);
const open = () => false;

describe("a ledge in the terrain on a seam of two chunks (G-748)", () => {
  it("finds the seam of two chunks side by side, and none at a corner alone", () => {
    expect(chunkSeams([a, b])).toEqual([{ a: "a", b: "b", along: "z", at: 10, lo: 0, hi: 2 }]);
    expect(chunkSeams([a, { id: "c", bounds: { minX: 10, maxX: 20, minZ: 2, maxZ: 4 } }])).toEqual([]);
  });

  it("finds every point of the seam, on the world's 0.25 m grid, where the two grids part by more than 0.1 m", () => {
    const found = seamGaps([a, b], { height: ledge(0.3, 1.5), covered: open });
    expect(found.map((f) => f.at)).toEqual(["10.00,1.50", "10.00,1.75", "10.00,2.00"]);
    expect(found[0]!.what).toBe("a 0.000 | b 0.300: 0.300 m apart");
    // A seam starting off the grid is sampled at the grid's points, not from its end.
    const off = { ...b, bounds: { ...b.bounds, minZ: 0.1 } };
    expect(seamGaps([{ ...a, bounds: { ...a.bounds, minZ: 0.1 } }, off], { height: ledge(0.3), covered: open }).map((f) => f.at)[0]).toBe("10.00,0.25");
  });

  it("finds nothing within 0.1 m, under a cover, nor where a chunk has no terrain", () => {
    expect(seamGaps([a, b], { height: ledge(0.1), covered: open })).toEqual([]);
    // The import's tenths: -1.9 against -2.0 is a hair over 0.1 in floats, not a ledge.
    expect(seamGaps([a, b], { height: (c) => (c === "b" ? -1.9 : -2), covered: open })).toEqual([]);
    expect(seamGaps([a, b], { height: ledge(-0.3), covered: () => true })).toEqual([]);
    expect(seamGaps([a, b], { height: (c) => (c === "b" ? null : 0), covered: open })).toEqual([]);
  });

  it("asks the cover at the higher side's height, and takes a point where seams cross once", () => {
    const asked: number[] = [];
    seamGaps([a, b], { height: ledge(-0.5, 2), covered: (_x, _z, y) => (asked.push(y), false) });
    expect(asked).toEqual([0]);
    const c = { id: "c", bounds: { minX: 0, maxX: 10, minZ: 2, maxZ: 4 } };
    const d = { id: "d", bounds: { minX: 10, maxX: 20, minZ: 2, maxZ: 4 } };
    const rise = (chunk: string) => (chunk === "b" || chunk === "d" ? 1 : 0);
    expect(seamGaps([a, b, c, d], { height: rise, covered: open }).filter((f) => f.at === "10.00,2.00")).toHaveLength(1);
  });
});
