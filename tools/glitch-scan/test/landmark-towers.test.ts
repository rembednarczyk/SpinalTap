import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type MapBuilding, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { type Tags, mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { type BuildingSource } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { type TowerEntry, doubleTowers, fakeTowers, hasParts, mappedTowers, towerMapped, towerTips, towersOffBuilding } from "./landmark-towers";

/**
 * The glitch scan's check `landmark-fake-tower` (G-210): a church of its own far from the map's
 * districts, on the list, without parts and without a tower in the map, gets the renderer's bell
 * towers and is found; each condition turned the other way, it is not. The same for its kin
 * `landmark-double-tower` and `church-tower-off-building` (G-212).
 */

const ring = cleanRing([
  { x: 5000, z: 5000 },
  { x: 5040, z: 5000 },
  { x: 5040, z: 5030 },
  { x: 5000, z: 5030 },
]);
const church: MapBuilding = { id: 1, ring, base: 0, foot: 0, height: 15, levels: 4, use: "church", look: 3, roof: 6, name: "Kościół" };
const entry = (b: Partial<MapBuilding> = {}, e: Partial<TowerEntry> = {}): TowerEntry => ({ id: "w1", x: 5020, z: 5015, ring: b.ring ?? ring, frame: facadeFrame({ ...church, ...b }, () => null), parts: false, mapped: false, ...e });

describe("landmark-fake-tower (G-210)", () => {
  it("finds a listed church without parts and without a mapped tower that gets the renderer's towers", () => {
    expect(fakeTowers(["w1"], [entry()])).toEqual([{ at: "5020,5015", what: expect.stringMatching(/^w1 Kościół: \d+ vertices of towers$/) }]);
    // A piece of a split outline counts by its whole's id.
    expect(fakeTowers(["w1"], [entry({}, { id: "w1/2" })])).toHaveLength(1);
  });

  it("finds nothing with any condition turned", () => {
    expect(fakeTowers(["w2"], [entry()]), "not on the list").toEqual([]);
    expect(fakeTowers(["w1"], [entry({}, { parts: true })]), "a part, or parts on it").toEqual([]);
    expect(fakeTowers(["w1"], [entry({}, { mapped: true })]), "a tower in the map").toEqual([]);
    expect(fakeTowers(["w1"], [entry({ use: "historic" })]), "no towers from the renderer").toEqual([]);
  });

  it("takes a part, and a building a part stands on, as having parts", () => {
    const view = { kind: "building", outline: [], height: 15, levels: 4, use: "church", look: 3 } as BuildingSource["view"];
    const at = { x: 5020, y: 0, z: 5015 };
    const body: BuildingSource = { ring, view, at };
    const turret: BuildingSource = { ring: cleanRing(ring.map((p) => ({ x: 5016 + (p.x - 5000) / 10, z: 5012 + (p.z - 5000) / 10 }))), view: { ...view, soffit: 15 }, at };
    const aside: BuildingSource = { ...turret, ring: turret.ring.map((p) => ({ x: p.x + 100, z: p.z })) };
    expect(hasParts(body, [])).toBe(false);
    expect(hasParts(body, [aside]), "a part of another building").toBe(false);
    expect(hasParts(body, [turret]), "a part on it").toBe(true);
    expect(hasParts(turret, [turret]), "a part itself").toBe(true);
  });

  it("takes a tower in the tags, in the outline or by the walls as the map's, and none farther off", () => {
    expect(towerMapped({}, ring, [])).toBe(false);
    for (const tags of [{ man_made: "tower" }, { "tower:type": "bell_tower" }, { building: "bell_tower" }, { building: "tower" }, { "building:part": "tower" }] as Tags[]) expect(towerMapped(tags, ring, []), JSON.stringify(tags)).toBe(true);
    // In the outline 15 m from its walls, 8 m outside them, 15 m outside.
    expect(towerMapped({ building: "church" }, ring, [{ id: "w9", x: 5020, z: 5015, ring: [] }])).toBe(true);
    expect(towerMapped({}, ring, [{ id: "w9", x: 5048, z: 5015, ring: [] }])).toBe(true);
    expect(towerMapped({}, ring, [{ id: "w9", x: 5055, z: 5015, ring: [] }])).toBe(false);
    // Its middle 12 m off, its walls 8 m (St Nicholas's belfry, G-212); 15 m off, its walls 12 m.
    const belfry = (x: number) => ({ id: "w9", x, z: 5015, ring: [-4, 4].flatMap((dx) => [-4, 4].map((dz) => ({ x: x + dx, z: 5015 + dz }))) });
    expect(towerMapped({}, ring, [belfry(5052)])).toBe(true);
    expect(towerMapped({}, ring, [belfry(5056)])).toBe(false);
  });

  it("landmark-double-tower (G-212): finds a church with a mapped tower, without parts, that gets the renderer's towers", () => {
    const mapped = { mapped: true };
    expect(doubleTowers([entry({}, mapped)])).toEqual([{ at: "5020,5015", what: expect.stringMatching(/^w1 Kościół: \d+ vertices of towers by the map's$/) }]);
    expect(doubleTowers([entry()]), "no tower in the map").toEqual([]);
    expect(doubleTowers([entry({}, { ...mapped, parts: true })]), "a part, or parts on it").toEqual([]);
    expect(doubleTowers([entry({ use: "historic" }, mapped)]), "not a church").toEqual([]);
    expect(doubleTowers([entry({ towerless: true }, mapped)]), "no towers from the renderer").toEqual([]);
  });

  it("church-tower-off-building (G-212): finds a tower of the renderer's with its middle off the outline, none on it", () => {
    // An L: the box's north-west corner is grass, where the second of the two towers across the west end falls.
    const bent = cleanRing([
      { x: 5000, z: 5000 },
      { x: 5040, z: 5000 },
      { x: 5040, z: 5030 },
      { x: 5014, z: 5030 },
      { x: 5014, z: 5015 },
      { x: 5000, z: 5015 },
    ]);
    const box = cleanRing([...bent.slice(0, 3), { x: 5000, z: 5030 }]);
    // The towers as the renderer stood them before: across the west end of the L's box, one on the grass.
    const tips = towerTips(facadeFrame({ ...church, ring: box }, () => null));
    expect(tips).toHaveLength(2);
    const grass = tips.filter((t) => !pointInRing(t, bent));
    expect(grass).toHaveLength(1);
    const boxed = (e: Partial<TowerEntry> = {}, b: Partial<MapBuilding> = {}) => entry({ ring: box, ...b }, { ring: bent, ...e });
    expect(towersOffBuilding([boxed()]), "towers of the box on the L").toEqual([{ at: `${grass[0]!.x.toFixed(0)},${grass[0]!.z.toFixed(0)}`, what: "w1 Kościół: a tower off the building" }]);
    expect(towersOffBuilding([boxed({ ring: box })]), "on the box itself").toEqual([]);
    expect(towersOffBuilding([boxed({}, { use: "historic" })]), "no towers from the renderer").toEqual([]);
  });

  it("reads the map's tower ways: the Brigittines' bell tower by their church", () => {
    const dir = join(__dirname, "../../../data/osm");
    const osm = mergeOsm(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))));
    const tower = mappedTowers(osm).find((t) => t.id === "w1090997970");
    expect(tower).toBeDefined();
    expect(Math.hypot(tower!.x - 162, tower!.z + 230)).toBeLessThan(3);
  });
});
