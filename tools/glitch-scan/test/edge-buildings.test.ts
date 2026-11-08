import { describe, expect, it } from "vitest";
import { edgeBuildingsDropped } from "./edge-buildings";

const area = (id: string, x0: number, x1: number) => ({
  id,
  osmId: 1,
  tags: { building: "house", "addr:street": "Cicha", "addr:housenumber": "3" },
  ring: [
    { x: x0, z: 0 },
    { x: x1, z: 0 },
    { x: x1, z: 10 },
    { x: x0, z: 10 },
  ],
  holes: 0,
});
const MAP = [{ minX: 0, minZ: -50, maxX: 100, maxZ: 50 }];

describe("edge-building-dropped (G-556)", () => {
  it("finds a building centred off the map with over 2 m² on it the game has not got", () => {
    expect(edgeBuildingsDropped([area("w1", -10, 4)], MAP, new Set())).toEqual([{ at: "2,5", what: "w1 (Cicha 3): 40.0 m² on the map, centroid off it" }]);
  });

  it("passes one the game has, one left off on purpose, one centred on the map and a sliver on it", () => {
    expect(edgeBuildingsDropped([area("w1", -10, 4)], MAP, new Set(["w1"]))).toEqual([]);
    expect(edgeBuildingsDropped([area("w1", -10, 4)], MAP, new Set(), { w1: "T-057" })).toEqual([]);
    expect(edgeBuildingsDropped([area("w1", -4, 10)], MAP, new Set())).toEqual([]);
    expect(edgeBuildingsDropped([area("w1", -10, 0.2)], MAP, new Set())).toEqual([]);
    expect(edgeBuildingsDropped([area("w1", -20, -10)], MAP, new Set())).toEqual([]);
  });
});
