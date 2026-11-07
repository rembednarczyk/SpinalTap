import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import type { PatrolLane, PatrolPose } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { drawnPavingOf } from "../../../packages/engine/src/renderer/drones/patrol-paving";
import { cityPatrolWorld } from "../../../packages/engine/src/renderer/drones/patrol-world";
import { SURFACE_LIFT } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { POOL_SINK, drawnPaving, poolSink, poolSunk } from "./pool-paving";

/**
 * The searchlight pool against the drawn paving (G-293, `drone-low-pool-sunk`): on a small world, a
 * square laid over a hollow, and at the place of the report on Krakowskie Przedmieście.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
/** A hollow 0.3 m deep round (20, 0): 5 m drapes run centimetres over the ground in it. */
const hollow = (x: number, z: number) => -0.3 * Math.exp(-((x - 20) ** 2 + z ** 2) / 30);
const SQUARE = [{ view: { kind: "ground", surface: "square", outline: [{ x: -6, z: -9 }, { x: 46, z: -9 }, { x: 46, z: 9 }, { x: -6, z: 9 }] }, at: O }] as { view: ViewDescriptor; at: Vec3 }[];
const pose = (x: number, over: number): PatrolPose => ({ x, y: hollow(x, 0) + SURFACE_LIFT.square + over, z: 0, yaw: 0, ground: hollow(x, 0) + SURFACE_LIFT.square, scale: 1 });
const lane: PatrolLane = { points: Array.from({ length: 11 }, (_, i) => ({ x: i * 4, z: 0 })), grounds: Array.from({ length: 11 }, () => 0), length: 40, seed: 5, quiet: false, square: 0, ceilings: [4.7, 4.7], roofs: [18, 18] };

describe("drone-low-pool-sunk (G-293)", () => {
  const drawn = drawnPaving(SQUARE, hollow);
  // The ground at the point and the lift: what the views laid the pool on before G-293.
  const bare = (x: number, z: number) => hollow(x, z) + SURFACE_LIFT.square;

  it("finds a pool laid on the ground and the lift sunk in a hollow, and none on the drawn paving", () => {
    const sunk = poolSink(pose(20, 4.7), bare, drawn)!;
    expect(sunk.sink).toBeGreaterThan(POOL_SINK);
    expect(Math.hypot(sunk.x - 20, sunk.z)).toBeLessThan(1.5);
    expect(poolSink(pose(20, 4.7), drawnPavingOf(SQUARE, hollow, bare), drawn, true)!.sink).toBeLessThanOrEqual(0.001);
    // On flat paving both lie the same.
    const flat = drawnPaving(SQUARE, () => 0);
    expect(poolSink({ ...pose(20, 4.7), y: 4.78, ground: 0.08 }, () => 0.08, flat, true)!.sink).toBeLessThanOrEqual(0.001);
  });

  it("counts a lane once, and none with the light off", () => {
    expect(poolSunk([lane], bare, drawn)).toHaveLength(1);
    expect(poolSunk([lane], drawnPavingOf(SQUARE, hollow, bare), drawn)).toEqual([]);
    expect(poolSink(pose(20, 12), bare, drawn)).toBeNull();
  });

  it("lays the pool of the report on Krakowskie (127, -55) over the paving at every height it hangs at", () => {
    // `r4-plama-b-*.json`: the patrol over the deptak, 4.7 to 7.7 m over the paving.
    const paving = drawnPaving(WORLD_SCENERY, groundY);
    const lay = cityPatrolWorld().surfaceAt;
    for (const over of [4.7, 5.0, 6.0, 7.0, 7.7]) {
      const at: PatrolPose = { x: 127.08950226286369, y: 0.7962705954838614 + over, z: -54.977266317801075, yaw: -1.6, ground: 0.7962705954838614, scale: 1 };
      expect(poolSink(at, lay, paving, true)!.sink, `${over} m`).toBeLessThanOrEqual(0.001);
    }
  });
});
