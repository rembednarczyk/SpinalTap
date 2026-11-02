import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type MapBuilding, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { cleanRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { type Tags, mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { type BuildingSource } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { type TowerEntry, fakeTowers, hasParts, mappedTowers, towerMapped } from "./landmark-towers";

/**
 * The glitch scan's check `landmark-fake-tower` (G-210): a church of its own far from the map's
 * districts, on the list, without parts and without a tower in the map, gets the renderer's bell
 * towers and is found; each condition turned the other way, it is not.
 */

const ring = cleanRing([
  { x: 5000, z: 5000 },
  { x: 5040, z: 5000 },
  { x: 5040, z: 5030 },
  { x: 5000, z: 5030 },
]);
const church: MapBuilding = { id: 1, ring, base: 0, foot: 0, height: 15, levels: 4, use: "church", look: 3, roof: 6, name: "Kościół" };
const entry = (b: Partial<MapBuilding> = {}, e: Partial<TowerEntry> = {}): TowerEntry => ({ id: "w1", x: 5020, z: 5015, frame: facadeFrame({ ...church, ...b }, () => null), parts: false, mapped: false, ...e });

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
    expect(towerMapped({ building: "church" }, ring, [{ id: "w9", x: 5020, z: 5015 }])).toBe(true);
    expect(towerMapped({}, ring, [{ id: "w9", x: 5048, z: 5015 }])).toBe(true);
    expect(towerMapped({}, ring, [{ id: "w9", x: 5055, z: 5015 }])).toBe(false);
  });

  it("reads the map's tower ways: the Brigittines' bell tower by their church", () => {
    const dir = join(__dirname, "../../../data/osm");
    const osm = mergeOsm(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))));
    const tower = mappedTowers(osm).find((t) => t.id === "w1090997970");
    expect(tower).toBeDefined();
    expect(Math.hypot(tower!.x - 162, tower!.z + 230)).toBeLessThan(3);
  });
});
