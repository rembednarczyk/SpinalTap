import { describe, expect, it } from "vitest";
import type { Pt } from "../src/geometry.ts";
import type { Site } from "../src/props-site.ts";
import { openSpace, sculptureFacing } from "../src/props-statues.ts";

/*
 * Which way the sculptures face (ADR-0094 stage 4): a Koziołek under a tenement's wall turns its
 * back to it; a free-standing monument faces the widest open space round it, never a wall.
 */

/** A street running north between two rows of buildings (x < -6 and x > 6), a square opening east of y 20. */
const street = (): Site => {
  const building = (p: Pt) => (p.x < -6 || p.x > 6) && !(p.z > 20 && p.x > 6 && p.x < 60);
  return {
    surfaceAt: (p: Pt) => (building(p) ? "building" : "walk"),
    chunkAt: (p: Pt) => (Math.abs(p.x) < 100 && Math.abs(p.z) < 100 ? ({ id: "c" } as never) : null),
    awayFromWall: (p: Pt, reach = 2) => {
      const west = p.x + 6;
      const east = 6 - p.x;
      if (Math.min(west, east) > reach) return null;
      return west < east ? { x: 1, z: 0 } : { x: -1, z: 0 };
    },
  } as unknown as Site;
};

describe("which way the sculptures face (ADR-0094 stage 4)", () => {
  it("turns a Koziołek under a wall with its back to it", () => {
    expect(sculptureFacing(street(), { x: -5, z: 0 })).toEqual({ x: 1, z: 0 });
    expect(sculptureFacing(street(), { x: 5, z: -40 })).toEqual({ x: -1, z: 0 });
  });

  it("faces a free-standing one along the street's length or into the square, not a wall", () => {
    const site = street();
    const clearAhead = (p: Pt, d: Pt, reach: number) => Array.from({ length: reach }, (_, t) => site.surfaceAt({ x: p.x + d.x * (t + 1), z: p.z + d.z * (t + 1) })).every((s) => s !== "building");
    // In the street: along its length, no wall within 20 m.
    const d = openSpace(site, { x: 0, z: 0 })!;
    expect(Math.abs(d.x)).toBeLessThan(0.5);
    expect(clearAhead({ x: 0, z: 0 }, d, 20)).toBe(true);
    // By the square: an open way of 30 m or more ahead.
    const s = sculptureFacing(site, { x: 0, z: 30 })!;
    expect(clearAhead({ x: 0, z: 30 }, s, 30)).toBe(true);
  });
});
