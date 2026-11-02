import { describe, expect, it } from "vitest";
import { buildingsWithTowers, mappedTowers } from "../src/building-towers.ts";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * A church the map has a tower by (G-212): in its tags, or a tower way in its outline or up to
 * 10 m from its walls (wall to wall), imported or not. The import marks it `mappedTower`, so the
 * renderer adds no bell towers of its own beside the real one.
 */

let next = 1;
/** A closed way round the box (x0, z0)-(x1, z1) with the given tags, and its nodes. */
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

const CHURCH = { building: "church", name: "Kościół" };
const BELFRY = { building: "yes", man_made: "tower", "tower:type": "bell_tower" };

/** Churches 40 x 20 m in a row, 100 m apart, each with what stands by it. */
const map = () => {
  next = 1;
  return parseOsmXml(
    [
      "<osm>",
      // A belfry 9 m off its east wall, its middle over 12 m off (St Nicholas's: 7 m and 11 m).
      ...box(1, 0, 0, 40, 20, CHURCH),
      ...box(2, 49, 6, 57, 14, BELFRY),
      // A belfry 12 m off.
      ...box(3, 100, 0, 140, 20, CHURCH),
      ...box(4, 152, 6, 160, 14, BELFRY),
      // A tower part mapped in its outline.
      ...box(5, 200, 0, 240, 20, CHURCH),
      ...box(6, 202, 6, 210, 14, { "building:part": "tower" }),
      // Tower tags of its own.
      ...box(7, 300, 0, 340, 20, { ...CHURCH, "tower:type": "bell_tower" }),
      // A house with a belfry by it: no church, no towers of the renderer's to drop.
      ...box(8, 400, 0, 440, 20, { building: "house" }),
      ...box(9, 443, 6, 451, 14, BELFRY),
      // A church alone.
      ...box(10, 500, 0, 540, 20, CHURCH),
      "</osm>",
    ].join("\n"),
  );
};

const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 600, maxZ: 100 } }];

describe("a church the map has a tower by (G-212)", () => {
  it("is marked by the import: a belfry by its walls, a tower part in it, tower tags of its own", () => {
    const b = generate(map(), () => 200, chunk).chunks[0]!.buildings;
    const marked = b.filter((o) => o.mappedTower).map((o) => o.id);
    expect(marked).toEqual(["w1", "w5", "w7"]);
    expect(b.find((o) => o.id === "w8")?.use).toBe("residential");
  });

  it("measures by the walls from the tower's own walls, not its middle", () => {
    const osm = map();
    const towers = mappedTowers(osm);
    const belfry = towers.find((t) => t.id === "w2")!;
    expect(belfry.x - 40).toBeGreaterThan(12);
    const church = { id: "w1", osmId: 1, tags: CHURCH, holes: 0, ring: [
      { x: 0, z: 0 },
      { x: 40, z: 0 },
      { x: 40, z: 20 },
      { x: 0, z: 20 },
    ] };
    expect(buildingsWithTowers([church], [belfry]).has("w1")).toBe(true);
    expect(buildingsWithTowers([church], [{ ...belfry, ring: [] }]).has("w1"), "its middle alone, over 12 m off").toBe(false);
  });
});
