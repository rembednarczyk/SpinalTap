import { describe, expect, it } from "vitest";
import { pointInRingEvenOdd } from "../../../packages/core/src";
import { type LanduseWorld, landuseBare } from "./landuse-bare";

/** The glitch scan's check `landuse-bare` (decision 5.11) on a small world: a 10 m shops' area, a shop and a stop. */

const square = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const EMPTY: LanduseWorld = { landuse: [], shops: [], stops: [], buildings: [], mapped: [], ground: [], green: [], chunks: [{ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }] };

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

  it("leaves out the samples on a slanting wall the table's rounding moves off them, in the map's outline (G-875)", () => {
    // A 2:1 wall on the samples' line z = 2x + 0.25 (10 of them), the table's 3 mm right of the map's.
    const shift = (r: readonly { x: number; z: number }[], dx: number) => r.map((p) => ({ x: p.x + dx, z: p.z }));
    const wall = [{ x: 0, z: 0.25 }, { x: 5, z: 0.25 }, { x: 5, z: 10.25 }];
    const [drawn, ring] = [shift(wall, 0.003), shift(wall, -0.003)];
    const at = (f: { what: string }) => f.what.slice("bare ".length).split(",").map(Number) as [number, number];
    const onLine = (f: { what: string }) => Math.abs(at(f)[1] - 2 * at(f)[0] - 0.25) < 1e-9;
    const world = { ...EMPTY, landuse: [square(0, 0, 10, 10)], buildings: [drawn] };
    expect(landuseBare(world).filter(onLine)).toHaveLength(10);
    expect(landuseBare({ ...world, mapped: [{ drawn, ring }] }).filter(onLine)).toEqual([]);
    // Nor the rounding alone: a sample by the wall outside the map's outline stays bare.
    expect(landuseBare({ ...world, mapped: [{ drawn, ring: drawn }] }).filter(onLine)).toHaveLength(10);
    // Nor the map's outline alone: its samples off the table's wall by more than the rounding stay bare.
    const wide = shift(wall, -0.6);
    const behind = (f: { what: string }) => at(f)[1] - 2 * at(f)[0] - 0.25 > 0.5 && pointInRingEvenOdd(at(f)[0], at(f)[1], wide);
    expect(landuseBare(world).filter(behind).length).toBeGreaterThan(0);
    expect(landuseBare({ ...world, mapped: [{ drawn, ring: wide }] }).filter(behind)).toEqual(landuseBare(world).filter(behind));
  });
});
