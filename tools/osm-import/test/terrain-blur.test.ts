import { describe, expect, it } from "vitest";
import { type Field, blur } from "../src/terrain.ts";

/** The blur as written out: every tap clamped to the lattice, rows first, then columns. */
const reference = (f: Field, sigma: number): Float64Array => {
  const rad = Math.ceil(sigma * 3);
  const k: number[] = [];
  for (let i = -rad; i <= rad; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const w = k.map((x) => x / sum);
  const pass = (src: Float64Array, horizontal: boolean): Float64Array => {
    const out = new Float64Array(src.length);
    for (let r = 0; r < f.rows; r++)
      for (let c = 0; c < f.cols; c++) {
        let s = 0;
        for (let i = -rad; i <= rad; i++) {
          const cc = horizontal ? Math.min(Math.max(c + i, 0), f.cols - 1) : c;
          const rr = horizontal ? r : Math.min(Math.max(r + i, 0), f.rows - 1);
          s += w[i + rad]! * src[rr * f.cols + cc]!;
        }
        out[r * f.cols + c] = s;
      }
    return out;
  };
  return pass(pass(f.v, true), false);
};

/** A rough field: a scarp, a step and a ripple, so no two neighbours are alike. */
const field = (cols: number, rows: number): Field => {
  const v = new Float64Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) v[r * cols + c] = 180 + 0.37 * c - 0.21 * r + (c > cols / 2 ? 2.5 : 0) + Math.sin(c * 1.7 + r * 0.9);
  return { x0: -12, z0: 40, cols, rows, v };
};

describe("the terrain's blur (G-719)", () => {
  it("sums the same taps in the same order as every tap clamped, to the last bit", () => {
    for (const [cols, rows, sigma] of [
      [61, 47, 1.5],
      [61, 47, 4],
      [9, 30, 4],
      [1, 1, 2],
      [25, 26, 4],
      [3, 80, 1.6],
    ] as const) {
      const f = field(cols, rows);
      const out = blur(f, sigma);
      expect(out.v).toEqual(reference(f, sigma));
      expect([out.x0, out.z0, out.cols, out.rows]).toEqual([f.x0, f.z0, f.cols, f.rows]);
    }
  });

  it("leaves the field as it is with no smoothing", () => {
    const f = field(5, 4);
    expect(blur(f, 0)).toBe(f);
  });
});
