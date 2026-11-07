import { describe, expect, it } from "vitest";
import { TREE_CROWN, TREE_KIND, treeHeight, treeScale, treeSpecies } from "../../../packages/core/src/world/trees.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { Site } from "../src/props-site.ts";
import { treeVariant } from "../src/tree-heights.ts";
import { genusOf, loadTreeTags, treeSpeciesOf } from "../src/tree-species.ts";

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

/** The pomniki przyrody of Plac Litewski (T-196): two pedunculate oaks (OSM `height=20`, 21) and the black poplar "Baobab". */
const OAKS = ["n4934090623", "n5975805015"];
const BAOBAB = "n5196773146";
const seeds = [0x70, 0x71, 0x72, 0xf0, 0xffff];

describe("trees of the species OSM names (G-423)", () => {
  it("reads the genus from genus, species or taxon", () => {
    expect(genusOf({ genus: "Quercus", species: "Quercus robur" })).toBe("Quercus");
    expect(genusOf({ species: "Populus nigra" })).toBe("Populus");
    expect(genusOf({ taxon: "tilia cordata" })).toBe("Tilia");
    expect(genusOf({ leaf_type: "broadleaved" })).toBeUndefined();
  });

  it("takes the model of a genus, the nearest one of a kindred genus, none of a conifer or an untagged tree", () => {
    expect(treeSpeciesOf({ genus: "Quercus" })).toBe(TREE_KIND.oak);
    expect(treeSpeciesOf({ species: "Populus alba" })).toBe(TREE_KIND.poplar);
    expect(treeSpeciesOf({ genus: "Tilia" })).toBe(TREE_KIND.lime);
    expect(treeSpeciesOf({ genus: "Acer" })).toBe(TREE_KIND.maple);
    expect(treeSpeciesOf({ genus: "Aesculus" })).toBe(TREE_KIND.chestnut);
    expect(treeSpeciesOf({ genus: "Fagus" })).toBe(TREE_KIND.oak);
    expect(treeSpeciesOf({ genus: "Pinus", leaf_type: "needleleaved" })).toBeUndefined();
    expect(treeSpeciesOf({ leaf_type: "broadleaved" })).toBeUndefined();
    expect(treeSpeciesOf(undefined)).toBeUndefined();
  });

  it("has the oaks and the Baobab in the trees' tags", () => {
    const tags = loadTreeTags();
    for (const id of OAKS) expect(treeSpeciesOf(tags.get(id))).toBe(TREE_KIND.oak);
    expect(treeSpeciesOf(tags.get(BAOBAB))).toBe(TREE_KIND.poplar);
  });

  it("grows a tagged tree in the open to its measured height as its species, whatever its seed", () => {
    for (const seed of seeds) {
      const oak = treeVariant(site, OAKS[0]!, { x: 50, z: 5 }, seed, TREE_KIND.oak);
      expect(treeSpecies(oak)).toBe(TREE_KIND.oak);
      expect(oak).toBeLessThanOrEqual(0xffff);
      expect(Math.abs(treeHeight(oak) - 20)).toBeLessThan(0.15);
      const poplar = treeVariant(site, BAOBAB, { x: 50, z: 5 }, seed, TREE_KIND.poplar);
      expect(treeSpecies(poplar)).toBe(TREE_KIND.poplar);
      expect(Math.abs(treeHeight(poplar) - 10.3)).toBeLessThan(0.15);
    }
  });

  it("keeps an unmeasured tagged tree at its seed's size, an untagged one at its seed", () => {
    for (const seed of seeds) {
      const v = treeVariant(site, "n1", { x: 50, z: 5 }, seed, TREE_KIND.oak);
      expect(treeSpecies(v)).toBe(TREE_KIND.oak);
      expect(treeScale(v)).toBeCloseTo(treeScale(seed >= 0xf000 ? seed - 0x3000 : seed), 9);
      const lime = treeVariant(site, "n1", { x: 50, z: 5 }, seed, TREE_KIND.lime);
      expect(treeSpecies(lime)).toBe(TREE_KIND.lime);
      expect(treeScale(lime)).toBeCloseTo(treeScale(v), 9);
    }
    expect(treeVariant(site, "n1", { x: 50, z: 5 }, 0x71)).toBe(0x71);
  });

  it("stops an oak's broad crown short of the wall it would grow into", () => {
    // 6 m off the wall: the seed's oak reaches 4.6 m, one grown to 20 m would reach 9.6 m.
    const v = treeVariant(site, OAKS[0]!, { x: 50, z: 32 }, 0x70, TREE_KIND.oak);
    expect(treeSpecies(v)).toBe(TREE_KIND.oak);
    expect(TREE_CROWN[TREE_KIND.oak]! * treeScale(v)).toBeLessThan(6);
    expect(TREE_CROWN[TREE_KIND.oak]! * treeScale(v)).toBeGreaterThan(5.5);
  });
});
