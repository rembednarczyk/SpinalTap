import { describe, expect, it } from "vitest";
import { selfIntersects } from "../../osm-import/src/geometry.ts";
import { type GroundChunk, groundRingSelfCross, groundStripGap, groundStripOverlap, ringCrossesItself, stripRaster } from "./ground-strips";

/** ADR-0078 stage 1: the scan's measures of the tables' ground on a few squares in a 20 m chunk. */

const BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const rect = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];
const chunk = (outlines: readonly (readonly number[])[], bridge?: true, bounds = BOUNDS): GroundChunk => ({
  id: "test-0-0",
  bounds,
  ground: outlines.map((outline) => ({ surface: "sidewalk", outline, ...(bridge ? { bridge } : {}) })),
});

describe("ground-ring-self-cross (G-659)", () => {
  const bowtie = [0, 0, 4, 0, 0, 4, 4, 4];

  it("finds an outline whose edges cross, and none in a square, a ring touching itself at a corner or on a bridge", () => {
    expect(groundRingSelfCross([chunk([bowtie, rect(0, 0, 4, 4)])]).map((f) => f.what)).toEqual(["test-0-0: sidewalk, 4 points"]);
    // Two squares sharing the corner (2, 2), walked as one ring: its edges meet there but do not cross.
    expect(groundRingSelfCross([chunk([[0, 0, 2, 0, 2, 2, 4, 2, 4, 4, 2, 4, 2, 2, 0, 2]])])).toEqual([]);
    expect(groundRingSelfCross([chunk([bowtie], true)])).toEqual([]);
  });

  it("agrees with the import's selfIntersects on rings drawn at random", () => {
    let seed = 7;
    const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 10;
    for (let k = 0; k < 400; k++) {
      const ring = Array.from({ length: 4 + (k % 9) }, () => ({ x: next(), z: next() }));
      expect(ringCrossesItself(ring), JSON.stringify(ring)).toBe(selfIntersects(ring));
    }
  });
});

describe("ground-strip-overlap", () => {
  it("counts the m² two strips share, and none between strips that only touch or lie on a bridge", () => {
    expect(groundStripOverlap([stripRaster(chunk([rect(0, 0, 4, 2), rect(3, 0, 6, 2)]))])).toHaveLength(2);
    expect(groundStripOverlap([stripRaster(chunk([rect(0, 0, 4, 2), rect(4, 0, 6, 2)]))])).toEqual([]);
    expect(groundStripOverlap([stripRaster(chunk([rect(0, 0, 4, 2), rect(3, 0, 6, 2)], true))])).toEqual([]);
  });

  it("places each m² on a cell it counts and rounds the area over the chunks, not chunk by chunk", () => {
    const [found] = groundStripOverlap([stripRaster(chunk([rect(0, 0, 4, 2), rect(3, 0, 6, 2)]))]);
    // The 8th cell of the 1 × 2 m overlap, row by row: four cells a row, so the second row's last.
    expect(found).toEqual({ at: "4,0", what: "overlap 3.88,0.38" });
    // Half a square metre in each of two chunks: one over the city.
    const half = (minX: number) => stripRaster(chunk([rect(minX, 0, minX + 2, 1), rect(minX + 1.5, 0, minX + 3, 1)], undefined, { ...BOUNDS, minX, maxX: minX + 20 }));
    expect(groundStripOverlap([half(-10)])).toHaveLength(1);
    expect(groundStripOverlap([half(-10), half(10)])).toHaveLength(1);
    expect(groundStripOverlap([half(-10), half(10), half(30)])).toHaveLength(2);
  });
});

describe("ground-strip-gap", () => {
  it("counts the bare cells of a gap with ground within 0.75 m on both sides: a 0.75 m gap whole, the middle of a wider one, none past 1.25 m", () => {
    const gap = (width: number) => groundStripGap([stripRaster(chunk([rect(-5, 0, 0, 4), rect(width, 0, 5, 4)]))]).length;
    // 4 m long: 0.75 m is 3 m² whole; of 1 m the middle 0.5 m, 2 m²; of 1.25 m the middle 0.25 m, 1 m².
    expect([0, 0.5, 0.75, 1, 1.25, 1.5].map(gap)).toEqual([0, 2, 3, 2, 1, 0]);
  });

  it("counts a gap across z as along x, and none beside a single strip or a bridge", () => {
    expect(groundStripGap([stripRaster(chunk([rect(0, -5, 4, 0), rect(0, 0.75, 4, 5)]))])).toHaveLength(3);
    expect(groundStripGap([stripRaster(chunk([rect(-5, 0, 5, 4)]))])).toEqual([]);
    expect(groundStripGap([stripRaster(chunk([rect(-5, 0, 0, 4), rect(0.75, 0, 5, 4)], true))])).toEqual([]);
  });
});
