import { describe, expect, it } from "vitest";
import { measuredTreeVariant, treeScale as coreTreeScale } from "@seki/core";
import { furnitureRadius, treeScale } from "../src/content/lublin/furniture";

describe("tree trunks (G-422)", () => {
  it("size a tree as the core's layout does, measured or not", () => {
    for (const seed of [0, 1, 2, 0x70, 0xf0, 4097, 62412, 0xffff]) {
      expect(treeScale(seed)).toBe(coreTreeScale(seed));
      for (const h of [0.4, 6, 12.7, 20, 40]) expect(treeScale(measuredTreeVariant(seed, h))).toBe(coreTreeScale(measuredTreeVariant(seed, h)));
    }
  });

  it("give a tall measured tree a thicker trunk", () => {
    const at = (variant: number) => furnitureRadius({ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant });
    expect(at(measuredTreeVariant(0, 20))).toBeGreaterThan(at(0xf0));
  });
});
