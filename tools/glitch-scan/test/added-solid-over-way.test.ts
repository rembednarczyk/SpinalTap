import { describe, expect, it } from "vitest";
import { ADDED_AREAS, type AddedArea } from "../../osm-import/src/corrections.ts";
import { type Line } from "../../osm-import/src/features.ts";
import { SOLID_OVER_WAY_KNOWN, addedSolidOverWay } from "./added-solid-over-way";

const solid = (id: string, tags: AddedArea["tags"], x0: number, x1: number): AddedArea => ({
  id,
  tags,
  ring: [{ x: x0, z: 0 }, { x: x1, z: 0 }, { x: x1, z: 10 }, { x: x0, z: 10 }],
  nodesOf: [null, null, null, null],
  reason: "",
  ref: "",
});

const way = (id: string, tags: Line["tags"], x: number): Line => ({ id, osmId: 0, tags, line: [{ x, z: -5 }, { x, z: 15 }] });

const GARAGE = { building: "parking", height: "11" };

describe("added-solid-over-way (G-677)", () => {
  it("finds an added building across an open way, and keeps one beside it", () => {
    const steps = way("w1", { highway: "steps" }, 5);
    expect(addedSolidOverWay([solid("T-1/garaz", GARAGE, 0, 10)], [steps], {}).map((f) => f.what)).toEqual(["T-1/garaz: over w1 (highway=steps)"]);
    expect(addedSolidOverWay([solid("T-1/garaz", GARAGE, 20, 30)], [steps], {})).toEqual([]);
    // A way laid along the ring's edge, on its nodes, stays out; one wholly within counts.
    expect(addedSolidOverWay([solid("T-1/garaz", GARAGE, 5, 10)], [steps], {})).toEqual([]);
    const inside: Line = { id: "w2", osmId: 0, tags: { highway: "footway" }, line: [{ x: 2, z: 2 }, { x: 8, z: 8 }] };
    expect(addedSolidOverWay([solid("T-1/garaz", GARAGE, 0, 10)], [inside], {})).toHaveLength(1);
  });

  it("keeps out ways in a tunnel or under a roof, lines other than highway and areas with no building", () => {
    const area = [solid("T-1/garaz", GARAGE, 0, 10)];
    expect(addedSolidOverWay(area, [way("w1", { highway: "footway", tunnel: "yes" }, 5)], {})).toEqual([]);
    expect(addedSolidOverWay(area, [way("w1", { highway: "footway", covered: "yes" }, 5)], {})).toEqual([]);
    expect(addedSolidOverWay(area, [way("w1", { highway: "footway", tunnel: "no", covered: "no" }, 5)], {})).toHaveLength(1);
    expect(addedSolidOverWay(area, [way("w1", { barrier: "fence" }, 5)], {})).toEqual([]);
    expect(addedSolidOverWay([solid("T-1/kostka", { "area:highway": "pedestrian" }, 0, 10)], [way("w1", { highway: "footway" }, 5)], {})).toEqual([]);
  });

  it("leaves out the solids listed as known, and only those", () => {
    const area = [solid("T-1/garaz", GARAGE, 0, 10)];
    const steps = [way("w1", { highway: "steps" }, 5)];
    expect(addedSolidOverWay(area, steps, { "T-1/garaz": "T-1: until the map is widened" })).toEqual([]);
    expect(addedSolidOverWay(area, steps, { "T-1/inny": "T-1: until the map is widened" })).toHaveLength(1);
  });

  it("lists as known only buildings of ADDED_AREAS, each with its T-NNN entry and a reason", () => {
    const ids = new Set(ADDED_AREAS.filter((a) => a.tags.building !== undefined).map((a) => a.id));
    for (const [id, why] of Object.entries(SOLID_OVER_WAY_KNOWN)) {
      expect(ids.has(id), id).toBe(true);
      expect(why.startsWith(`${id.split("/")[0]}: `), id).toBe(true);
    }
  });
});
