import { describe, expect, it } from "vitest";
import { type StreetPropItem, measuredTreeVariant } from "../../../packages/core/src";
import { WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { type MeasuredTree, cityMeasuredTrees, drawnTreeHeight, treeHeights, treesBelowMeasured } from "./tree-heights";

/** The glitch scan's check `tree-height-vs-nmpt` (G-422) on a few trees, and the trees of Plac Litewski against the surface model. */

const at = (x: number, variant: number): StreetPropItem => ({ prop: "tree", x, y: 0, z: 0, yaw: 0, variant });
const measured = (x: number, height: number): MeasuredTree => ({ id: `n${x}`, group: "test.tree", x, z: 0, height });

describe("trees lower than measured (tree-height-vs-nmpt)", () => {
  it("finds a tree drawn under 0.6 of its height, not one drawn near it", () => {
    const seed = 0xf0;
    expect(drawnTreeHeight(at(0, seed))).toBeCloseTo(9.7 * 1.25, 1);
    expect(treesBelowMeasured([measured(0, 21)], [at(0, seed)])).toHaveLength(1);
    expect(treesBelowMeasured([measured(0, 19)], [at(0, seed)])).toEqual([]);
    expect(treesBelowMeasured([measured(0, 21)], [at(0, measuredTreeVariant(seed, 21))])).toEqual([]);
  });

  it("matches a tree only within 1.5 m of its node, and other pieces not at all", () => {
    expect(treesBelowMeasured([measured(0, 21)], [at(2, 0)])).toEqual([]);
    expect(treesBelowMeasured([measured(0, 21)], [{ ...at(0, 0), prop: "lamp-park" }])).toEqual([]);
    expect(treeHeights([measured(0, 21)], [at(1.4, 0), at(0.2, 0xf0)])[0]!.drawn).toBeCloseTo(9.7 * 1.25, 1);
  });

  it("draws the trees of Plac Litewski within 2 m of their measured height in the median (T-195)", () => {
    const litewski = cityMeasuredTrees().filter((t) => t.group === "plac-litewski.tree");
    expect(litewski.length).toBeGreaterThan(90);
    const heights = treeHeights(litewski, Object.values(WORLD_STREET_PROPS).flat());
    expect(heights.length).toBeGreaterThan(90);
    const errors = heights.map((h) => Math.abs(h.drawn - h.tree.height)).sort((a, b) => a - b);
    expect(errors[Math.floor(errors.length / 2)]!).toBeLessThanOrEqual(2);
  });
});
