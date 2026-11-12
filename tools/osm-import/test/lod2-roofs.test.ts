import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { type Ring3, mainRoof } from "../../gugik/src/citygml.ts";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { lod1Index, lod1Match, worldRing } from "../src/lod1-heights.ts";
import { hasRoofTags, lod2Index, lod2Massing, lod2Match, lod2Shape, withLod2Roof } from "../src/lod2-roofs.ts";
import { type BuildingOut } from "../src/model.ts";

/** Walls and roofs from GUGiK LoD2 2017 where the map has no roof (ADR-0077 step 4, G-639). */

const inputs = loadInputs();

describe("the main mass of a LoD2 roof", () => {
  /** A slope from (x0, y) at `lo` up to (x1, y) at `hi`, `w` wide: a ring of grid points. */
  const slope = (x0: number, x1: number, y: number, w: number, lo: number, hi: number): Ring3 => [
    [x0, y, lo],
    [x0, y + w, lo],
    [x1, y + w, hi],
    [x1, y, hi],
  ];

  it("grows from the largest surface through the surfaces sharing its edges: a mansard's lower slopes", () => {
    // Pałac Parysów's shape: steep lower slopes 10.7 → 15.0 m under a gentle roof 15.0 → 18.2 m.
    const lower = slope(0, 1, 0, 20, 10.7, 15);
    const upper = slope(1, 8, 0, 20, 15, 18.2);
    expect(mainRoof([lower, upper])).toMatchObject({ eaves: 10.7, ridge: 18.2 });
  });

  it("leaves out the roof of an annex meeting the main mass's walls (T-257: Lublinianka 4.3 m)", () => {
    const main = slope(0, 10, 0, 30, 17, 21);
    const annex = slope(20, 25, 0, 10, 4.3, 4.5);
    expect(mainRoof([annex, main])).toMatchObject({ eaves: 17, ridge: 21, shellEaves: 17 });
    expect(mainRoof([])).toBeUndefined();
  });

  it("does not take the eaves from a sliver of the shell (Złota 5: 3.1 m² at 11.3 m, slopes from 13.0 m)", () => {
    const main = slope(0, 8, 0, 20, 13, 18);
    const sliver: Ring3 = [
      [0, 0, 13],
      [0, 20, 13],
      [-0.1, 10, 11.3],
    ];
    expect(mainRoof([main, sliver])).toMatchObject({ eaves: 13, ridge: 18, shellEaves: 11.3 });
  });

  it("gives the fall of the largest surface: the ridge runs across it", () => {
    // Rising to the east: falling to the west; flat: no fall.
    const fall = mainRoof([slope(0, 8, 0, 20, 13, 18)])!.fall!;
    expect(fall.e).toBeCloseTo(-1, 6);
    expect(fall.n).toBeCloseTo(0, 6);
    expect(mainRoof([slope(0, 8, 0, 20, 13, 13.2)])!.fall).toBeUndefined();
  });
});

describe("the walls and the roof from LoD2", () => {
  const roof = { eaves: 10.7, ridge: 18.2, shape: "hipped" as const };

  it("puts the walls at the eaves, the roof up to the ridge and the storeys from the walls", () => {
    expect(lod2Massing({ plinth: 0.7, shopfront: true }, roof)).toEqual({ height: 10.7, roof: 7.5, roofShape: "hipped", levels: 3, plinth: 0.7 });
    expect(lod2Massing({ plinth: 0 }, roof).levels).toBe(3);
    // At least a storey over the plinth.
    expect(lod2Massing({ plinth: 9 }, roof)).toMatchObject({ height: 12.2, roof: 6, levels: 1 });
  });

  it("keeps the map's building:levels, the plinth cut under them where they fit only from the foot (G-629)", () => {
    expect(lod2Massing({ plinth: 1 }, roof, 3)).toMatchObject({ height: 10.7, levels: 3, plinth: 1 });
    expect(lod2Massing({ plinth: 12.1 }, { ...roof, eaves: 11.1 }, 4)).toMatchObject({ height: 11.1, levels: 4, plinth: 0 });
  });

  it("draws LoD2's roof types the renderer has, a combination as a hipped roof, a flat one not at all", () => {
    expect(lod2Shape(1030)).toBe("gabled");
    expect(lod2Shape(1050)).toBe("half-hipped");
    expect(lod2Shape(1060)).toBe("mansard");
    expect(lod2Shape(1130)).toBe("hipped");
    expect(lod2Shape(undefined)).toBe("hipped");
    expect(lod2Shape(1000)).toBeUndefined();
  });

  it("takes any roof:* tag of the map for a roof of its own", () => {
    expect(hasRoofTags({ building: "yes", "roof:colour": "red" })).toBe(true);
    expect(hasRoofTags({ building: "yes", "building:levels": "3" })).toBe(false);
  });
});

