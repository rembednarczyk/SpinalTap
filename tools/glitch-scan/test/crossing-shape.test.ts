import { describe, expect, it } from "vitest";
import { crossingGlow, crossingKerb, crossingOverhang, crossingSkew } from "./crossing-shape";
import type { GroundChunk } from "./ground-strips";

/** A road along x (z -6..6, x 0..40), kerbs on sidewalks past it, and a zebra of `ring` across it. */
const chunk = (zebra: readonly number[], roadZ: readonly [number, number] = [-6, 6]): GroundChunk => ({
  id: "t-0-0",
  bounds: { minX: 0, maxX: 40, minZ: -20, maxZ: 20 },
  ground: [
    { surface: "road", outline: [0, roadZ[0], 18, roadZ[0], 18, roadZ[1], 0, roadZ[1]] },
    { surface: "road", outline: [22, roadZ[0], 40, roadZ[0], 40, roadZ[1], 22, roadZ[1]] },
    { surface: "sidewalk", outline: [0, 6, 40, 6, 40, 12, 0, 12] },
    { surface: "sidewalk", outline: [0, -12, 40, -12, 40, -6, 0, -6] },
    { surface: "crossing", outline: [...zebra] },
  ],
});
const STREET: readonly [number, number][] = [[0, 0], [40, 0]];
const STRAIGHT = [18, -6, 22, -6, 22, 6, 18, 6];

describe("zebra shape (crossing-shape-*)", () => {
  it("finds nothing on a rectangle across the road from kerb to kerb", () => {
    const c = [chunk(STRAIGHT)];
    expect(crossingSkew(c, [STREET])).toEqual([]);
    expect(crossingOverhang(c)).toEqual([]);
    expect(crossingGlow(c)).toEqual([]);
    expect(crossingKerb(c)).toEqual([]);
  });

  it("finds a zebra 10 degrees off the perpendicular", () => {
    const t = Math.tan((10 * Math.PI) / 180) * 12;
    const c = [chunk([18, -6, 22, -6, 22 + t, 6, 18 + t, 6])];
    expect(crossingSkew(c, [STREET])).toHaveLength(1);
  });

  it("finds stripes outside the piece when the piece is a wedge in its own box", () => {
    expect(crossingOverhang([chunk([18, -6, 22, -6, 22, 6, 21.5, 6, 21.5, 0, 18, 0])])).toHaveLength(1);
  });

  it("finds a zebra whose end stops 0.5 m short of the kerb", () => {
    const c = chunk([18, -5.5, 22, -5.5, 22, 5.5, 18, 5.5]);
    // The asphalt goes on past the zebra's ends to the kerb.
    const filled: GroundChunk = { ...c, ground: [...c.ground, { surface: "road", outline: [18, 5.5, 22, 5.5, 22, 6, 18, 6] }, { surface: "road", outline: [18, -6, 22, -6, 22, -5.5, 18, -5.5] }] };
    expect(crossingKerb([filled])).toHaveLength(1);
  });

  it("finds the glow of a zebra lying over a sidewalk", () => {
    const c = chunk([18, -6, 22, -6, 22, 6, 18, 6]);
    const over: GroundChunk = { ...c, ground: [...c.ground, { surface: "sidewalk" as const, outline: [17, -20, 23, -20, 23, 20, 17, 20] }].filter((g) => g.surface !== "road") };
    expect(crossingGlow([over]).length).toBe(1);
  });
});
