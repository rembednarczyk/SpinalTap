import { TREE_CROWN, TREE_SPECIES, TREE_TOP, measuredTreeVariant, treeHeight } from "@seki/core";
import { describe, expect, it } from "vitest";
import { toWorld } from "../src/renderer/mapcity/prop-batch";
import { tree } from "../src/renderer/mapcity/prop-green";

const top = (shape: number): number => {
  const p = tree(shape).positions;
  let y = -Infinity;
  for (let i = 1; i < p.length; i += 3) y = Math.max(y, p[i]!);
  return y;
};

/** How far the crown's vertices reach from the trunk's axis (m). */
const reach = (shape: number): number => {
  const p = tree(shape).positions;
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i]!, p[i + 2]!));
  return r;
};

describe("tree sizes (G-422)", () => {
  it("draws each species' crown up to the top the importer sizes it by", () => {
    for (let s = 0; s < TREE_SPECIES; s++) expect(top(s)).toBeCloseTo(TREE_TOP[s]!, 1);
  });

  it("keeps each species' crown within the reach the importer clears of the walls", () => {
    for (let s = 0; s < TREE_SPECIES; s++) {
      expect(reach(s)).toBeLessThanOrEqual(TREE_CROWN[s]!);
      expect(reach(s)).toBeGreaterThan(TREE_CROWN[s]! - 0.3);
    }
  });

  it("draws a measured tree as tall as its height", () => {
    for (const seed of [0, 1, 2, 4097]) {
      const variant = measuredTreeVariant(seed, 18.5);
      const [p] = toWorld([{ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant }], { x: 0, y: 0, z: 0 });
      expect(p!.shape).toBe(seed % 3);
      expect(top(p!.shape) * p!.scale).toBeCloseTo(treeHeight(variant), 1);
      expect(Math.abs(treeHeight(variant) - 18.5)).toBeLessThan(0.1);
    }
  });
});
