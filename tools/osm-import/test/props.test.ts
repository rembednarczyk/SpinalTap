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
import { loadBuildingTags, loadNodeTags } from "../src/props-art.ts";
import { groundY, lublinDecalWalls, poleLampAt, surfaceY } from "../src/decal-walls.ts";
import { addDecals } from "../src/props-decals.ts";
import type { Pt } from "../src/geometry.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { SHAPES, knownKind, propOf, withShape } from "../src/props-kinds.ts";
import { evenStations, offRoad, offWall, scatter, stations } from "../src/props-place.ts";
import { Site } from "../src/props-site.ts";
import { SolidIndex, clearSpot } from "../src/props-solid.ts";
import { gameDoors } from "../src/game-doors.ts";
import { loadCarriageways } from "../src/props-roads.ts";
import { lublinVenueBoards } from "../src/venue-boards.ts";

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
  markings: [],
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
        // A bollard's chains take 25 bits (G-032), the rest's variant 16.
        expect(Number.isInteger(i.variant) && i.variant >= 0 && i.variant <= (i.prop === "bollard" ? 0x1ffffff : 0xffff)).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(3000);
    expect(a.stats.perKind["lamp-pastoral"]).toBeGreaterThan(50);
    expect(a.stats.perKind["lamp-wall-lantern"]).toBeGreaterThan(100);
  });

  it("matches the committed table (run `pnpm osm:props` after changing the plan or the rules)", () => {
    const committed = readFileSync(join(REPO, "packages/sim/src/content/lublin/props.generated.ts"), "utf8");
    const market = { roads: loadCarriageways(), doors: gameDoors() };
    const { byChunk } = generateProps(PLAN, CHUNKS, loadNodeTags(), lublinVenueBoards(), market);
    // The decals after the furniture (ADR-0058 stage 6), as `props.ts` adds them.
    const ctx = { groundY: (p: Pt) => groundY(p.x, p.z), surfaceY: (p: Pt) => surfaceY(p.x, p.z), buildingTags: loadBuildingTags(), poleLamp: poleLampAt };
    addDecals(byChunk as Map<string, StreetPropItem[]>, new Site(CHUNKS), lublinDecalWalls(), ctx);
    expect(emitProps(byChunk)).toBe(committed);
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

  it("hangs no wall lantern in a gate's passage or in its mouth, on the facades beside it as before (G-173)", () => {
    // A gate house over the street, x 40..52, with the street's passage through it (Brama Grodzka, Ku Farze).
    const gate = { ...street().buildings[0]!, id: "w2", x: 46, z: 30, outline: [-6, -8, 6, -8, 6, 8, -6, 8] };
    const passage = { building: "w2", from: { x: 38.5, z: 30 }, to: { x: 53.5, z: 30 }, width: 3.4, height: 4, rise: 1.1 };
    const plan: PropsPlan = { items: [{ id: "wall", kind: "lamp-wall-lantern", lines: [[0, 30, 100, 30]], spacing: 5 }] };
    // Brama Krakowska's passage is the game's own, not the chunk's: the gate's solid alone keeps the lanterns out.
    for (const passages of [[passage], undefined]) {
      const chunk: LublinChunkData = { ...street(), buildings: [...street().buildings, gate], ...(passages ? { passages } : {}) };
      const site = new Site([chunk]);
      const lanterns = generateProps(plan, [chunk]).byChunk.get("test-0-0")!.filter((i) => i.prop === "lamp-wall-lantern");
      expect(lanterns.filter((l) => site.surfaceAt(l) === "building" || (passages && l.x > 36.5 && l.x < 55.5 && Math.abs(l.z - 30) < 2))).toEqual([]);
      // The houses' facade either side of the gate keeps its lanterns.
      expect(lanterns.filter((l) => Math.abs(l.z - 37.7) < 0.1 && (l.x < 38 || l.x > 54)).length).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps a lamp of a paved square off the axis of the car street beside it (G-004)", () => {
    // Plac Zamkowy: a car street on the square's cobbles, no carriageway drawn, and a second one 4 m off for its first 20 m.
    const square: LublinChunkData = {
      ...street(),
      buildings: [],
      ground: [{ surface: "cobble", outline: [0, 10, 100, 10, 100, 50, 0, 50] }],
      streets: [
        { name: "Plac", kind: "residential", line: [0, 30, 100, 30] },
        { name: "Plac", kind: "residential", line: [0, 34, 20, 34] },
      ],
    };
    const plan: PropsPlan = { items: [{ id: "lamps", kind: "lamp-candelabra", lines: [[0, 30, 100, 30]], spacing: 25 }] };
    const lamps = generateProps(plan, [square]).byChunk.get("test-0-0")!;
    expect(lamps.map((l) => l.x)).toEqual([37.5, 62.5, 87.5]);
    for (const l of lamps) expect(Math.hypot(Math.max(l.x - 20, 0), l.z - 34), `lamp at ${l.x}, ${l.z}`).toBeGreaterThan(3);
  });

  it("hangs a basket only on a lamp that stays, where it stands (G-004)", () => {
    // The second row runs 3 m behind the first, so its lamps are merged away; the baskets were picked from both.
    const plan: PropsPlan = {
      items: [
        { id: "a", kind: "lamp-pastoral", lines: [[0, 30, 100, 30]], spacing: 25 },
        { id: "b", kind: "lamp-pastoral", lines: [[3, 30, 100, 30]], spacing: 25 },
        { id: "baskets", kind: "hanging-basket", lines: [[0, 30, 100, 30]], count: 8 },
      ],
    };
    const items = generateProps(plan, [street()]).byChunk.get("test-0-0")!;
    const lamps = items.filter((i) => i.prop === "lamp-pastoral");
    const baskets = items.filter((i) => i.prop === "hanging-basket");
    expect(lamps).toHaveLength(4);
    expect(baskets.length).toBeGreaterThan(0);
    for (const b of baskets) expect(lamps.some((l) => l.x === b.x && l.z === b.z), `basket at ${b.x}, ${b.z}`).toBe(true);
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

  it("moves a traffic light from its node in the road's axis onto the pavement; covers and bollards stay", () => {
    const site = new Site([street()]);
    const at = offRoad(site, { x: 40, z: 30.5 })!;
    expect(site.surfaceAt(at)).toBe("walk");
    expect(at.x).toBeCloseTo(40, 5);
    expect(at.z).toBeCloseTo(34.6, 1);
    expect(offRoad(site, { x: 40, z: 24 })).toEqual({ x: 40, z: 24 });
    expect(offRoad(site, { x: 40, z: 30 }, 2)).toBeNull();
    // Over the whole city: only covers and bollards stand where the cars drive.
    const { byChunk } = generateProps(PLAN, CHUNKS);
    const city = new Site(CHUNKS);
    const onRoad = [...byChunk.values()].flat().filter((i) => city.surfaceAt({ x: i.x, z: i.z }) === "road");
    expect(onRoad.filter((i) => i.prop !== "manhole" && i.prop !== "bollard").length).toBeLessThanOrEqual(1);
  });

  it("moves a sculpture from a node on a facade out of the wall by its footprint", () => {
    const site = new Site([street()]);
    // The houses' south wall is on z = 38.
    const at = offWall(site, { x: 50, z: 37.8 }, 1.5)!;
    expect(at.z).toBeLessThanOrEqual(36.5);
    expect(offWall(site, { x: 50, z: 30 }, 1.5)).toEqual({ x: 50, z: 30 });
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
    expect(unia && unia.variant % (SHAPES.monument ?? 1)).toBe(0);
  });

  it("steps a piece placed later out of the solids placed before it, or drops it with no room (G-012)", () => {
    const solids = new SolidIndex();
    solids.add({ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant: 0 });
    const bin = { prop: "waste-bin" as const, x: 0.1, y: 0, z: 0.1, yaw: 0, variant: 0 };
    expect(solids.clashes(bin)).toBe(true);
    const moved = clearSpot(solids, bin, () => true)!;
    expect(solids.clashes(moved)).toBe(false);
    expect(Math.hypot(moved.x - bin.x, moved.z - bin.z)).toBeLessThanOrEqual(1.6);
    expect(clearSpot(solids, bin, () => false)).toBeNull();
    // Bollards keep to their own rows; nothing else is held to them.
    expect(solids.clashes({ ...bin, prop: "bollard" })).toBe(false);
  });
});