describe("the import's roofs", () => {
  const index2 = lod2Index(inputs.lod2);
  const index1 = lod1Index(inputs.lod1);
  const tables = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS].flatMap((c) => c.buildings);
  const game = (id: string) => tables.find((b) => b.id === id)!;
  const around = (x: number, z: number) => [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: x - 30, minZ: z - 30, maxX: x + 30, maxZ: z + 30 } }];
  const built = (id: string, x: number, z: number, lod2?: typeof inputs.lod2) =>
    generate(inputs.osm, inputs.src, around(x, z), undefined, inputs.lod1, lod2).chunks[0]!.buildings.find((b) => b.id === id)!;

  it("stands Pałac Parysów at its LoD2 eaves with a roof to the ridge, three storeys, not flat at the ridge (G-639)", () => {
    const flat = built("w66330695", 347, -149);
    expect(flat.roof ?? 0).toBe(0);
    expect(flat.height).toBeGreaterThan(17);
    const b = built("w66330695", 347, -149, inputs.lod2);
    expect(b.source).toBe("lod2");
    expect(b.height).toBeCloseTo(10.7, 1);
    expect(b.height + b.roof!).toBeCloseTo(18.2, 1);
    expect(b.roofShape).toBe("hipped");
    expect(b.levels).toBe(3);
    expect(game("w66330695")).toMatchObject({ source: "lod2", height: b.height, roof: b.roof, levels: 3 });
  });

  it.each([
    // T-257: LoD2's lowest eaves are a low annex's; the main mass's stand.
    ["Centrum Kultury", "r1071050", 11.2],
    ["Pałac Potockich", "w69915848", 10.9],
    ["Kamienica Archidiakońska 5", "w66293640", 9.5],
  ])("%s stands at the main mass's eaves", (_, id, eaves) => {
    const b = game(id);
    expect(b.source).toBe("lod2");
    expect(b.height).toBeCloseTo(eaves, 1);
    expect(b.roof!).toBeGreaterThan(4);
  });

  it("leaves the landmarks, buildings with roof tags and a mapped height, and LoD2 at odds with the map's storeys", () => {
    // Teatr Osterwy: a landmark of the list at its corrected height.
    expect(game("w67508958").source).toBe("height");
    // Kamienica Złota 5: five storeys in the map, LoD2's eaves at 11.3 m.
    expect(game("w66293771").source).toBe("lod1");
    for (const b of tables.filter((t) => t.source === "lod2")) expect(hasRoofTags(inputs.osm.ways.get(Number(b.id.slice(1)))?.tags ?? {}), b.id).toBe(false);
  });

  it("keeps LoD1's height where LoD1 2024 lies outside LoD2 2017's eaves to ridge: the building changed", () => {
    const { roof: _roof, roofShape: _shape, ...b } = game("w66330695") as BuildingOut;
    const lod1 = lod1Match(index1, worldRing(b))!.lod1;
    const moved = lod1Index([{ ...lod1, height: lod2Match(index2, worldRing(b))!.lod2.mainRidge! + 4 }]);
    const flat: BuildingOut = { ...b, height: 18.1, levels: 5, source: "lod1" };
    const ctx = { lod2: index2, tags: {}, crowned: false };
    expect(withLod2Roof(flat, ctx).source).toBe("lod2");
    expect(withLod2Roof(flat, { ...ctx, lod1: moved }).source).toBe("lod1");
    expect(withLod2Roof(flat, { ...ctx, tags: { "roof:shape": "flat" } }).source).toBe("lod1");
  });
});
