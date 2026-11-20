import { TREE_SPECIES } from "@seki/core";
import { describe, expect, it } from "vitest";
import { farTree, tree } from "../src/renderer/mapcity/prop-green";
import { hexColor } from "../src/renderer/mesh-sink";

/*
 * Street trees in comic realism (the user's decision of 20.11, `docs/zasady-lokacji.md` §9): the
 * near tree has limbs reaching into its crown and a crown of many small leaves, not a few smooth
 * blobs; the blob crown stays only as the far tree.
 */

const BARK = hexColor("#4a3a2f");
const isBark = (c: readonly number[], v: number): boolean => [0, 1, 2].every((k) => Math.abs(c[v * 4 + k]! - BARK[k]!) < 1e-6);

describe("street trees in comic realism (20.11)", () => {
  it("grow limbs and branches into the crown, well above the trunk's fork", () => {
    for (let s = 0; s < TREE_SPECIES; s++) {
      const t = tree(s);
      let high = 0;
      let spread = 0;
      for (let v = 0; v < t.vertexCount; v++) {
        if (!isBark(t.colors, v)) continue;
        high = Math.max(high, t.positions[v * 3 + 1]!);
        spread = Math.max(spread, Math.hypot(t.positions[v * 3]!, t.positions[v * 3 + 2]!));
      }
      expect(high).toBeGreaterThan(5);
      expect(spread).toBeGreaterThan(1.2);
    }
  });

  it("wear a crown of hundreds of leaves in many directions and shades, not a few blobs", () => {
    for (let s = 0; s < TREE_SPECIES; s++) {
      const t = tree(s);
      let leaves = 0;
      const facings = new Set<string>();
      const shades = new Set<string>();
      for (let v = 0; v < t.vertexCount; v += 4) {
        if (isBark(t.colors, v)) continue;
        leaves++;
        facings.add([0, 1, 2].map((k) => t.normals[v * 3 + k]!.toFixed(1)).join());
        shades.add([0, 1, 2].map((k) => t.colors[v * 4 + k]!.toFixed(2)).join());
      }
      expect(leaves).toBeGreaterThan(700);
      expect(facings.size).toBeGreaterThan(150);
      expect(shades.size).toBeGreaterThan(50);
    }
  });

  it("is the same tree every time, and each species its own", () => {
    expect(tree(2).positions).toEqual(tree(2).positions);
    const all = Array.from({ length: TREE_SPECIES }, (_, s) => JSON.stringify(tree(s).positions.slice(0, 300)));
    expect(new Set(all).size).toBe(TREE_SPECIES);
  });

  it("keeps the blob crown only for the far tree, a fraction of the near one", () => {
    for (let s = 0; s < TREE_SPECIES; s++) expect(farTree(s).indices.length * 20).toBeLessThan(tree(s).indices.length);
  });
});
