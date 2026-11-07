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

describe("a lamp of the plan beside a pedestrian street on a bridge (G-497)", () => {
  // Zamkowa's viaduct: its paving is bridge ground, which the site does not stand things on, over
  // the lawn of the bank; the abutment's paving on the ground goes on from it at x = 60.
  const viaduct = (): LublinChunkData => ({
    ...causeway(),
    ground: [
      { surface: "grass", outline: [0, 0, 100, 0, 100, 60, 0, 60] },
      { surface: "square", outline: [60, 26.75, 100, 26.75, 100, 33.25, 60, 33.25] },
      { surface: "cobble", outline: [0, 26.75, 60, 26.75, 60, 33.25, 0, 33.25], bridge: true, deck: [0, 30, 60, 30] },
    ],
  });
  const site = new Site([viaduct()]);

  it("stands 0.3 m past the deck's paving, as past the abutment's, not the fallback out on the bank", () => {
    for (const x of [30, 59.8]) {
      for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) {
        const d = sideOffset(site, { x, z: 30 }, n, "kerb", 5, true)!;
        expect(d).toBeGreaterThan(3.5);
        expect(d).toBeLessThan(3.6);
      }
    }
  });

  it("keeps the fallback for other pieces and off the deck", () => {
    expect(sideOffset(site, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5)).toBe(5);
    expect(sideOffset(site, { x: 30, z: 40 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
  });

  it("keeps the fallback beside the span high over a valley, where the lantern would hang at the deck's walkers", () => {
    // The deck level with its abutments' ground (0 m) over a valley 5 m deep from x = 20 to 40, rising back by x = 60.
    const valley = new Site([{ ...viaduct(), terrain: { originX: 0, originZ: 0, cell: 20, cols: 6, rows: 1, heights: [0, -5, -5, 0, 0, 0] } }]);
    expect(sideOffset(valley, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
    const end = sideOffset(valley, { x: 57, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true)!;
    expect(end).toBeGreaterThan(3.5);
    expect(end).toBeLessThan(3.6);
  });
});
