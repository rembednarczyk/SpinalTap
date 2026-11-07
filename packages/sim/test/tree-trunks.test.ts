import { describe, expect, it } from "vitest";
import { TREE_KIND, TREE_SPECIES, measuredTreeVariant, treeScale as coreTreeScale, withTreeSpecies } from "@seki/core";
import { furnitureRadius, treeScale } from "../src/content/lublin/furniture";

describe("tree trunks (G-422)", () => {
  it("size a tree as the core's layout does, measured or not", () => {
    for (const seed of [0, 1, 2, 0x70, 0xf0, 4097, 62412, 0xffff]) {
      expect(treeScale(seed)).toBe(coreTreeScale(seed));
      for (const h of [0.4, 6, 12.7, 20, 40]) expect(treeScale(measuredTreeVariant(seed, h))).toBe(coreTreeScale(measuredTreeVariant(seed, h)));
    }
  });

  it("size an oak or a poplar named by OSM as the core's layout does (G-423)", () => {
    for (const seed of [0, 0x70, 0xf0, 4097])
      for (let s = 0; s < TREE_SPECIES; s++)
        for (const h of [6, 10.3, 20, 40]) {
          const v = withTreeSpecies(measuredTreeVariant(seed, h), s);
          expect(treeScale(v)).toBe(coreTreeScale(v));
        }
  });

  it("give an oak and a poplar a trunk as thick as the renderer draws, a lime's as before (G-423)", () => {
    const at = (variant: number) => furnitureRadius({ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant });
    const v = measuredTreeVariant(0, 20);
    expect(at(v)).toBeCloseTo(0.28 * coreTreeScale(v), 2);
    // The renderer's trunks are 0.42 and 0.45 m at size 1 (`TRUNK` in `prop-green.ts`).
    expect(at(withTreeSpecies(v, TREE_KIND.oak))).toBeGreaterThan(0.42 * coreTreeScale(v));
    expect(at(withTreeSpecies(v, TREE_KIND.poplar))).toBeGreaterThan(0.45 * coreTreeScale(v));
  });

  it("give a tall measured tree a thicker trunk", () => {
    const at = (variant: number) => furnitureRadius({ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant });
    expect(at(measuredTreeVariant(0, 20))).toBeGreaterThan(at(0xf0));
  });
});
