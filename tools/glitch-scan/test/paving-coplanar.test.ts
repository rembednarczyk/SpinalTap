import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { mapGround } from "./deck-paint";
import { pavingCoplanar } from "./paving-coplanar";

/**
 * Pieces of the drawn paving overlapping in one plane (G-320, `paving-coplanar`): on a small world
 * on flat ground, and at the place of the report, Plac Łokietka by the Ratusz (532, -58), where a
 * square and the cobbled ways across it flickered in the player's recording.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
const ground = (surface: string, outline: { x: number; z: number }[]) => ({ view: { kind: "ground", surface, outline }, at: O }) as { view: ViewDescriptor; at: Vec3 };
const rect = (x0: number, z0: number, x1: number, z1: number) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

describe("paving-coplanar (G-320)", () => {
  it("finds no two pieces of one lift drawn over each other: squares, a cobbled way, footways, roads", () => {
    const world = [
      ground("square", rect(-6, -9, 46, 9)),
      ground("square", [{ x: 7.3, z: -12.1 }, { x: 31.7, z: -3.3 }, { x: 25.2, z: 14.4 }, { x: 3.1, z: 6.9 }]),
      ground("cobble", [{ x: 13.4, z: -2.6 }, { x: 27.9, z: -1.1 }, { x: 19.5, z: 7.7 }]),
      ground("footway", rect(30, -3, 60, 1)),
      ground("footway", rect(40, -12, 43, 12)),
      ground("road", rect(-20, 20, 20, 28)),
      ground("road", rect(10, 10, 16, 40)),
    ];
    expect(pavingCoplanar(mapGround(world))).toEqual([]);
  });

  it("finds two water surfaces drawn over each other, and none for pieces of other lifts", () => {
    expect(pavingCoplanar(mapGround([ground("water", rect(0, 0, 10, 10)), ground("water", rect(5, 5, 15, 15))])).map((f) => f.what)).toEqual(["water and water: 25.00 m² in one plane"]);
    expect(pavingCoplanar(mapGround([ground("square", rect(0, 0, 10, 10)), ground("footway", rect(5, 5, 15, 15)), ground("road", rect(2, 2, 8, 8))]))).toEqual([]);
  });

  it("lays one paving on Plac Łokietka by the Ratusz", () => {
    const near = WORLD_SCENERY.filter(({ view, at }) => view.kind !== "ground" || view.outline.some((p) => Math.hypot(p.x + at.x - 532, p.z + at.z + 58) < 60));
    expect(pavingCoplanar(mapGround(near))).toEqual([]);
  });
});
