import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { HAND_HEIGHTS, LOD1_MAX_CHANGE, lod1Exempt, lod1Index, lod1Massing, lod1Match, worldRing } from "../src/lod1-heights.ts";

/** Heights from GUGiK LoD1 2024 where the map gives none (ADR-0077 step 3). */

const inputs = loadInputs();
const index = lod1Index(inputs.lod1);
const measured = (b: { x: number; z: number; outline: readonly number[] }) => lod1Match(index, worldRing(b))?.lod1.height;

describe("the eaves from LoD1 measuredHeight", () => {
  const house = { height: 13.2, plinth: 0, levels: 4, source: "default" as const };

  it("puts the middle of the roof at measuredHeight, storeys from the walls", () => {
    expect(lod1Massing(house, 7)).toEqual({ height: 7, levels: 2 });
    expect(lod1Massing({ ...house, roof: 4 }, 17.5)).toEqual({ height: 15.5, levels: 5 });
    // A shop floor of 4 m first.
    expect(lod1Massing({ ...house, shopfront: true }, 10.4)).toEqual({ height: 10.4, levels: 3 });
  });

  it(`moves the eaves at most ${LOD1_MAX_CHANGE} m and keeps a storey over the plinth`, () => {
    expect(lod1Massing(house, 30).height).toBe(23.2);
    expect(lod1Massing(house, 1).height).toBe(3.2);
    // Kowalska 7 on the Old Town's scarp: LoD1 counts from the lowest ground, the plinth included.
    expect(lod1Massing({ height: 24.9, plinth: 12.1, levels: 4, source: "levels" }, 14.2)).toEqual({ height: 15.3, levels: 1 });
  });

  it("keeps the map's building:levels unless a storey would come out under 2.6 m", () => {
    expect(lod1Massing({ ...house, source: "levels" }, 19).levels).toBe(4);
    expect(lod1Massing({ ...house, source: "levels" }, 8).levels).toBe(3);
  });
});

describe("what keeps its own height", () => {
  const plain = { id: "w1", use: "residential" as const };

  it("churches, towers, parts and buildings crowned by them; not historic buildings (G-632)", () => {
    expect(lod1Exempt(plain)).toBeUndefined();
    expect(lod1Exempt({ ...plain, use: "church" })).toBe("church");
    expect(lod1Exempt({ ...plain, use: "historic" })).toBeUndefined();
    expect(lod1Exempt({ ...plain, tower: true })).toBe("tower");
    expect(lod1Exempt({ ...plain, mappedTower: true })).toBe("tower");
    expect(lod1Exempt({ ...plain, soffit: 10 })).toBe("part");
    expect(lod1Exempt(plain, true)).toBe("parts");
    // Teatr Osterwy and Trybunał Koronny: landmarks of the curator's audits, a split piece by its whole's id.
    expect(lod1Exempt({ ...plain, id: "w67508958", use: "civic" })).toBe("landmark");
    expect(lod1Exempt({ ...plain, id: "w66264159/1", use: "civic" })).toBe("landmark");
  });

  it("heights, storeys and roofs set by a correction, and areas added by hand", () => {
    // Brama Krakowska's annex, `height` from the photograph (T-033).
    expect(HAND_HEIGHTS.has("w617597406")).toBe(true);
    expect(lod1Exempt({ ...plain, id: "w617597406" })).toBe("hand");
    expect(lod1Exempt({ ...plain, id: "T-245/lawn" })).toBe("added");
  });
});

describe("the import's heights", () => {
  /** A chunk of its own round a building the map's chunks leave out (centroid past the edge, G-556). */
  const around = (x: number, z: number) => [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: x - 30, minZ: z - 30, maxX: x + 30, maxZ: z + 30 } }];
  const built = (id: string, x: number, z: number, lod1?: typeof inputs.lod1) =>
    generate(inputs.osm, inputs.src, around(x, z), undefined, lod1).chunks[0]!.buildings.find((b) => b.id === id)!;

  it.each([
    // The curator's examples (G-601): Cicha 6 about 7 m, Cicha 8 about 17.5 m, XVI LO about 6 m too low.
    ["Cicha 6", "w55897094", -208, 135],
    ["Cicha 8", "w55897093", -203, 150],
    ["XVI LO, Bernardyńska 14", "w66330436", 464, -287],
  ])("%s: from the tags' guess to LoD1", (_, id, x, z) => {
    const before = built(id, x, z);
    const after = built(id, x, z, inputs.lod1);
    const m = measured(after)!;
    expect(Math.abs(before.height + (before.roof ?? 0) / 2 - m)).toBeGreaterThan(3);
    expect(after.source).toBe("lod1");
    expect(after.height + (after.roof ?? 0) / 2).toBeCloseTo(m, 0);
  });

  const tables = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS].flatMap((c) => c.buildings);
  const game = (id: string) => tables.find((b) => b.id === id)!;

  it.each([
    // Default heights 7 m and more off LoD1 in the GUGiK report.
    ["Kościuszki 3 / Peowiaków 8", "w69661079"],
    ["Żołnierzy Niepodległej 3", "w55897077"],
    ["3 Maja 12", "w55897061"],
    ["Cyrulicza 3", "w232362892"],
    ["a yard building off Krakowskie Przedmieście", "w67508896"],
    // A historic building without a tower (G-632).
    ["Pałac Zylbera", "w55897095"],
  ])("%s stands in the committed tables at its LoD1 height", (_, id) => {
    const b = game(id);
    expect(b.source).toBe("lod1");
    expect(b.height + (b.roof ?? 0) / 2).toBeCloseTo(measured(b)!, 0);
  });

  it("leaves Teatr Osterwy (a landmark) and a measured church as the tags have them", () => {
    expect(game("w67508958").source).toBe("default");
    expect(game("w66264159").source).toBe("levels");
    expect(game("w66264082").source).toBe("height");
  });
});
