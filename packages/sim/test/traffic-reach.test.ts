import { describe, expect, it, vi } from "vitest";
import { ROAD_CHAINS, polylineLength } from "../src/content/lublin/roads";
import type * as Roads from "../src/content/lublin/roads";
import { reachAt, roadHalfWidth, turnedRound } from "../src/content/traffic-reach";

/**
 * The lanes read the carriageway's width off the import (`RoadChain.half`, ADR-0080 PR 3), not
 * off the asphalt drawn: the round joins of ADR-0078 moved the asphalt's edge by centimetres and
 * the lanes with it, by up to 12 cm, and cars met on `traffic-junction-drive` (G-744).
 */
describe("the carriageway's reach beside a street's axis (ADR-0080)", () => {
  it("every car street's point has its reach, both sides", () => {
    const cars = ROAD_CHAINS.filter((c) => c.use === "cars");
    expect(cars.every((c) => c.half.length === c.points.length)).toBe(true);
    // A street long enough to sample (every 10 m from 5 m on) has a reach each side.
    expect(cars.filter((c) => polylineLength(c.points) > 5 && (roadHalfWidth(c, 1) === 0 || roadHalfWidth(c, -1) === 0)).map((c) => c.name)).toEqual([]);
  });

  it("reads the nearer point's reach, its left and right, and a street turned round swaps its sides", () => {
    // A bay by the second point reaches no further than halfway back to the first (the import reads each point over that stretch).
    const st = { points: [[0, 0], [0, 10], [0, 80]] as const, half: [[2, 3], [4, 5], [2, 3]] as const };
    expect([2, 4.9, 5.1, 40, 46].map((s) => reachAt(st, s, -1))).toEqual([2, 2, 4, 4, 2]);
    expect([2, 4.9, 5.1, 40, 46].map((s) => reachAt(st, s, 1))).toEqual([3, 3, 5, 5, 3]);
    const back = turnedRound(st);
    expect(reachAt(back, 77.5, 1)).toBe(reachAt(st, 2.5, -1));
    expect(reachAt(back, 77.5, -1)).toBe(reachAt(st, 2.5, 1));
  });

  it("a point off its asphalt has none, and the street's width is the median of its samples", () => {
    const st = { points: [[0, 0], [0, 10], [0, 40]] as const, half: [[3, 3], [0, 0], [3, 3]] as const };
    expect(reachAt(st, 8, 1)).toBe(0);
    expect(roadHalfWidth({ points: [[0, 0], [0, 40]], half: [[3, 3.5], [3, 3.5]] }, 1)).toBe(3.5);
  });

  it("moving the asphalt's edge by 5 cm moves no lane", async () => {
    const { TRAFFIC_LANES } = await import("../src/content/traffic");
    const before = TRAFFIC_LANES.map((r) => [r.id, r.points]);
    vi.resetModules();
    vi.doMock("../src/content/lublin/roads", async (original) => {
      const roads = await original<typeof Roads>();
      // Every surface drawn 5 cm east and 5 cm south of where it is.
      return { ...roads, onRoad: (x: number, z: number) => roads.onRoad(x - 0.05, z + 0.05), surfacesAt: (x: number, z: number) => roads.surfacesAt(x - 0.05, z + 0.05) };
    });
    const moved = await import("../src/content/traffic");
    vi.doUnmock("../src/content/lublin/roads");
    vi.resetModules();
    expect(moved.TRAFFIC_LANES.map((r) => [r.id, r.points])).toEqual(before);
  }, 60_000);
});
