import { describe, expect, it } from "vitest";
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src";
import type { OsmData, OsmNode, OsmWay, Tags } from "../../osm-import/src/osm.ts";
import { worldToGeo } from "../../osm-import/src/project.ts";
import { marketChecks } from "./market-pieces";

/**
 * The glitch scan's checks of the market's furniture (ADR-0058 stage 3) on a small map of their
 * own: each check finds the piece put where it must not stand, and nothing on clear ground.
 */

const nodes = new Map<number, OsmNode>();
const ways = new Map<number, OsmWay>();
let nextId = 1;
const node = (x: number, z: number, tags?: Tags): number => {
  const id = nextId++;
  const { lat, lon } = worldToGeo({ x, z });
  nodes.set(id, tags ? { id, lat, lon, tags } : { id, lat, lon });
  return id;
};
const way = (pts: readonly (readonly [number, number])[], tags: Tags, closed = false): void => {
  const ids = pts.map(([x, z]) => node(x, z));
  const id = nextId++;
  ways.set(id, { id, nodes: closed ? [...ids, ids[0]!] : ids, tags });
};

// A house at x 0..10, z 0..10; a residential street along z = -20; a zebra node at (40, 0); a
// marketplace at x 100..140, z 0..40; a fast-food node at (60, 60).
way(
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  { building: "yes" },
  true,
);
way(
  [
    [-50, -20],
    [200, -20],
  ],
  { highway: "residential" },
);
node(40, 0, { highway: "crossing" });
way(
  [
    [100, 0],
    [140, 0],
    [140, 40],
    [100, 40],
  ],
  { amenity: "marketplace" },
  true,
);
node(60, 60, { amenity: "fast_food" });
const OSM: OsmData = { nodes, ways, relations: new Map() };

const piece = (prop: StreetPropKind, x: number, z: number, yaw = 0): StreetPropItem => ({ prop, x, y: 0, z, yaw, variant: 0 });
/** A crowd lane round x 70..90, z 70..90. */
const LANES = [
  {
    id: "lane",
    points: [
      [70, 70],
      [90, 70],
      [90, 90],
      [70, 90],
    ] as const,
  },
];

const found = (pieces: readonly StreetPropItem[]) => Object.fromEntries(Object.entries(marketChecks(OSM, pieces, LANES)).map(([k, check]) => [k, check().map((f) => f.what)]));

describe("the market's furniture in the glitch scan (ADR-0058 stage 3)", () => {
  it("finds nothing for a booth by its fast-food place and stock beside a stall in its marketplace", () => {
    const all = [piece("food-stall", 60, 63), piece("market-stall", 120, 20), piece("market-goods", 122.05, 19.7)];
    for (const [k, list] of Object.entries(found(all))) expect(list, k).toEqual([]);
  });

  it("finds a piece in a building, on a carriageway, at a zebra and on a crowd lane", () => {
    const f = found([piece("food-stall", 5, 5), piece("market-goods", 30, -20), piece("market-goods", 40, 1), piece("food-stall", 80, 70.3)]);
    expect(f["market-piece-in-building"]).toEqual(["food-stall in w5"]);
    expect(f["market-piece-on-road"]).toEqual([expect.stringMatching(/^market-goods on w/)]);
    expect(f["market-piece-in-crossing"]).toEqual([expect.stringMatching(/^market-goods at n/)]);
    expect(f["market-piece-on-crowd-lane"]).toEqual(["food-stall on lane"]);
  });

  it("finds a piece in its neighbour: under another stall's canvas, or away from its own place", () => {
    const f = found([piece("market-stall", 120, 20), piece("market-goods", 120.5, 20.5), piece("market-goods", 60, -60), piece("food-stall", 160, 160)]);
    // The stall and its neighbour both: each stands in the other.
    expect(f["market-piece-in-neighbour"]).toEqual(["market-stall in market-goods at 121,21", "market-goods in market-stall at 120,20", "market-goods off its market", "food-stall off a fast-food place"]);
  });
});
