import { describe, expect, it } from "vitest";
import type { OsmData, OsmNode, OsmRelation, OsmWay } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";
import { StructureIndex, structureKind, structuresOf } from "../src/structures.ts";

/** The map's structures no tree of the crowns stands in (G-815). */

describe("structures of the map (G-815)", () => {
  it("takes buildings, building sites, markets and canopies, not ruins or buildings under ground", () => {
    expect(structureKind({ building: "yes" })).toBe("building");
    expect(structureKind({ "building:part": "yes" })).toBe("building");
    expect(structureKind({ building: "construction" })).toBe("construction");
    expect(structureKind({ landuse: "construction" })).toBe("construction");
    expect(structureKind({ amenity: "marketplace" })).toBe("marketplace");
    expect(structureKind({ man_made: "canopy" })).toBe("canopy");
    expect(structureKind({ building: "ruins" })).toBeNull();
    expect(structureKind({ building: "yes", ruins: "yes" })).toBeNull();
    expect(structureKind({ building: "yes", location: "underground" })).toBeNull();
    expect(structureKind({ landuse: "grass" })).toBeNull();
  });

  it("keeps a multipolygon's courtyard out of its building", () => {
    // A 40 m square building round a 20 m courtyard, and a building site of a closed way.
    const nodes = new Map<number, OsmNode>();
    const node = (id: number, x: number, z: number) => {
      const g = worldToGeo({ x, z });
      nodes.set(id, { id, lat: g.lat, lon: g.lon });
      return id;
    };
    const square = (base: number, x0: number, z0: number, s: number) => [node(base, x0, z0), node(base + 1, x0 + s, z0), node(base + 2, x0 + s, z0 + s), node(base + 3, x0, z0 + s), base];
    const ways = new Map<number, OsmWay>([
      [1, { id: 1, nodes: square(10, 0, 0, 40) }],
      [2, { id: 2, nodes: square(20, 10, 10, 20) }],
      [3, { id: 3, nodes: square(30, 100, 0, 20), tags: { landuse: "construction" } }],
    ]);
    const rel: OsmRelation = { id: 7, tags: { type: "multipolygon", building: "yes" }, members: [{ type: "way", ref: 1, role: "outer" }, { type: "way", ref: 2, role: "inner" }] };
    const osm: OsmData = { nodes, ways, relations: new Map([[7, rel]]) };
    const list = structuresOf(osm);
    expect(list.map((s) => [s.id, s.kind])).toEqual([["w3", "construction"], ["r7", "building"]]);
    const index = new StructureIndex(list);
    expect(index.at({ x: 5, z: 5 })?.id).toBe("r7");
    expect(index.at({ x: 20, z: 20 })).toBeNull();
    expect(index.at({ x: 110, z: 10 })?.kind).toBe("construction");
    expect(index.at({ x: 60, z: 10 })).toBeNull();
  });
});
