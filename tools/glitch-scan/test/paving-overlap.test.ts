import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { OVERLAP_STEP, drawnPieces, pavingOverlapSteps, pieceHeightAt } from "./paving-overlap";

/**
 * Overlapping pieces of drawn paving (G-301, `paving-overlap-step`): on a small world over a hollow,
 * and at the place of the report, two squares by Plac Litewski (435.3, -94.6).
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
/** A hollow 0.3 m deep round (20, 0) and a slope across it: the ground bends under every drape. */
const hollow = (x: number, z: number) => -0.3 * Math.exp(-((x - 20) ** 2 + z ** 2) / 30) + 0.01 * x * z / 10;
const ground = (surface: string, outline: { x: number; z: number }[]) => ({ view: { kind: "ground", surface, outline }, at: O }) as { view: ViewDescriptor; at: Vec3 };
const WORLD = [
  ground("square", [{ x: -6, z: -9 }, { x: 46, z: -9 }, { x: 46, z: 9 }, { x: -6, z: 9 }]),
  ground("square", [{ x: 7.3, z: -12.1 }, { x: 31.7, z: -3.3 }, { x: 25.2, z: 14.4 }, { x: 3.1, z: 6.9 }]),
  ground("cobble", [{ x: 13.4, z: -2.6 }, { x: 27.9, z: -1.1 }, { x: 19.5, z: 7.7 }]),
];

describe("paving-overlap-step (G-301)", () => {
  it("finds no step between overlapping pieces of the drawn paving over a hollow", () => {
    expect(pavingOverlapSteps(drawnPieces(WORLD, hollow))).toEqual([]);
  });

  it("finds none on flat ground, and none between pieces that do not meet", () => {
    expect(pavingOverlapSteps(drawnPieces(WORLD, () => 0.4))).toEqual([]);
    expect(pavingOverlapSteps(drawnPieces([WORLD[0]!, ground("square", [{ x: 50, z: 0 }, { x: 60, z: 0 }, { x: 60, z: 5 }])], hollow))).toEqual([]);
  });

  it("lays the two squares of the report (435.3, -94.6) at one height round it", () => {
    const { pieces } = drawnPieces(WORLD_SCENERY, groundY);
    // The ground a partition (ADR-0078 step 3): one square over the point, the other cut along its edge.
    expect(pieces.filter((p) => pointInRing({ x: 435.3, z: -94.6 }, p.ring)).map((p) => p.surface)).toEqual(["square"]);
    const at = (x: number, z: number) => pieces.find((p) => p.surface === "square" && pointInRing({ x, z }, p.ring));
    let met = 0;
    for (let x = 433; x <= 442; x += 0.1) {
      for (let z = -97; z <= -88; z += 0.1) {
        // Across the edge where the two meet (2 cm apart, the slope too little to count), a step of no more than where they lay over each other.
        for (const [dx, dz] of [[0.02, 0], [0, 0.02]] as const) {
          const [a, b] = [at(x, z), at(x + dx, z + dz)];
          if (!a || !b || a === b) continue;
          const [ya, yb] = [pieceHeightAt(a, x, z), pieceHeightAt(b, x + dx, z + dz)];
          if (ya === null || yb === null) continue;
          met++;
          expect(Math.abs(ya - yb), `${x}, ${z}`).toBeLessThanOrEqual(OVERLAP_STEP);
        }
      }
    }
    expect(met).toBeGreaterThan(0);
  });
});
