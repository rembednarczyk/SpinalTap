import { describe, expect, it } from "vitest";
import { furnitureRows, planKindOf, serializeFurniture } from "../src/furniture.ts";
import type { OsmNode } from "../src/osm.ts";
import { osmFurnitureItems, withOsmFurniture } from "../src/props-osm.ts";
import type { PropsPlan } from "../src/props-gen.ts";

const node = (id: number, tags: Record<string, string>): OsmNode => ({ id, lat: 51.25, lon: 22.56, tags }) as OsmNode;
const at = (id: string, x: number, z: number, tag: string, detail = "") => ({ id, p: { x, z }, tag, detail });

describe("the OSM extract's furniture (G-099, ADR-0077 point 4)", () => {
  it("keeps the furniture's nodes once each, sorted by id, with a machine's goods and a hydrant's type", () => {
    const rows = furnitureRows([node(9, { natural: "tree" }), node(3, { amenity: "vending_machine", vending: "parking_tickets" }), node(5, { amenity: "cafe" }), node(9, { natural: "tree" }), node(4, { emergency: "fire_hydrant", "fire_hydrant:type": "pillar" })]);
    expect(rows.map((r) => [r[0], r[3], r[4]])).toEqual([
      [3, "amenity=vending_machine", "parking_tickets"],
      [4, "emergency=fire_hydrant", "pillar"],
      [9, "natural=tree", ""],
    ]);
    const text = serializeFurniture(rows, { source: "test" });
    expect(text.split("\n")).toHaveLength(rows.length + 4);
    expect((JSON.parse(text) as { points: unknown[] }).points).toEqual(rows);
  });

  it("reads the tags as the plan's kinds, leaving lamps and hydrants to their rules", () => {
    expect(planKindOf({ tag: "amenity=vending_machine", detail: "parking_tickets" })).toBe("ticket-machine");
    expect(planKindOf({ tag: "amenity=vending_machine", detail: "coffee" })).toBe("vending-machine");
    expect(planKindOf({ tag: "barrier=bollard", detail: "" })).toBe("bollard");
    expect(planKindOf({ tag: "highway=street_lamp", detail: "" })).toBeNull();
    expect(planKindOf({ tag: "emergency=fire_hydrant", detail: "pillar" })).toBeNull();
  });

  it("adds a group a kind of the nodes on the map the plan does not hold, after the plan's own", () => {
    const plan: PropsPlan = { items: [{ id: "kp.tree", kind: "tree", points: [[100, -100]], osm: ["n1"] }] };
    const points = [
      at("n1", 100, -100, "natural=tree"),
      at("n2", 100, -240, "natural=tree"),
      at("n3", 120.04, -250.06, "amenity=bench"),
      at("n4", 140, -245, "natural=tree"),
      at("n5", 100, -400, "natural=tree"),
      at("n6", 100, -230, "highway=street_lamp"),
    ];
    expect(osmFurnitureItems(plan, points).map((i) => [i.id, i.kind, i.points, i.osm])).toEqual([
      ["osm.furniture.bench", "bench", [[120, -250.1]], ["n3"]],
      ["osm.furniture.tree", "tree", [[100, -240], [140, -245]], ["n2", "n4"]],
    ]);
    expect(withOsmFurniture(plan, points).items.map((i) => i.id)).toEqual(["kp.tree", "osm.furniture.bench", "osm.furniture.tree"]);
    expect(withOsmFurniture(plan, []).items).toEqual(plan.items);
  });
});
