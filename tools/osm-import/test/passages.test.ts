import { describe, expect, it } from "vitest";
import { type Area, type Line } from "../src/features.ts";
import { buildingPassages } from "../src/passages.ts";

const house: Area = {
  id: "w1",
  osmId: 1,
  tags: { building: "apartments" },
  ring: [
    { x: 0, z: 0 },
    { x: 20, z: 0 },
    { x: 20, z: 12 },
    { x: 0, z: 12 },
  ],
  holes: 0,
};
const way = (id: number, tags: Record<string, string>, pts: [number, number][]): Line => ({ id: `w${id}`, osmId: id, tags, line: pts.map(([x, z]) => ({ x, z })) });

describe("passages through buildings from the map (ADR-0048)", () => {
  it("cut a gateway drawn from facade to facade through the house, on a little past both", () => {
    const out = buildingPassages([way(2, { highway: "service", tunnel: "building_passage" }, [[10, 0], [10, 12]])], [house]);
    expect(out).toEqual([{ building: "w1", from: { x: 10, z: -0.6 }, to: { x: 10, z: 12.6 }, width: 3.2, height: 4, rise: 1.1 }]);
  });

  it("take the map's width; make none for a way only leading in, or one not under a building", () => {
    const wide = buildingPassages([way(3, { highway: "footway", tunnel: "building_passage", width: "2" }, [[5, -3], [5, 15]])], [house]);
    expect(wide[0]!.width).toBe(2);
    expect(buildingPassages([way(4, { highway: "service", tunnel: "building_passage" }, [[10, -5], [10, 6]])], [house])).toEqual([]);
    expect(buildingPassages([way(5, { highway: "service" }, [[10, -5], [10, 20]])], [house])).toEqual([]);
  });
});
