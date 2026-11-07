import { describe, expect, it } from "vitest";
import { type StreetPropItem, TREE_KIND, withTreeSpecies } from "../../../packages/core/src";
import { WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { type NamedTree, cityNamedTrees, treesOfOtherSpecies } from "./tree-species";

/** The glitch scan's check `tree-species-ignored` (G-423) on a few trees, and the pomniki przyrody of Plac Litewski. */

const at = (x: number, variant: number): StreetPropItem => ({ prop: "tree", x, y: 0, z: 0, yaw: 0, variant });
const named = (x: number, genus: string): NamedTree => ({ id: `n${x}`, genus, x, z: 0 });

describe("trees drawn as another species (tree-species-ignored)", () => {
  it("finds an oak drawn as a lime or a maple, not one drawn as an oak", () => {
    expect(treesOfOtherSpecies([named(0, "Quercus")], [at(0, 0x70)])).toHaveLength(1);
    expect(treesOfOtherSpecies([named(0, "Quercus")], [at(0, 0x71)])).toHaveLength(1);
    expect(treesOfOtherSpecies([named(0, "Quercus")], [at(0, withTreeSpecies(0x70, TREE_KIND.oak))])).toEqual([]);
    expect(treesOfOtherSpecies([named(0, "Populus")], [at(0, withTreeSpecies(0x70, TREE_KIND.oak))])).toHaveLength(1);
    // 0x70 % 3 is a maple, 0x72 % 3 a lime.
    expect(treesOfOtherSpecies([named(0, "Tilia")], [at(0, 0x70)])).toHaveLength(1);
    expect(treesOfOtherSpecies([named(0, "Tilia")], [at(0, 0x72)])).toEqual([]);
  });

  it("leaves out genera without a model of their own, trees far from the node and other pieces", () => {
    expect(treesOfOtherSpecies([named(0, "Fraxinus")], [at(0, 0x70)])).toEqual([]);
    expect(treesOfOtherSpecies([named(0, "Quercus")], [at(2, 0x70)])).toEqual([]);
    expect(treesOfOtherSpecies([named(0, "Quercus")], [{ ...at(0, 0x70), prop: "lamp-park" }])).toEqual([]);
  });

  it("draws the two oaks and the black poplar of Plac Litewski as oaks and a poplar (T-196)", () => {
    const trees = cityNamedTrees();
    expect(trees.map((t) => `${t.id} ${t.genus}`)).toEqual(expect.arrayContaining(["n4934090623 Quercus", "n5975805015 Quercus", "n5196773146 Populus"]));
    expect(treesOfOtherSpecies(trees, Object.values(WORLD_STREET_PROPS).flat())).toEqual([]);
  });
});
