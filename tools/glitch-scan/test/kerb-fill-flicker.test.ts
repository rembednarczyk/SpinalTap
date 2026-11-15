import { describe, expect, it } from "vitest";
import type { GroundChunk } from "./ground-strips";
import { kerbFillFlicker } from "./kerb-fill-flicker";

/** A road 40 m long along x (z from -4 to 0) and a strip 1 m wide north of it, its pieces `[surface, from x, to x]`. */
const chunk = (strip: readonly (readonly [string, number, number])[]): GroundChunk => ({
  id: "t-0-0",
  bounds: { minX: 0, maxX: 40, minZ: -10, maxZ: 10 },
  ground: [
    { surface: "road", outline: [0, -4, 40, -4, 40, 0, 0, 0] },
    ...strip.map(([surface, a, b]) => ({ surface: surface as "grass", outline: [a, 0, b, 0, b, 1, a, 1] })),
  ],
});

describe("a strip by the kerb flickering between grass and square (kerb-fill-flicker)", () => {
  it("finds a run under 5 m of one between runs of the other, at its middle", () => {
    const found = kerbFillFlicker([chunk([["square", 0, 10], ["grass", 10, 12], ["square", 12, 14], ["grass", 14, 40]])]);
    expect(found.map((f) => `${f.at} ${f.what}`).sort()).toEqual(["10.8,0.3 t-0-0: 2.0 m of grass by the kerb between square", "12.8,0.3 t-0-0: 2.0 m of square by the kerb between grass"]);
  });

  it("finds none along one surface, between runs of 5 m and more, or next to a third surface", () => {
    expect(kerbFillFlicker([chunk([["square", 0, 40]])])).toEqual([]);
    expect(kerbFillFlicker([chunk([["square", 0, 15], ["grass", 15, 20], ["square", 20, 40]])])).toEqual([]);
    // A footway's 3 m across the strip, as at a zebra: the strip's surface may change by it.
    expect(kerbFillFlicker([chunk([["square", 0, 15], ["footway", 15, 18], ["grass", 18, 40]])])).toEqual([]);
    expect(kerbFillFlicker([chunk([["square", 0, 15], ["grass", 15, 18], ["sidewalk", 18, 40]])])).toEqual([]);
  });
});
