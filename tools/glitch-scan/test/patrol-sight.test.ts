import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { PATROL_CEILING, type PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { PATROL_UNSEEN, SIGHT_EYE } from "../../../packages/engine/src/renderer/drones/patrol-sight";
import { popSight, sightLines } from "./patrol-sight";

/**
 * The view of the low patrols from the pedestrian streets (ADR-0058 stage 7b, `drone-low-pop`) on a
 * small world: a patrol lane along x from 0 to 60, coming into sight and going 18 m over its ends.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
const house = (x0: number, z0: number, x1: number, z1: number, height: number): { view: ViewDescriptor; at: Vec3 } => ({
  view: { kind: "building", outline: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], height, levels: 4, use: "residential", look: 1 },
  at: O,
});
const lane: PatrolLane = { points: Array.from({ length: 16 }, (_, i) => ({ x: i * 4, z: 0 })), grounds: Array.from({ length: 16 }, () => 0), length: 60, seed: 5, quiet: false, square: 0, ceilings: [PATROL_CEILING, PATROL_CEILING] };
const eye = (x: number, z: number) => ({ x, z, eye: SIGHT_EYE });

describe("drone-low-pop (ADR-0058 stage 7b)", () => {
  const run = (observers: ReturnType<typeof eye>[], items: { view: ViewDescriptor; at: Vec3 }[] = []) => popSight([lane], observers, sightLines(items, () => 0)).length;

  it("finds a patrol coming into sight in view of someone on the street, and none behind a wall, high over them or too far", () => {
    // 60 m off along the street: 15 degrees up, in plain view.
    expect(run([eye(-60, 0)])).toBe(1);
    // A 30 m house between them.
    expect(run([eye(-60, 0)], [house(-40, -20, -20, 20, 30)])).toBe(0);
    // Right under one end (beyond 40 degrees up), a tower hiding the other.
    expect(run([eye(-3, 2)], [house(10, -20, 50, 20, 60)])).toBe(0);
    expect(run([eye(-3, 2)])).toBe(1);
    // Further than it takes 2 px.
    expect(run([eye(-PATROL_UNSEEN - 10, 0)])).toBe(0);
    // Behind a hill.
    expect(popSight([lane], [eye(-60, 0)], sightLines([], (x) => (x < -30 && x > -50 ? 25 : 0)))).toHaveLength(0);
  });
});
