import { describe, expect, it } from "vitest";
import { terrainHeightAt } from "@seki/core";
import { STEP_RISE, flightRamps, shapeGrid } from "../src/content/lublin/shape";
import type { LublinChunkData, LublinFlightData } from "../src/content/lublin/types";

/**
 * Flights of steps against their map `incline` (G-236): where the terrain falls from a flight's
 * foot to its top, it is ramped up the flight from the foot; a flight the terrain climbs keeps it.
 */

/** A 20 × 20 m chunk on a 1 m grid whose ground falls 0.1 m a metre along x. */
const chunk = (id: string, flights: readonly LublinFlightData[]): LublinChunkData => {
  const heights: number[] = [];
  for (let z = 0; z <= 20; z++) for (let x = 0; x <= 20; x++) heights.push(-x / 10);
  return {
    id,
    district: "shinsekai-7",
    bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 },
    terrain: { originX: 0, originZ: 0, cell: 1, cols: 21, rows: 21, heights },
    buildings: [],
    ground: [],
    streets: [],
    markings: [],
    pois: [],
    flights,
  };
};

describe("ramps along flights of steps against their incline (G-236)", () => {
  // Foot at x 4, top at x 10 by a turn at (7, 13): the ground falls 0.6 m foot to top.
  const against: LublinFlightData = { id: "w1", line: [4, 10, 7, 13, 10, 10] };

  it("raises the terrain from the foot up the flight, its step_count's risers or as far as it fell", () => {
    for (const [flight, rise] of [
      [against, 0.6],
      [{ ...against, steps: 7 }, 7 * STEP_RISE],
    ] as const) {
      const c = chunk("c", [flight]);
      const ramps = flightRamps([c]);
      expect(ramps).toHaveLength(2);
      const shaped = shapeGrid(c.terrain, [], ramps);
      const h = (x: number, z: number) => terrainHeightAt(shaped, x, z);
      expect(h(4, 10)).toBeCloseTo(-0.4, 6);
      expect(h(7, 13)).toBeCloseTo(-0.4 + rise / 2, 6);
      expect(h(10, 10)).toBeCloseTo(-0.4 + rise, 6);
      // Off the flight, past its corridor and blend, the ground stays.
      expect(h(7, 5)).toBeCloseTo(-0.7, 6);
    }
  });

  it("leaves a flight the terrain climbs or about level, and takes one in two chunks once", () => {
    expect(flightRamps([chunk("c", [{ id: "w2", line: [10, 10, 4, 10] }])])).toEqual([]);
    expect(flightRamps([chunk("c", [{ id: "w3", line: [4, 10, 5, 10] }])])).toEqual([]);
    expect(flightRamps([chunk("a", [against]), chunk("b", [against])])).toHaveLength(2);
  });
});
