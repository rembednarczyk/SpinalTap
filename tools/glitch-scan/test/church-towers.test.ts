import { describe, expect, it } from "vitest";
import { type MapBuilding, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { cleanRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { type NmptTower, TOWERED_CHURCHES, churchFakeTowers, dataTops, towerApexes, towersOffNmpt } from "./church-towers";
import type { TowerEntry } from "./landmark-towers";

/**
 * The glitch scan's checks `church-fake-tower` and `church-tower-off-nmpt` (G-215): a church of
 * its own far from the map's districts, with the renderer's towers where it has none in Lublin,
 * or off its real one in plan or height, is found; at its real one, or with its tower a building
 * of the data, it is not.
 */

const ring = cleanRing([
  { x: 5000, z: 5000 },
  { x: 5040, z: 5000 },
  { x: 5040, z: 5030 },
  { x: 5000, z: 5030 },
]);
const tower = { x: 5005, z: 5015, half: 3, top: 25, tip: 35 };
const church: MapBuilding = { id: 1, ring, base: 0, foot: 0, height: 15, levels: 4, use: "church", look: 3, roof: 6, name: "Kościół", towers: [tower] };
const entry = (b: Partial<MapBuilding> = {}, e: Partial<TowerEntry> = {}): TowerEntry => ({ id: "w1", x: 5020, z: 5015, ring, frame: facadeFrame({ ...church, ...b }, () => null), parts: false, mapped: false, ...e });
const real: NmptTower = { id: "w1", x0: 5002, x1: 5008, z0: 5012, z1: 5018, tip: 35 };

describe("church-fake-tower (G-215)", () => {
  it("finds a church with no real tower that gets the renderer's, and none on the list, with parts or without towers", () => {
    expect(churchFakeTowers([entry()])).toEqual([{ at: "5020,5015", what: expect.stringMatching(/^w1 Kościół: \d+ vertices of towers it has not$/) }]);
    expect(churchFakeTowers([entry({}, { id: `${TOWERED_CHURCHES[0]!}/2` })]), "a piece of a church with a tower").toEqual([]);
    expect(churchFakeTowers([entry({}, { parts: true })]), "parts from the map").toEqual([]);
    expect(churchFakeTowers([entry({ towers: [] })]), "no towers").toEqual([]);
    expect(churchFakeTowers([entry({ use: "historic" })]), "not a church").toEqual([]);
  });
});

describe("church-tower-off-nmpt (G-215)", () => {
  it("reads one apex per tower with its height, not the walls' corners", () => {
    const two = towerApexes(entry({ towers: [tower, { ...tower, x: 5030, tip: 30 }] }).frame);
    expect(two.map((a) => [Math.round(a.x), Math.round(a.z), Math.round(a.y)]).sort()).toEqual([
      [5005, 5015, 35],
      [5030, 5015, 30],
    ]);
  });

  it("passes a tower at its real one and finds one off it in plan or height, and a real one with nothing there", () => {
    expect(towersOffNmpt([entry()], [], [real])).toEqual([]);
    expect(towersOffNmpt([entry({ towers: [{ ...tower, tip: 38 }] })], [], [real]).map((f) => f.what)).toEqual(["w1: a tower of the renderer's to y 38.0 off the real one", "w1: no tower to y 35 where NMPT has one"]);
    expect(towersOffNmpt([entry({ towers: [{ ...tower, x: 5012 }] })], [], [real])).toHaveLength(2);
    expect(towersOffNmpt([entry({ towers: [] })], [], [real]).map((f) => f.what)).toEqual(["w1: no tower to y 35 where NMPT has one"]);
    // A church not listed is no business of this check: `church-fake-tower` is.
    expect(towersOffNmpt([entry({}, { id: "w2" })], [], [real])).toHaveLength(1);
  });

  it("takes a building of the data standing there to the height as the real tower", () => {
    const top = dataTops([{ id: "w9", x: 5005, y: 0, z: 5015, height: 30, roof: 5, outline: [-2, -2, 2, -2, 2, 2, -2, 2] }]);
    expect(top).toEqual([{ id: "w9", x: 5005, z: 5015, y: 35 }]);
    expect(towersOffNmpt([entry({ towers: [] })], top, [real])).toEqual([]);
    expect(towersOffNmpt([entry({ towers: [] })], [{ ...top[0]!, y: 30 }], [real])).toHaveLength(1);
  });
});
