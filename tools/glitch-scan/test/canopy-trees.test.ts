import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, emptyCover } from "../../orto/src/cover.ts";
import type { Thresholds } from "../../orto/src/thresholds.ts";
import { canopyWithoutTree } from "./canopy-trees";

/** The glitch scan's check `canopy-without-tree` (G-797) on a small cover. */

/** A 20 × 10 m cover (two squares) with crown over `rect` (world metres). */
const cover = (crown: { minX: number; maxX: number; minZ: number; maxZ: number }, x0 = 0): Cover => {
  const c = emptyCover("test", { minX: x0, maxX: x0 + 20, minZ: 0, maxZ: 10 }, {} as Thresholds);
  const h = c.header;
  for (let row = 0; row < h.height; row++)
    for (let col = 0; col < h.width; col++) {
      const [x, z] = [h.x0 + (col + 0.5) * h.step, h.z1 - (row + 0.5) * h.step];
      if (x >= crown.minX && x < crown.maxX && z >= crown.minZ && z < crown.maxZ) c.cls[row * h.width + col] = col % 2 ? COVER.canopy : COVER.canopyHard;
    }
  return c;
};
const tree = (x: number, z: number, prop: StreetPropItem["prop"] = "tree"): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant: 0 });

describe("crowns with no tree (canopy-without-tree)", () => {
  it("finds a square of crown with no tree near, keyed by its corner", () => {
    const found = canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 })], []);
    expect(found).toEqual([{ at: "0,0", what: expect.stringContaining("crown 100.0 m², 100%") }]);
  });

  it("leaves a square with under 40 m² of crown, and one a tree covers over a fifth of", () => {
    expect(canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 3.5 })], [])).toEqual([]);
    expect(canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 })], [tree(5, 5)])).toEqual([]);
    // A tree's 6 m reaches into the square from its neighbour, but over too little of it.
    expect(canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 })], [tree(15.5, 5)])).toHaveLength(1);
  });

  it("leaves out the rectangles the game clears for its set pieces (G-815)", () => {
    expect(canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 })], [], [{ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }])).toEqual([]);
  });

  it("counts only trees, and a sample two covers hold once", () => {
    expect(canopyWithoutTree([cover({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 })], [tree(5, 5, "bench")])).toHaveLength(1);
    const twice = canopyWithoutTree([cover({ minX: 10, maxX: 20, minZ: 0, maxZ: 10 }), cover({ minX: 10, maxX: 30, minZ: 0, maxZ: 10 }, 10)], []);
    expect(twice.map((f) => f.at)).toEqual(["10,0", "20,0"]);
    expect(twice[0]!.what).toContain("crown 100.0 m²");
  });
});
