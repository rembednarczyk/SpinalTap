import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import type { Structure } from "../../osm-import/src/structures.ts";
import { treesByDeck, treesInStructure } from "./tree-structures";

/** The glitch scan's checks `tree-in-structure` and `tree-by-deck` (G-815). */

const piece = (x: number, z: number, prop: StreetPropItem["prop"] = "tree"): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant: 0 });
const square = (x0: number, z0: number, s: number) => [
  { x: x0, z: z0 },
  { x: x0 + s, z: z0 },
  { x: x0 + s, z: z0 + s },
  { x: x0, z: z0 + s },
];
const building: Structure = { id: "r1", kind: "building", ring: square(0, 0, 20), holes: [square(5, 5, 10)], box: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 } };

describe("trees in structures and by decks (G-815)", () => {
  it("finds a tree in a structure's outline, not in its courtyard, outside it, or another piece", () => {
    expect(treesInStructure([building], [piece(2, 2), piece(10, 10), piece(25, 2), piece(3, 3, "bench")])).toEqual([{ at: "2.0,2.0", what: "tree in building r1" }]);
  });

  it("finds a tree on a deck or 2 m from it, not further", () => {
    const deck = square(0, 0, 10);
    expect(treesByDeck([deck], [piece(5, 5), piece(11.5, 5), piece(12.5, 5)]).map((f) => f.at)).toEqual(["5.0,5.0", "11.5,5.0"]);
  });
});
