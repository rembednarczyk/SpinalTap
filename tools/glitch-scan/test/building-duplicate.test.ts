import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { duplicateSolids } from "./building-duplicate";

const box = (id: string, x0: number, x1: number, z0 = 0, z1 = 10) => ({
  id,
  ring: [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ],
});

describe("building-duplicate (G-600)", () => {
  it("finds two solids in much the same outline", () => {
    expect(duplicateSolids([box("w1", 0, 20), box("r2", 1, 21)])).toEqual([{ at: "11,5", what: "w1 and r2 share 190 m² of 200 m²" }]);
  });

  it("finds a small solid standing mostly inside a big one", () => {
    expect(duplicateSolids([box("w1", 0, 100, -50, 50), box("w2", 10, 14, 0, 4)])).toHaveLength(1);
  });

  it("passes neighbours sharing a wall and solids overlapping by half the smaller one or less", () => {
    expect(duplicateSolids([box("w1", 0, 10), box("w2", 10, 20)])).toEqual([]);
    expect(duplicateSolids([box("w1", 0, 10), box("w2", 5, 15)])).toEqual([]);
    expect(duplicateSolids([box("w1", 0, 10), box("w2", 50, 60)])).toEqual([]);
  });
});

describe("VIVO on Podzamcze (G-600)", () => {
  it("stands as one solid: its underground garage w173070505 (`level=-2`) is none", () => {
    const solids = MAP_CHUNKS.flatMap((c) => c.buildings).filter((b) => b.x > 1090 && b.x < 1120 && b.z > 180 && b.z < 210);
    expect(solids.map((b) => b.id)).toEqual(["r5601275"]);
  });
});
