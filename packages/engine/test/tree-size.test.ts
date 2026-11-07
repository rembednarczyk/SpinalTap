import { TREE_CROWN, TREE_KIND, TREE_SPECIES, TREE_TOP, measuredTreeVariant, treeHeight, withTreeSpecies } from "@seki/core";
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

/** How far the trunk reaches from its axis a metre over the ground (m). */
const girth = (shape: number): number => {
  const p = tree(shape).positions;
  let r = 0;
  for (let i = 0; i < p.length; i += 3) if (p[i + 1]! < 1) r = Math.max(r, Math.hypot(p[i]!, p[i + 2]!));
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

  it("draws a tree OSM names an oak or a poplar with the oak's or the poplar's model (G-423)", () => {
    for (const seed of [0, 1, 2, 4097]) {
      for (const species of [TREE_KIND.oak, TREE_KIND.poplar]) {
        const variant = withTreeSpecies(measuredTreeVariant(seed, 20), species);
        const [p] = toWorld([{ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant }], { x: 0, y: 0, z: 0 });
        expect(p!.shape).toBe(species);
        expect(top(p!.shape) * p!.scale).toBeCloseTo(treeHeight(variant), 1);
      }
    }
  });

  it("draws the oak's crown about as wide as the tree is tall, the poplar's tall and narrower, both on thicker trunks (G-423)", () => {
    expect(2 * reach(TREE_KIND.oak)).toBeGreaterThan(0.9 * top(TREE_KIND.oak));
    expect(top(TREE_KIND.poplar)).toBeGreaterThan(3 * reach(TREE_KIND.poplar));
    expect(reach(TREE_KIND.oak)).toBeGreaterThan(reach(TREE_KIND.maple) + 0.8);
    for (const s of [TREE_KIND.oak, TREE_KIND.poplar]) expect(girth(s)).toBeGreaterThan(1.5 * girth(TREE_KIND.lime));
  });
});
