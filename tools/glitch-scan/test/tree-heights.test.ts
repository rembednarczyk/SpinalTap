import { describe, expect, it } from "vitest";
import { type StreetPropItem, measuredTreeVariant, treeSpread } from "../../../packages/core/src";
import { WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { type MeasuredTree, cityMeasuredPieces, cityMeasuredTrees, drawnTreeHeight, treeHeights, treesBelowMeasured, treesUnmeasured } from "./tree-heights";

/** The glitch scan's check `tree-height-vs-nmpt` (G-422) on a few trees, and the trees of Plac Litewski against the surface model. */

const at = (x: number, variant: number): StreetPropItem => ({ prop: "tree", x, y: 0, z: 0, yaw: 0, variant });
const measured = (x: number, height: number): MeasuredTree => ({ id: `n${x}`, x, z: 0, height });

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

  it("finds a tree with no measured one within 1.5 m, or one drawn at its seed's size (tree-unmeasured), not another piece", () => {
    const sized = measuredTreeVariant(0x71, 12);
    expect(treesUnmeasured([measured(0, 21)], [at(1.4, sized), at(3, sized), { ...at(9, 0), prop: "bench" }])).toEqual([{ at: "3,0", what: expect.stringContaining("no height") }]);
    expect(treesUnmeasured([measured(0, 21)], [at(0.5, 0x71)])).toEqual([{ at: "1,0", what: expect.stringContaining("seed's size") }]);
  });

  it("draws the trees of Plac Litewski within 2 m of their measured height in the median (T-195)", () => {
    const litewski = cityMeasuredTrees().filter((t) => t.x > -100 && t.x < 110 && t.z > -50 && t.z < 70);
    // The square's OSM trees, measured by the rule (91 in the game, audit of 14.11).
    expect(litewski.length).toBeGreaterThanOrEqual(90);
    const heights = treeHeights(litewski, Object.values(WORLD_STREET_PROPS).flat());
    expect(heights.length).toBeGreaterThanOrEqual(90);
    const errors = heights.map((h) => Math.abs(h.drawn - h.tree.height)).sort((a, b) => a - b);
    expect(errors[Math.floor(errors.length / 2)]!).toBeLessThanOrEqual(2);
  });
});

describe("trees by the walls (G-814)", () => {
  const trees = () => Object.values(WORLD_STREET_PROPS).flat().filter((t) => t.prop === "tree");
  const nearest = (x: number, z: number): number => Math.min(...trees().map((t) => Math.hypot(t.x - x, t.z - z)));

  it("draws the OSM trees by the facades at their measured height with narrower crowns, not at their seed's size", () => {
    // 21 m and 18 m limes and maples 1-3 m off the walls of Krakowskie's yards, a 20 m tree of Podzamcze, one by Grodzka.
    const by = [
      [155.7, 40.9],
      [-128.8, 22.6],
      [216.6, -8.4],
      [886.6, 544.3],
      [758.7, -203.3],
    ] as const;
    const pieces = trees().filter((t) => by.some(([x, z]) => Math.hypot(t.x - x, t.z - z) < 0.5));
    expect(pieces).toHaveLength(by.length);
    for (const m of cityMeasuredPieces(pieces)) {
      const t = pieces.find((p) => p.x === m.x && p.z === m.z)!;
      expect(drawnTreeHeight(t), m.id).toBeGreaterThan(0.9 * m.height);
      expect(treeSpread(t.variant), m.id).toBeLessThan(1);
    }
  });

  it("stands the crown rule's trees by the walls the seed's size kept out, and still none on the roofs of G-815", () => {
    // The yard of Podzamcze at (700, 570), canopy-without-tree before.
    expect(nearest(705, 570)).toBeLessThan(6);
    // The roofs and eaves of the curator's list (c13, c51, c81, c86, c152, c159, c165, c198, c221, c244, c273, c595).
    const roofs = [
      [-85.5, -133.5],
      [175.5, -170.5],
      [375.5, -262.5],
      [385.5, -139.5],
      [117.5, 72.5],
      [47.5, 78.5],
      [36.5, 79.5],
      [335.5, -16.5],
      [591.5, -136.5],
      [686.5, -163.5],
      [497.5, 13.5],
      [608.5, 569.5],
    ] as const;
    for (const [x, z] of roofs) expect(nearest(x, z), `${x},${z}`).toBeGreaterThan(3);
  });
});
