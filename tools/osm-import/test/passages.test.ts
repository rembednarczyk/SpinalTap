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

  it("make none with an end off the map's data, where there is no ground to come out on", () => {
    const gate = way(6, { highway: "service", tunnel: "building_passage" }, [[10, 0], [10, 12]]);
    expect(buildingPassages([gate], [house], [{ minX: -50, maxX: 50, minZ: -50, maxZ: 12 }])).toEqual([]);
    expect(buildingPassages([gate], [house], [{ minX: -50, maxX: 50, minZ: -50, maxZ: 12 }, { minX: -50, maxX: 50, minZ: 12, maxZ: 50 }])).toHaveLength(1);
  });

  it("lower the vault to the map's maxheight, under 4 m for below_default, the walls springing as high in share (G-089)", () => {
    const gate = (maxheight: string) => buildingPassages([way(7, { highway: "service", tunnel: "yes", maxheight }, [[10, 0], [10, 12]])], [house], undefined, new Set([7]))[0]!;
    expect(gate("below_default")).toMatchObject({ height: 3.6, rise: 0.99 });
    expect(gate("3.2 m")).toMatchObject({ height: 3.2, rise: 0.88 });
    expect(gate("3,5")).toMatchObject({ height: 3.5 });
    expect(gate("none")).toMatchObject({ height: 4, rise: 1.1 });
    // A typo in the map neither seals the passage nor lifts the crown out of the house front.
    expect(gate("1.8")).toMatchObject({ height: 2.2, rise: 0.61 });
    expect(gate("50")).toMatchObject({ height: 5, rise: 1.38 });
    const lane = buildingPassages([way(8, { highway: "footway", tunnel: "building_passage", maxheight: "below_default" }, [[5, -3], [5, 15]])], [house])[0]!;
    expect(lane).toMatchObject({ height: 3.4, rise: 0.9 });
  });
});
