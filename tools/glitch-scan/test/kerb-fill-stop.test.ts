import { describe, expect, it } from "vitest";
import { type FillWorld, busStopOnFill } from "./kerb-fill";

/**
 * `bus-stop-on-fill` in the districts on the street graph (ADR-0104): every sidewalk the graph lays
 * reads as a fill, so a stop by it is a bay laid as a pavement only over the orthophoto's asphalt
 * (`bayAt`). Narutowicza's stop by (233.9; −164.2) stands on the pavement a metre from the kerb,
 * where the photograph shows paving and no bay.
 */
describe("a bus stop by a fill (bus-stop-on-fill)", () => {
  // A carriageway along x at z = 0, a pavement 3 m wide past its kerb at z = 4, the map's paving explaining none of it.
  const world: FillWorld = {
    sidewalks: [[{ x: -20, z: 4 }, { x: 20, z: 4 }, { x: 20, z: 7 }, { x: -20, z: 7 }]],
    explained: [],
    roads: [{ line: [{ x: -30, z: 0 }, { x: 30, z: 0 }], half: 4, measured: true }],
    stops: [{ x: 0, z: 5 }],
  };

  it("names a stop by a fill, and none in a district on the graph where the photograph shows no asphalt under it", () => {
    expect(busStopOnFill(world)).toHaveLength(1);
    expect(busStopOnFill({ ...world, bayAt: () => false })).toEqual([]);
    expect(busStopOnFill({ ...world, bayAt: () => true })).toHaveLength(1);
  });
});
