import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import type { PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { PIXELS_PER_RADIAN, patrolModelSpan, popPixels, popSight, streetEyes } from "./patrol-sight";

/**
 * The size of the low patrols where they come into sight and go, from anywhere on a street
 * (ADR-0058 stage 7b, `drone-low-pop`), on a small world: a patrol lane along x from 0 to 60 on a
 * flat street, coming into sight and going `ceiling` metres over its ends.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
const ground = (surface: string, x0: number, z0: number, x1: number, z1: number): { view: ViewDescriptor; at: Vec3 } =>
  ({ view: { kind: "ground", surface, outline: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] }, at: O }) as { view: ViewDescriptor; at: Vec3 };
const lane = (ceiling: number): PatrolLane => ({ points: Array.from({ length: 16 }, (_, i) => ({ x: i * 4, z: 0 })), grounds: Array.from({ length: 16 }, () => 0), length: 60, seed: 5, quiet: false, square: 0, ceilings: [ceiling, ceiling], roofs: [18, 18] });

describe("drone-low-pop (ADR-0058 stage 7b)", () => {
  const span = patrolModelSpan();

  it("reads the patrol's size off its model: a couple of metres across", () => {
    expect(span).toBeGreaterThan(1.5);
    expect(span).toBeLessThan(3);
    // The frame's corner draws a small thing near twice as large as its middle (80 degrees, 16:9).
    expect(PIXELS_PER_RADIAN).toBeGreaterThan(2100);
    expect(PIXELS_PER_RADIAN).toBeLessThan(2300);
    expect(popPixels(span, 20)).toBeGreaterThan(100);
  });

  it("finds a patrol popping low over any street surface, whatever the street, and none where it pops out of draw", () => {
    const run = (items: { view: ViewDescriptor; at: Vec3 }[], ceiling: number) => popSight([lane(ceiling)], streetEyes(items, () => 0), span);
    // A residential road under it: the type of the street does not matter.
    expect(run([ground("road", -10, -6, 70, 6)], 30)).toHaveLength(1);
    // A pavement 150 m off, the patrol 30 m up: still several pixels.
    expect(run([ground("sidewalk", -200, -6, -150, 6)], 30)).toHaveLength(1);
    // Grass is no street.
    expect(run([ground("grass", -10, -6, 70, 6)], 30)).toHaveLength(0);
    // High enough over everyone it is drawn at no size.
    expect(run([ground("road", -10, -6, 70, 6)], 400)).toHaveLength(0);
  });
});
