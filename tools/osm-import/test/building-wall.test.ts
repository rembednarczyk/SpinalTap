import { describe, expect, it } from "vitest";
import { parseWallColour, wallOf } from "../src/building-wall.ts";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * The walls of the map (G-244): `building:material` and `building:colour` of a building's or a
 * part's own element reach the game's data, so the renderer can draw the Gothic keep in brick.
 */

let next = 1;
const box = (id: number, x0: number, z0: number, x1: number, z1: number, tags: Record<string, string>): string[] => {
  const ids = [next++, next++, next++, next++];
  const nodes = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map(([x, z], i) => {
    const g = worldToGeo({ x: x!, z: z! });
    return ` <node id="${ids[i]}" lat="${g.lat}" lon="${g.lon}"/>`;
  });
  const tagXml = Object.entries(tags)
    .map(([k, v]) => `<tag k="${k}" v="${v}"/>`)
    .join("");
  return [...nodes, ` <way id="${id}">${[...ids, ids[0]].map((n) => `<nd ref="${n}"/>`).join("")}${tagXml}</way>`];
};

const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 600, maxZ: 100 } }];

describe("the walls of the map (G-244)", () => {
  it("reads the material and the colour, each only where the map has it", () => {
    expect(wallOf({ "building:material": "brick" })).toEqual({ material: "brick" });
    expect(wallOf({ "building:material": "Limestone" })).toEqual({ material: "stone" });
    expect(wallOf({ "building:material": "plaster", "building:colour": "beige" })).toEqual({ material: "plaster", colour: "#f5f5dc" });
    expect(wallOf({ "building:material": "concrete" }), "a material the renderer draws no differently").toEqual({});
    expect(wallOf({ building: "yes" })).toEqual({});
    expect(parseWallColour("#F5EEB6")).toBe("#f5eeb6");
    expect(parseWallColour("#abc")).toBe("#aabbcc");
    expect(parseWallColour("light grey")).toBe("#d3d3d3");
    expect(parseWallColour("chartreuse-ish")).toBeNull();
  });

  it("carries them into a building's data and a lifted part's, not into a building's without them", () => {
    next = 1;
    const osm = parseOsmXml(
      [
        "<osm>",
        ...box(1, 0, 0, 20, 20, { building: "yes", historic: "city_gate", "building:levels": "2", "building:material": "brick" }),
        // A tower part rising out of it, brick too; a plastered part beside it.
        ...box(2, 5, 5, 12, 12, { "building:part": "yes", "building:levels": "5", "building:material": "brick" }),
        ...box(3, 100, 0, 120, 20, { building: "church", "building:colour": "lightgrey" }),
        ...box(4, 200, 0, 220, 20, { building: "house" }),
        "</osm>",
      ].join("\n"),
    );
    const b = generate(osm, () => 200, chunk).chunks[0]!.buildings;
    const of = (id: string) => b.find((o) => o.id === id);
    expect(of("w1")?.material).toBe("brick");
    expect(of("w2")?.soffit, "the part is lifted onto the gate").toBeDefined();
    expect(of("w2")?.material).toBe("brick");
    expect(of("w3")).toMatchObject({ colour: "#d3d3d3" });
    expect(of("w3")?.material).toBeUndefined();
    expect(of("w4")?.material).toBeUndefined();
    expect(of("w4")?.colour).toBeUndefined();
  });
});
