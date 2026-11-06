import { describe, expect, it } from "vitest";
import { TREE_CROWN, TREE_SCALE, treeHeight, treeScale } from "../../../packages/core/src/world/trees.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { Site } from "../src/props-site.ts";
import { TREE_HEIGHTS, treeVariant } from "../src/tree-heights.ts";

/** A 100 x 60 m flat chunk with a row of houses whose south wall runs along z = 38. */
const site = new Site([
  {
    id: "test-0-0",
    district: "kanal",
    bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
    terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
    buildings: [{ id: "w1", x: 50, z: 45, y: 0, outline: [-50, -7, 50, -7, 50, 7, -50, 7], parts: [], height: 12, plinth: 0, levels: 3, use: "residential", look: 1, source: "default" }],
    ground: [],
    streets: [],
    markings: [],
    pois: [],
  } satisfies LublinChunkData,
]);

/** A Plac Litewski oak with OSM `height=20`, and a seed of each species at the old spread's middle. */
const OAK = "n4934090623";
const seeds = [0x70, 0x71, 0x72];

describe("trees grown to their measured height (G-422)", () => {
  it("has the oaks' OSM height and NMPT heights for the trees of Plac Litewski", () => {
    expect(TREE_HEIGHTS[OAK]).toBe(20);
    expect(Object.keys(TREE_HEIGHTS).length).toBeGreaterThan(90);
  });

  it("grows a tree in the open to its height, keeping its species", () => {
    for (const seed of seeds) {
      const v = treeVariant(site, OAK, { x: 50, z: 5 }, seed);
      expect(v % 3).toBe(seed % 3);
      expect(Math.abs(treeHeight(v) - 20)).toBeLessThan(0.15);
    }
  });

  it("leaves a tree with no measurement at its seed", () => {
    expect(treeVariant(site, "n1", { x: 50, z: 5 }, 0x71)).toBe(0x71);
  });

  it("stops a crown short of the wall it would grow into, never under its seed's size", () => {
    for (const seed of seeds) {
      // 6 m off the wall: the seed's crown is clear, the oak's would reach 6.4-8.75 m.
      const v = treeVariant(site, OAK, { x: 50, z: 32 }, seed);
      const reach = TREE_CROWN[seed % 3]! * treeScale(v);
      expect(reach).toBeLessThan(6);
      expect(reach).toBeGreaterThan(5.5);
      expect(treeScale(v)).toBeGreaterThan(treeScale(seed));
      // By the wall even the seed's crown reaches into it: the seed's size stays.
      expect(treeVariant(site, OAK, { x: 50, z: 36 }, seed)).toBe(seed);
    }
  });

  it("shrinks a tree measured lower than its seed's size, down to the smallest size", () => {
    const v = treeVariant(site, "n9331221703", { x: 50, z: 5 }, 0xf0);
    expect(TREE_HEIGHTS["n9331221703"]).toBeLessThan(1);
    expect(treeScale(v)).toBe(TREE_SCALE.min);
  });
});
