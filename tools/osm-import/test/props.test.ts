import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { terrainHeightAt } from "../../../packages/core/src/world/city-geo.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { REPO } from "../src/paths.ts";
import { emitProps } from "../src/props-emit.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { SHAPES, knownKind, propOf, withShape } from "../src/props-kinds.ts";
import { evenStations, scatter, stations } from "../src/props-place.ts";
import { Site } from "../src/props-site.ts";

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

/** A 100 x 60 m chunk: an east-west road 8 m wide on z = 30, sidewalks 4 m on both sides, a row of houses north of it. */
const street = (): LublinChunkData => ({
  id: "test-0-0",
  district: "kanal",
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
  terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 1, 2, 0, 1, 2] },
  buildings: [{ id: "w1", x: 50, z: 45, y: 0, outline: [-50, -7, 50, -7, 50, 7, -50, 7], parts: [], height: 12, plinth: 0, levels: 3, use: "residential", look: 1, source: "default" }],
  ground: [
    { surface: "sidewalk", outline: [0, 22, 100, 22, 100, 38, 0, 38] },
    { surface: "road", outline: [0, 26, 100, 26, 100, 34, 0, 34] },
  ],
  streets: [{ name: "Testowa", kind: "residential", line: [0, 30, 100, 30] }],
  pois: [],
});

describe("street furniture generator (ADR-0047)", () => {
  it("knows every kind of the plan: drawn, mapped to the nearest prop, or left out with a reason", () => {
    for (const item of PLAN.items) expect(knownKind(item.kind), item.kind).toBe(true);
    expect(propOf("trolley-wire")).toBe("trolley-pole");
    expect(propOf("crossing")).toBeNull();
  });

  it("is deterministic and places nothing outside its chunk, every piece on the chunk's terrain", () => {
    const a = generateProps(PLAN, CHUNKS);
    const b = generateProps(PLAN, CHUNKS);
    expect([...a.byChunk.entries()]).toEqual([...b.byChunk.entries()]);
    let total = 0;
    for (const c of CHUNKS) {
      for (const i of a.byChunk.get(c.id) ?? []) {
        total++;
        expect(i.x >= c.bounds.minX - 0.05 && i.x <= c.bounds.maxX + 0.05 && i.z >= c.bounds.minZ - 0.05 && i.z <= c.bounds.maxZ + 0.05, `${i.prop} in ${c.id}`).toBe(true);
        expect(Math.abs(i.y - terrainHeightAt(c.terrain, i.x, i.z))).toBeLessThan(0.2);
        expect(Number.isInteger(i.variant) && i.variant >= 0 && i.variant <= 0xffff).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(3000);
    expect(a.stats.perKind["lamp-pastoral"]).toBeGreaterThan(50);
    expect(a.stats.perKind["lamp-wall-lantern"]).toBeGreaterThan(100);
  });

  it("matches the committed table (run `pnpm osm:props` after changing the plan or the rules)", () => {
    const committed = readFileSync(join(REPO, "packages/sim/src/content/lublin/props.generated.ts"), "utf8");
    expect(emitProps(generateProps(PLAN, CHUNKS).byChunk)).toBe(committed);
  });

  it("stands lamps on the pavement beside the road on both sides, their arms towards it, and lanterns on the facades", () => {
    const plan: PropsPlan = {
      items: [
        { id: "lamps", kind: "lamp-pastoral", lines: [[0, 30, 100, 30]], spacing: 25, note: "stawiać po obu stronach" },
        { id: "wall", kind: "lamp-wall-lantern", lines: [[0, 30, 100, 30]], spacing: 20 },
      ],
    };
    const items = generateProps(plan, [street()]).byChunk.get("test-0-0")!;
    const lamps = items.filter((i) => i.prop === "lamp-pastoral");
    // Four stations a side, the far row half a spacing on; its last one sits on the chunk's east edge and belongs to the next chunk.
    expect(lamps).toHaveLength(7);
    for (const l of lamps) {
      const d = Math.abs(l.z - 30);
      expect(d).toBeGreaterThan(4);
      expect(d).toBeLessThan(6);
      // Facing the axis: north of it faces south (yaw ±π), south of it faces north (yaw 0).
      expect(Math.abs(Math.cos(l.yaw) - (l.z > 30 ? -1 : 1))).toBeLessThan(1e-4);
    }
    const lanterns = items.filter((i) => i.prop === "lamp-wall-lantern");
    expect(lanterns).toHaveLength(5);
    for (const l of lanterns) expect(l.z).toBeCloseTo(37.7, 1);
  });

  it("spreads lines and areas deterministically, inside the area and off the buildings", () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ];
    expect(stations(line, 5).map((s) => s.s)).toEqual([2.5, 7.5, 12.5, 17.5]);
    expect(evenStations([line, line], 4)).toHaveLength(4);
    const site = new Site([street()]);
    const ring = [
      { x: 5, z: 2 },
      { x: 95, z: 2 },
      { x: 95, z: 50 },
      { x: 5, z: 50 },
    ];
    const a = scatter(site, ring, 20, "stalls", 3);
    expect(a).toEqual(scatter(site, ring, 20, "stalls", 3));
    expect(a).toHaveLength(20);
    for (const p of a) expect(site.surfaceAt(p)).not.toBe("building");
  });

  it("forces the shapes the plan names into the variant's low bits", () => {
    for (const h of [0, 1, 777, 0xffff]) {
      for (let s = 0; s < (SHAPES.monument ?? 1); s++) {
        const v = withShape(h, "monument", s);
        expect(v % (SHAPES.monument ?? 1)).toBe(s);
        expect(v).toBeLessThanOrEqual(0xffff);
      }
    }
    const out = generateProps(PLAN, CHUNKS);
    const unia = [...out.byChunk.values()].flat().find((i) => i.prop === "monument" && Math.abs(i.x - 47.8) < 0.2 && Math.abs(i.z + 25.7) < 0.2);
    expect(unia && unia.variant % 4).toBe(0);
  });
});
