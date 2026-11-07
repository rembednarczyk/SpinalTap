import { describe, expect, it } from "vitest";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { sideOffset } from "../src/props-place.ts";
import { Site } from "../src/props-site.ts";

/** A 100 x 60 m chunk: a paved causeway 6.5 m wide along z = 30 between lawns, like Zamkowa's over the Błonie. */
const causeway = (): LublinChunkData => ({
  id: "test-0-0",
  district: "kanal",
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
  terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
  buildings: [],
  ground: [
    { surface: "grass", outline: [0, 0, 100, 0, 100, 60, 0, 60] },
    { surface: "square", outline: [0, 26.75, 100, 26.75, 100, 33.25, 0, 33.25] },
  ],
  streets: [{ name: "Zamkowa", kind: "pedestrian", line: [0, 30, 100, 30] }],
  markings: [],
  pois: [],
});

describe("a lamp of the plan beside a pedestrian street (G-477)", () => {
  const site = new Site([causeway()]);

  it("stands 0.3 m past the paving's edge, not the fallback out on the lawn", () => {
    for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const d = sideOffset(site, { x: 50, z: 30 }, n, "kerb", 5, true)!;
      expect(d).toBeGreaterThan(3.5);
      expect(d).toBeLessThan(3.6);
    }
  });

  it("keeps the fallback on a paving wider than it, for other pieces and where the axis is not paved", () => {
    const wide = new Site([{ ...causeway(), ground: [{ surface: "square", outline: [0, 10, 100, 10, 100, 50, 0, 50] }] }]);
    expect(sideOffset(wide, { x: 50, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
    expect(sideOffset(site, { x: 50, z: 30 }, { x: 0, z: 1 }, "kerb", 5)).toBe(5);
    expect(sideOffset(site, { x: 50, z: 40 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
  });
});
