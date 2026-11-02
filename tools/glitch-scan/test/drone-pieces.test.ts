import { describe, expect, it } from "vitest";
import type { BuildingUse, GroundSurface, Vec3, ViewDescriptor } from "../../../packages/core/src";
import { type DroneLane, STEP, planDroneLanes } from "../../../packages/engine/src/renderer/drones/drone-lanes";
import { droneWorldOf } from "../../../packages/engine/src/renderer/drones/drone-world";
import { droneChecks } from "./drone-pieces";

/**
 * The glitch scan's checks of the drones (ADR-0058 stage 7) on a small world of their own: a
 * street along x (z -6..6) between two rows of 12 m houses, a lawn east of x 300, a church north of
 * x 400; each check finds a lane flown where it must not, and nothing on the planner's own lanes.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
const rect = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const house = (x0: number, z0: number, x1: number, z1: number, height = 12, use: BuildingUse = "residential"): { view: ViewDescriptor; at: Vec3 } => ({
  view: { kind: "building", outline: rect(x0, z0, x1, z1), height, levels: 4, use, look: 1 },
  at: O,
});
const ground = (surface: GroundSurface, x0: number, z0: number, x1: number, z1: number): { view: ViewDescriptor; at: Vec3 } => ({ view: { kind: "ground", surface, outline: rect(x0, z0, x1, z1) }, at: O });

const ITEMS = [
  ...Array.from({ length: 15 }, (_, i) => house(i * 20, 8, i * 20 + 18, 20)),
  ...Array.from({ length: 15 }, (_, i) => house(i * 20, -20, i * 20 + 18, -8)),
  ground("road", -10, -6, 300, 6),
  ground("grass", 300, -6, 380, 6),
  ground("road", 380, -6, 600, 6),
  house(400, 10, 430, 40, 30, "church"),
];
const AXES = [[{ x: 0, z: 0 }, { x: 600, z: 0 }]];

/** A lane along z = 0 from x0 to x1, its level `level`. */
const lane = (x0: number, x1: number, level: number): DroneLane => {
  const n = Math.round((x1 - x0) / STEP);
  return { points: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + i * STEP, z: 0 })), levels: Array.from({ length: n + 1 }, () => level), length: n * STEP, seed: 1 };
};

const run = (lanes?: readonly DroneLane[]) => {
  const checks = droneChecks(ITEMS, AXES, () => 0, lanes ? () => lanes : undefined);
  return Object.fromEntries(Object.entries(checks).map(([k, f]) => [k, f().length]));
};

describe("drone checks (ADR-0058 stage 7)", () => {
  it("find nothing on the planner's own lanes, which keep to the street between the houses", () => {
    const lanes = planDroneLanes(droneWorldOf(ITEMS, AXES, () => 0));
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.points.every((p) => p.x < 300)).toBe(true);
    expect(run()).toEqual({ "drone-in-building": 0, "drone-by-landmark": 0, "drone-off-street": 0, "drone-over-building": 0 });
  });

  it("find a drone in a house, over the lawn, by the church and over a house", () => {
    /** A lane across the street at x 100, from z -30 to 30, through the houses on both sides. */
    const across = (level: number): DroneLane => ({ ...lane(0, 60, level), points: lane(0, 60, level).points.map((p) => ({ x: 100, z: p.x - 30 })) });
    expect(run([across(5)])).toEqual({ "drone-in-building": 1, "drone-by-landmark": 0, "drone-off-street": 1, "drone-over-building": 1 });
    // Over the 12 m roofs it is clear of them, but still over the houses and off the street.
    expect(run([across(13)])).toEqual({ "drone-in-building": 0, "drone-by-landmark": 0, "drone-off-street": 1, "drone-over-building": 1 });
    // Low in the canyon between the walls: in no house.
    expect(run([lane(40, 200, 2)])).toEqual({ "drone-in-building": 0, "drone-by-landmark": 0, "drone-off-street": 0, "drone-over-building": 0 });
    expect(run([lane(250, 340, 40)])).toMatchObject({ "drone-off-street": 1, "drone-in-building": 0 });
    expect(run([lane(450, 560, 60)])).toMatchObject({ "drone-by-landmark": 1, "drone-off-street": 0 });
  });
});
