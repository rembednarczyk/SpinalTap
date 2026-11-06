import { describe, expect, it } from "vitest";
import { type LanduseWorld, landuseBare } from "./landuse-bare";

/** The glitch scan's check `landuse-bare` (decision 5.11) on a small world: a 10 m shops' area, a shop and a stop. */

const square = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const EMPTY: LanduseWorld = { landuse: [], shops: [], stops: [], buildings: [], ground: [], green: [], chunks: [{ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }] };

describe("bare terrain where a town has paving (landuse-bare)", () => {
  it("finds every 0.5 m sample of a shops' area with no ground piece on it", () => {
    const found = landuseBare({ ...EMPTY, landuse: [square(0, 0, 10, 10)] });
    expect(found).toHaveLength(400);
    expect(found[0]).toEqual({ at: "0,0", what: "bare 0.25,0.25" });
  });

  it("leaves out the samples under a ground piece, in a building and in a lawn or bed", () => {
    const area = [square(0, 0, 10, 10)];
    expect(landuseBare({ ...EMPTY, landuse: area, ground: [square(0, 0, 10, 10)] })).toEqual([]);
    expect(landuseBare({ ...EMPTY, landuse: area, ground: [square(0, 0, 10, 5)] })).toHaveLength(200);
    expect(landuseBare({ ...EMPTY, landuse: area, buildings: [square(0, 0, 5, 10)] })).toHaveLength(200);
    expect(landuseBare({ ...EMPTY, landuse: area, green: [square(5, 0, 10, 10)] })).toHaveLength(200);
  });

  it("reaches 5 m off a shop's walls and 10 m round a stop, and no further", () => {
    const shop = square(0, 0, 4, 4);
    // The forecourt: a 14 m square with its corners rounded at 5 m, the shop itself a building.
    const forecourt = landuseBare({ ...EMPTY, shops: [shop], buildings: [shop] });
    expect(forecourt.length * 0.25).toBeCloseTo(14 * 14 - 16 - (100 - 25 * Math.PI), -1);
    expect(forecourt.every((f) => !f.what.includes("-5.25"))).toBe(true);
    const stop = landuseBare({ ...EMPTY, stops: [{ x: 0, z: 0 }] });
    expect(stop.length * 0.25).toBeCloseTo(100 * Math.PI, -1);
  });

  it("finds nothing off the map's chunks, nor in a world without such areas", () => {
    expect(landuseBare({ ...EMPTY, landuse: [square(0, 0, 10, 10)], chunks: [{ minX: 20, maxX: 40, minZ: 0, maxZ: 10 }] })).toEqual([]);
    expect(landuseBare({ ...EMPTY, ground: [square(0, 0, 10, 10)] })).toEqual([]);
  });
});
