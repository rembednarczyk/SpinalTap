import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_CHUNKS, DISTRICTS, chunksOf } from "../src/config.ts";
import { emitDistrict } from "../src/emit.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { parseOsmXml } from "../src/osm.ts";
import { REPO } from "../src/paths.ts";
import { worldToGeo } from "../src/project.ts";
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";

/** A tiny map: one building, one street with sidewalks, a café inside the building, on a slope. */
const tinyMap = () => {
  const node = (id: number, x: number, z: number, tags = "") => {
    const g = worldToGeo({ x, z });
    return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}">${tags}</node>`;
  };
  return parseOsmXml(
    [
      "<osm>",
      node(1, 10, 10),
      node(2, 30, 10),
      node(3, 30, 25),
      node(4, 10, 25),
      node(5, 20, 20, '<tag k="amenity" v="cafe"/><tag k="name" v="Kawiarnia"/>'),
      node(6, 0, 0),
      node(7, 100, 0),
      ' <way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="apartments"/><tag k="building:levels" v="3"/></way>',
      ' <way id="101"><nd ref="6"/><nd ref="7"/><tag k="highway" v="residential"/><tag k="name" v="Testowa"/></way>',
      "</osm>",
    ].join("\n"),
  );
};

const tinyChunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
const slope = (p: { x: number; z: number }) => 190 + p.x * 0.05;

