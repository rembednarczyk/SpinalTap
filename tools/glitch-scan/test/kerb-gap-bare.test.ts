import { describe, expect, it } from "vitest";
import { type KerbWorld, kerbGapBare } from "./kerb-gap-bare";

/** The glitch scan's check `kerb-gap-bare` (G-522) on a cross-section of a street 20 m long: a 6 m carriageway along x, a pavement past it. */

const square = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const ROAD = square(0, 0, 20, 6);
const STREET: KerbWorld = { roads: [ROAD], paving: [], covered: [], chunks: [{ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }] };
/** A pavement whose kerb lies `gap` metres past the carriageway's. */
const pavement = (gap: number) => square(0, 6 + gap, 20, 9 + gap);

describe("bare terrain between a carriageway and its pavement (kerb-gap-bare)", () => {
  it("finds every 0.25 m sample of a 1 m gap between the kerbs, and none where the paving runs on", () => {
    const found = kerbGapBare({ ...STREET, paving: [pavement(1)] });
    expect(found.length * 0.0625).toBeCloseTo(20 * 1, 0);
    expect(found[0]!.what).toBe("kerb gap 0.13,6.13, 0.13 m off the road");
    expect(kerbGapBare({ ...STREET, paving: [pavement(0)] })).toEqual([]);
  });

  it("counts a wedge as wide as it is, and nothing wider than 3 m", () => {
    // The pavement's kerb runs from 0 m past the road's at x 0 to 2 m at x 20: a wedge of 20 m².
    const wedge = [{ x: 0, z: 6 }, { x: 20, z: 8 }, { x: 20, z: 11 }, { x: 0, z: 9 }];
    expect(kerbGapBare({ ...STREET, paving: [wedge] }).length * 0.0625).toBeCloseTo(20, -0.5);
    expect(kerbGapBare({ ...STREET, paving: [pavement(3.5)] })).toEqual([]);
  });

  it("leaves out a gap with a lawn, a building or another piece between the road and the paving, and one with no paving past it", () => {
    expect(kerbGapBare({ ...STREET, paving: [pavement(1)], covered: [square(0, 6.3, 20, 6.8)] })).toEqual([]);
    expect(kerbGapBare({ ...STREET, paving: [pavement(1)], covered: [square(0, 6, 20, 7)] })).toEqual([]);
    expect(kerbGapBare({ ...STREET, covered: [pavement(1)] })).toEqual([]);
    expect(kerbGapBare(STREET)).toEqual([]);
  });

  it("looks only on its own side: paving across the carriageway does not make a gap", () => {
    expect(kerbGapBare({ ...STREET, paving: [square(0, -4, 20, -1)] }).length * 0.0625).toBeCloseTo(20, 0);
    expect(kerbGapBare({ ...STREET, paving: [square(0, 7, 20, 10)], roads: [ROAD, square(0, -10, 20, -7)] }).length * 0.0625).toBeCloseTo(20, 0);
  });

  it("leaves a cell landuse-bare counts to it, and finds nothing off the chunks", () => {
    expect(kerbGapBare({ ...STREET, paving: [pavement(1)], landuseBare: (x) => x < 10 }).length * 0.0625).toBeCloseTo(10, 0);
    expect(kerbGapBare({ ...STREET, paving: [pavement(1)], chunks: [{ minX: 30, maxX: 50, minZ: 0, maxZ: 10 }] })).toEqual([]);
  });

  it("counts a sample on a seam between two chunks once", () => {
    const two = [{ minX: -50, maxX: 10, minZ: -50, maxZ: 50 }, { minX: 10, maxX: 50, minZ: -50, maxZ: 50 }];
    expect(kerbGapBare({ ...STREET, paving: [pavement(1)], chunks: two })).toHaveLength(kerbGapBare({ ...STREET, paving: [pavement(1)] }).length);
  });
});
