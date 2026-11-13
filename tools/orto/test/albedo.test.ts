import { describe, expect, it } from "vitest";
import { type AlbedoBucket, gatherAlbedo, luma, medianColour, topPieces, wellInside } from "../src/albedo.ts";
import { COVER } from "../src/classify.ts";

const rect = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** A 10 × 10 m grid of 0.5 m: a lawn with a square of paving laid over its middle. */
const grid = { x0: 0, z1: 10, step: 0.5, width: 20, height: 20 };
const pieces = [
  { surface: "grass", ring: rect(0, 0, 10, 10) },
  { surface: "square", ring: rect(3, 3, 7, 7) },
];

describe("the surfaces' colours on the orthophoto (G-721)", () => {
  it("takes the median of each channel and the luma of Rec. 709", () => {
    expect(medianColour([10, 20, 30, 50, 60, 70, 20, 40, 0])).toEqual([20, 40, 30]);
    expect(medianColour([10, 20, 30, 50, 60, 70])).toEqual([30, 40, 50]);
    expect(luma([194, 192, 181]) / luma([101, 102, 84])).toBeCloseTo(1.9, 1);
  });

  it("gives each sample the last piece over it and keeps only those 1 m inside it", () => {
    const top = topPieces(grid, pieces);
    const k = (x: number, z: number) => Math.floor((10 - z) / 0.5) * 20 + Math.floor(x / 0.5);
    expect(top[k(5.2, 5.2)]).toBe(1);
    expect(top[k(1.2, 1.2)]).toBe(0);
    expect(wellInside(grid, top, k(5.2, 5.2))).toBe(true);
    // 0.25 m inside the square's edge, and on the grid's border.
    expect(wellInside(grid, top, k(3.2, 5.2))).toBe(false);
    expect(wellInside(grid, top, k(0.2, 5.2))).toBe(false);
  });

  it("counts a surface's colour only from samples of its class", () => {
    const top = topPieces(grid, pieces);
    const n = grid.width * grid.height;
    const cls = new Uint8Array(n).fill(COVER.green);
    const rgb = new Float32Array(n * 3);
    const count = new Uint16Array(n).fill(4);
    for (let k = 0; k < n; k++) {
      const paved = top[k] === 1;
      // A quarter of the square is under a crown on the photograph: its class is not paving.
      const crown = paved && k % 4 === 0;
      if (paved) cls[k] = crown ? COVER.canopy : COVER.paving;
      const c = crown ? [60, 90, 50] : paved ? [190, 186, 172] : [100, 102, 84];
      for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch] = c[ch]! * 4;
    }
    const buckets = new Map<string, AlbedoBucket>();
    const all = Array.from({ length: n }, (_, k) => k);
    gatherAlbedo(buckets, all, (k) => (wellInside(grid, top, k) ? pieces[top[k]!]!.surface : null), cls, { rgb, n: count });
    const square = buckets.get("square")!;
    expect(medianColour(square.rgb)).toEqual([190, 186, 172]);
    expect(square.classes.canopy).toBeGreaterThan(0);
    expect(square.rgb.length / 3).toBe(square.classes.paving);
    expect(medianColour(buckets.get("grass")!.rgb)).toEqual([100, 102, 84]);
  });
});
