import { describe, expect, it } from "vitest";
import { type Area } from "../src/features.ts";
import { chunkCarParks } from "../src/kerbside.ts";

const rect = { minX: 0, minZ: 0, maxX: 100, maxZ: 100 };
const park = (tags: Record<string, string>, x0 = 40): Area => ({
  id: "w7",
  osmId: 7,
  tags: { amenity: "parking", ...tags },
  ring: [{ x: x0, z: 50 }, { x: x0 + 20, z: 50 }, { x: x0 + 20, z: 52.5 }, { x: x0, z: 52.5 }],
  holes: 0,
});

describe("chunk car parks", () => {
  it("keep a car park on the ground reaching into the chunk, with its kind and outline", () => {
    expect(chunkCarParks([park({ parking: "street_side" })], rect)).toEqual([{ id: "w7", kind: "street_side", outline: [40, 50, 60, 50, 60, 52.5, 40, 52.5] }]);
    expect(chunkCarParks([park({}, 90)], rect)).toEqual([{ id: "w7", kind: "surface", outline: [90, 50, 110, 50, 110, 52.5, 90, 52.5] }]);
  });

  it("leave out one under the ground, a deck, a building and one outside the chunk", () => {
    for (const tags of [{ parking: "underground" }, { parking: "multi-storey" }, { parking: "rooftop" }, { layer: "-1" }, { building: "yes" }] as Record<string, string>[]) expect(chunkCarParks([park(tags)], rect)).toEqual([]);
    expect(chunkCarParks([park({}, 120)], rect)).toEqual([]);
    expect(chunkCarParks([{ ...park({}), tags: { amenity: "bicycle_parking" } }], rect)).toEqual([]);
  });
});
