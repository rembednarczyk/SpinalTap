import { describe, expect, it } from "vitest";
import { type OutlineEntry, cityOutlinesOffSurface, outlinesOffSurface } from "./landmark-outlines";

/**
 * The glitch scan's check `landmark-outline-nmpt` (G-874): a landmark's wall whose roof edge in
 * NMPT lies over 2 m inside the outline along 10 m or more is found, once a run; a shallower or
 * shorter run, an edge outside the outline, or a building off the table is not.
 */

/** A wall along z = 5010 from x 5000 to 5030, NMPT's edge at z 5010 - `deep` from x `from` to `to`. */
const table = (deep: number, from: number, to: number) => ({
  w1: Array.from({ length: 11 }, (_, k): readonly [number, number] => [5000 + 3 * k, from <= 5000 + 3 * k && 5000 + 3 * k <= to ? 5010 - deep : 5010.3]),
});
const entry: OutlineEntry = {
  id: "w1",
  ring: [
    { x: 4995, z: 4990 },
    { x: 5035, z: 4990 },
    { x: 5035, z: 5010 },
    { x: 4995, z: 5010 },
  ],
};

describe("landmark-outline-nmpt (G-874)", () => {
  it("finds a wall standing over 2 m off NMPT's roof edge along 10 m, once at the run's middle", () => {
    expect(outlinesOffSurface(table(2.8, 5006, 5024), [entry])).toEqual([{ at: "5015,5007", what: "w1: NMPT's roof edge up to 2.8 m inside the outline along 18 m (5006,5007.2 to 5024,5007.2)" }]);
  });

  it("passes a shallow or short run, an edge outside the outline and a building off the table", () => {
    expect(outlinesOffSurface(table(1.8, 5000, 5030), [entry])).toEqual([]);
    expect(outlinesOffSurface(table(2.8, 5006, 5012), [entry])).toEqual([]);
    expect(outlinesOffSurface(table(-2.8, 5000, 5030), [entry])).toEqual([]);
    expect(outlinesOffSurface(table(2.8, 5000, 5030), [{ ...entry, id: "w2" }])).toEqual([]);
  });

  it("finds no landmark of the city's data off its roof edge", () => {
    expect(cityOutlinesOffSurface()).toEqual([]);
  });
});
