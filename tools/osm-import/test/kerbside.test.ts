import { describe, expect, it } from "vitest";
import { type Area, type Line } from "../src/features.ts";
import { busStopPosts, chunkBusStops, chunkCarParks } from "../src/kerbside.ts";
import { type OsmData, type OsmNode } from "../src/osm.ts";

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

describe("chunk bus stops (G-156)", () => {
  it("keep the posts in the chunk and those up to 25 m past its edge, flat x, z", () => {
    expect(chunkBusStops([{ x: 50, z: 50 }, { x: 120, z: 50 }, { x: 140, z: 50 }], rect)).toEqual([50, 50, 120, 50]);
  });

  it("take a post or a platform, node or way, but not the stop position on the carriageway", () => {
    const node = (id: number, tags: Record<string, string>): [number, OsmNode] => [id, { id, lat: 51.2465, lon: 22.5684, tags }];
    const data: OsmData = {
      nodes: new Map([node(1, { highway: "bus_stop" }), node(2, { public_transport: "platform" }), node(3, { public_transport: "stop_position" }), node(4, { amenity: "bench" })]),
      ways: new Map(),
      relations: new Map(),
    };
    const platform: Line = { id: "w9", osmId: 9, tags: { highway: "platform" }, line: [{ x: 1, z: 2 }, { x: 3, z: 4 }] };
    const footway: Line = { id: "w8", osmId: 8, tags: { highway: "footway" }, line: [{ x: 5, z: 6 }] };
    const found = busStopPosts(data, [platform, footway], []);
    expect(found).toHaveLength(4);
    expect(found.slice(2)).toEqual([{ x: 1, z: 2 }, { x: 3, z: 4 }]);
  });
});
