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

  it("gives the same result twice", () => {
    const a = generate(tinyMap(), slope, tinyChunk);
    const b = generate(tinyMap(), slope, tinyChunk);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
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