describe("generator", () => {
  it("splits districts into chunks of 150-250 m", () => {
    for (const d of DISTRICTS) {
      for (const c of chunksOf(d)) {
        expect(c.rect.maxX - c.rect.minX).toBeGreaterThanOrEqual(150);
        expect(c.rect.maxX - c.rect.minX).toBeLessThanOrEqual(250);
        expect(c.rect.maxZ - c.rect.minZ).toBeGreaterThanOrEqual(150);
        expect(c.rect.maxZ - c.rect.minZ).toBeLessThanOrEqual(250);
      }
    }
    expect(ALL_CHUNKS).toHaveLength(20);
  });

  it("builds a chunk from a small map", () => {
    const { chunks, stats } = generate(tinyMap(), slope, tinyChunk);
    const c = chunks[0]!;
    expect(c.buildings).toHaveLength(1);
    const b = c.buildings[0]!;
    expect(b).toMatchObject({ id: "w100", x: 20, z: 17.5, levels: 3, use: "residential", shopfront: true, source: "levels" });
    // On a 5 % slope across 20 m the plinth is 1 m and the foot is at the low corner.
    expect(b.plinth).toBeCloseTo(1, 1);
    expect(b.y).toBeCloseTo(190 + 10 * 0.05 - LUBLIN_ANCHOR.altitude, 1);
    expect(b.height).toBeCloseTo(4 + 2 * 3.2 + b.plinth, 1);
    expect(c.ground.map((g) => g.surface).sort()).toEqual(["road", "sidewalk", "sidewalk"]);
    expect(c.streets).toEqual([expect.objectContaining({ name: "Testowa", kind: "residential" })]);
    expect(c.pois).toEqual([expect.objectContaining({ name: "Kawiarnia", kind: "food" })]);
    // A plane is followed exactly by the coarsest grid.
    expect(c.terrain.cell).toBe(10);
    expect(stats[0]!.terrainError.max).toBeLessThan(0.1);
  });

  it("cuts a gateway the map tags as a tunnel at street level, but not a network of tunnels under the streets (G-076)", () => {
    const node = (id: number, x: number, z: number) => {
      const g = worldToGeo({ x, z });
      return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
    };
    const way = (id: number, refs: number[], tags: Record<string, string>) =>
      ` <way id="${id}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join("")}</way>`;
    const tunnel = { highway: "footway", tunnel: "yes", layer: "-1" };
    const map = parseOsmXml(
      [
        "<osm>",
        ...[node(1, 10, 10), node(2, 30, 10), node(3, 30, 25), node(4, 10, 25)],
        // The gateway from facade to facade, a street on beyond both.
        ...[node(10, 20, 0), node(11, 20, 10), node(12, 20, 25), node(13, 20, 40)],
        // Two tunnels joined under ground, the first through the house.
        ...[node(20, 5, 17), node(21, 35, 17), node(22, 45, 17)],
        way(100, [1, 2, 3, 4, 1], { building: "apartments", "building:levels": "3" }),
        way(101, [10, 11], { highway: "service" }),
        way(102, [11, 12], { highway: "service", tunnel: "yes", layer: "-1" }),
        way(103, [12, 13], { highway: "service" }),
        way(104, [20, 21], tunnel),
        way(105, [21, 22], tunnel),
        "</osm>",
      ].join("\n"),
    );
    const c = generate(map, slope, tinyChunk).chunks[0]!;
    // One passage only, along the gateway: the tunnel across the house makes none.
    expect(c.passages).toEqual([expect.objectContaining({ building: "w100", from: { x: 20, z: 9.4 }, width: 3.2, height: 4 })]);
    // Paved under the house, as the streets on either side.
    expect(c.ground.filter((g) => g.surface === "road")).toHaveLength(3);
  });

  it("builds nothing of a building the map puts under ground (G-077)", () => {
    const map = tinyMap();
    const house = map.ways.get(100)!;
    const cellar = { ...map, ways: new Map([...map.ways, [100, { ...house, tags: { ...house.tags, location: "underground", layer: "-1" } }]]) };
    expect(generate(cellar, slope, tinyChunk).chunks[0]!.buildings).toEqual([]);
  });

  it("gives the same result twice", () => {
    const a = generate(tinyMap(), slope, tinyChunk);
    const b = generate(tinyMap(), slope, tinyChunk);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("narrows a street of default width to its mapped sidewalks instead of laying asphalt over them (G-082)", () => {
    const node = (id: number, x: number, z: number) => {
      const g = worldToGeo({ x, z });
      return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
    };
    const way = (id: number, a: number, b: number, tags: Record<string, string>) =>
      ` <way id="${id}"><nd ref="${a}"/><nd ref="${b}"/>${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join("")}</way>`;
    // Podwale: sidewalks 2.4 m off the axis of a residential street the map gives no width.
    const map = (street: Record<string, string>) =>
      parseOsmXml(
        ["<osm>", node(1, 0, 0), node(2, 100, 0), node(3, 0, 2.4), node(4, 100, 2.4), node(5, 0, -2.4), node(6, 100, -2.4),
          way(10, 1, 2, { highway: "residential", ...street }),
          way(11, 3, 4, { highway: "footway", footway: "sidewalk" }),
          way(12, 5, 6, { highway: "footway", footway: "sidewalk" }),
          "</osm>"].join("\n"),
      );
    const area = (flat: readonly number[]) => {
      let a = 0;
      for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) a += flat[j]! * flat[i + 1]! - flat[i]! * flat[j + 1]!;
      return Math.abs(a) / 2;
    };
    const ground = (street: Record<string, string>) => generate(map(street), slope, tinyChunk).chunks[0]!.ground;
    const surface = (g: ReturnType<typeof ground>, s: string) => g.filter((x) => x.surface === s).reduce((n, x) => n + area(x.outline), 0);
    const fitted = ground({ oneway: "yes" });
    // Both sidewalks whole, 100 m × 2.5 m each; the asphalt ends half a metre short of their axes: 3.8 m, not 6.5 m.
    expect(surface(fitted, "sidewalk")).toBeCloseTo(500, -1);
    expect(surface(fitted, "road")).toBeCloseTo(380, -1);
    // Two ways: no narrower than two 2.25 m lanes, still short of the sidewalks' middle (G-113).
    const twoWay = ground({});
    expect(surface(twoWay, "sidewalk")).toBeCloseTo(500, -1);
    expect(surface(twoWay, "road")).toBeCloseTo(450, -1);
    // A width or lanes from the map stay as they are, whatever they cover.
    expect(surface(ground({ width: "6" }), "road")).toBeCloseTo(600, -1);
    expect(surface(ground({ lanes: "2" }), "road")).toBeCloseTo(650, -1);
  });

  it("keeps a street's default width where a sidewalk runs on it only by a junction (G-112)", () => {
    const node = (id: number, x: number, z: number) => {
      const g = worldToGeo({ x, z });
      return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
    };
    // 100 m of street; its sidewalk 5 m off, turning in to 2.4 m over the last 20 m before a crossing.
    const map = parseOsmXml(
      ["<osm>", node(1, 0, 0), node(2, 100, 0), node(3, 0, 5), node(4, 80, 5), node(5, 80, 2.4), node(6, 100, 2.4),
        ' <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way>',
        ' <way id="11"><nd ref="3"/><nd ref="4"/><nd ref="5"/><nd ref="6"/><tag k="highway" v="footway"/><tag k="footway" v="sidewalk"/></way>',
        "</osm>"].join("\n"),
    );
    const road = generate(map, slope, tinyChunk).chunks[0]!.ground.find((g) => g.surface === "road")!;
    const zs = road.outline.filter((_, i) => i % 2 === 1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6.5, 1);
  });

  it("keeps a street's default width where its mapped sidewalks lie beyond it (G-082)", () => {
    const node = (id: number, x: number, z: number) => {
      const g = worldToGeo({ x, z });
      return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
    };
    const map = parseOsmXml(
      ["<osm>", node(1, 0, 0), node(2, 100, 0), node(3, 0, 5), node(4, 100, 5),
        ' <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way>',
        ' <way id="11"><nd ref="3"/><nd ref="4"/><tag k="highway" v="footway"/><tag k="footway" v="sidewalk"/></way>',
        "</osm>"].join("\n"),
    );
    const road = generate(map, slope, tinyChunk).chunks[0]!.ground.find((g) => g.surface === "road")!;
    const zs = road.outline.filter((_, i) => i % 2 === 1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6.5, 1);
  });

  it("reproduces the committed tables from the committed raw data, twice", () => {
    const inputs = loadInputs();
    const d = DISTRICTS.find((x) => x.slug === "stare-miasto")!;
    const specs = chunksOf(d);
    const first = emitDistrict(d.slug, d.name, generate(inputs.osm, inputs.src, specs).chunks);
    const second = emitDistrict(d.slug, d.name, generate(loadInputs().osm, inputs.src, specs).chunks);
    expect(second).toBe(first);
    expect(first).toBe(readFileSync(join(REPO, "packages/sim/src/content/lublin/stare-miasto.generated.ts"), "utf8"));
  });
});
