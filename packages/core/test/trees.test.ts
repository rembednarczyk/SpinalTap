import { describe, expect, it } from "vitest";
import { TREE_SCALE, TREE_TOP, measuredTreeVariant, plainTreeVariant, treeHeight, treeScale } from "../src";

describe("tree sizes (G-422)", () => {
  it("keeps the old spread of a tree with no measured height", () => {
    expect(treeScale(0)).toBe(0.8);
    expect(treeScale(0xf0)).toBeCloseTo(1.25);
    for (const seed of [0, 0x70, 0xeeff, 0xefff, 0xf000, 0xf2a1, 0xffff]) {
      const v = plainTreeVariant(seed);
      expect(v).toBeLessThan(0xf000);
      expect(v % 3).toBe(seed % 3);
      expect(treeScale(v)).toBeCloseTo(0.8 + 0.45 * (((seed >> 4) % 16) / 15));
    }
    expect(plainTreeVariant(0x1234)).toBe(0x1234);
  });

  it("grows a measured tree to its height, keeping its species", () => {
    for (const seed of [0, 1, 2, 360, 62412, 0xffff]) {
      for (const h of [7, 12.7, 18.3, 20]) {
        const v = measuredTreeVariant(seed, h);
        expect(v % 3).toBe(seed % 3);
        expect(v).toBeLessThanOrEqual(0xffff);
        expect(Math.abs(treeHeight(v) - h)).toBeLessThanOrEqual(TREE_TOP[seed % 3]! * TREE_SCALE.step);
      }
    }
  });

  it("clamps a measured tree to the sizes the variant holds", () => {
    expect(treeScale(measuredTreeVariant(5, 0.4))).toBe(TREE_SCALE.min);
    expect(treeScale(measuredTreeVariant(5, 80))).toBe(TREE_SCALE.max);
    expect(measuredTreeVariant(measuredTreeVariant(7, 15), 15)).toBe(measuredTreeVariant(7, 15));
  });
});
