import { describe, expect, it } from "vitest";
import { AXIS_REACH, type WalkWay, blockedStretches, nearStretches, walkedWay } from "./walk-axes";

/** The stretches of the map's ways blocked along them (`walk-axes.ts`, ADR-0080 point 5, the curator's C and D). */

const way = (tags: Record<string, string>, line: { x: number; z: number }[]): WalkWay => ({ tags, line });
const along = (len: number) => [
  { x: 0, z: 0 },
  { x: len, z: 0 },
];
const extent = (s: { a: { x: number }; b: { x: number } }[]) => [Math.min(...s.map((t) => Math.min(t.a.x, t.b.x))), Math.max(...s.map((t) => Math.max(t.a.x, t.b.x)))];

describe("the ways' axes walk-blocked counts along", () => {
  it("blocks an axis steeper than tg 35° over 2 m, not one that steep over less, nor a bank across it", () => {
    const footway = [way({ highway: "footway" }, along(20))];
    // 0.8 a metre from x 8 to 12: four metres too steep.
    const ramp = (x: number) => 0.8 * Math.min(4, Math.max(0, x - 8));
    const s = blockedStretches(footway, ramp);
    expect(extent(s)[0]).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(extent(s)[1]).toBeLessThanOrEqual(14 + 1e-9);
    // 1 m of 1.0 a metre: 0.5 over 2 m.
    expect(blockedStretches(footway, (x) => Math.min(1, Math.max(0, x - 8)))).toEqual([]);
    // A bank of 2.0 across the way (along z): the axis is level along x.
    expect(blockedStretches(footway, (_x, z) => 2 * z)).toEqual([]);
  });

  it("blocks a ledge on the axis, but not a sample off the map (A)", () => {
    const footway = [way({ highway: "footway" }, along(20))];
    const s = blockedStretches(footway, (x) => (x < 10 ? 0 : 0.5));
    expect(s).toHaveLength(1);
    expect(s[0]!.reach).toBe(AXIS_REACH);
    // Off the map past x 10: no ground, no stretch.
    expect(blockedStretches(footway, (x) => (x < 10 ? 0 : Number.NaN))).toEqual([]);
  });

  it("leaves out the ways closed to walkers, the steps and the ways under the ground (D)", () => {
    expect(walkedWay({ highway: "footway" })).toBe(true);
    expect(walkedWay({ highway: "pedestrian" })).toBe(true);
    expect(walkedWay({ highway: "footway", access: "no" })).toBe(false);
    expect(walkedWay({ highway: "steps" })).toBe(false);
    expect(walkedWay({ highway: "path", tunnel: "yes", layer: "-1" })).toBe(false);
    expect(walkedWay({ highway: "pedestrian", area: "yes" })).toBe(false);
    expect(walkedWay({ building: "yes" })).toBe(false);
    const ledge = (x: number) => (x < 10 ? 0 : 0.5);
    expect(blockedStretches([way({ highway: "footway", access: "no" }, along(20)), way({ highway: "steps" }, along(20))], ledge)).toEqual([]);
  });

  it("holds a pair within reach of a blocked stretch: a path's 0.6 m, a street's half carriageway", () => {
    const ledge = (x: number) => (x < 10 ? 0 : 0.5);
    const path = nearStretches(blockedStretches([way({ highway: "footway" }, along(20))], ledge));
    expect(path(10, 0.5)).toBe(true);
    expect(path(10, 0.7)).toBe(false);
    expect(path(15, 0)).toBe(false);
    const street = nearStretches(blockedStretches([way({ highway: "pedestrian" }, along(20))], ledge, () => 3));
    expect(street(10, 2.9)).toBe(true);
    expect(street(10, 3.1)).toBe(false);
  });
});
