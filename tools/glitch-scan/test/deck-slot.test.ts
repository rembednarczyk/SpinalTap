import { describe, expect, it } from "vitest";
import { deckSlots } from "./deck-slot";

/** The glitch scan's check `deck-slot` (G-340) on two decks along x at y 0, the valley at y -3 between and round them. */

const box = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
const decks = (gap: number, y = 0) => (x: number, z: number) => (x >= 0 && x <= 10 && z >= 0 && z <= 10 && (z <= 4 || z >= 4 + gap) ? (z <= 4 ? 0 : y) : null);
const valley = () => -3;

describe("slots between a bridge's decks (G-340)", () => {
  it("finds the points of a slot under 2 m wide between two decks, the valley under it", () => {
    // The slot 4 < z < 5.5, 41 points along x and 5 across.
    const found = deckSlots([box], decks(1.5), valley);
    expect(found).toHaveLength(41 * 5);
    expect(found[0]).toEqual({ at: "0.00,4.25", what: "ground -3.00 between decks at 0.00 and 0.00" });
  });

  it("finds nothing in a gap over 2 m to the far deck, off the bridge's edges, on the ground or skipped", () => {
    expect(deckSlots([box], decks(4.5), valley)).toEqual([]);
    expect(deckSlots([box], decks(1.5), () => -0.4)).toEqual([]);
    expect(deckSlots([box], decks(1.5, 1), () => -0.4)).toEqual([]);
    expect(deckSlots([box], decks(1.5), valley, (p) => p.x < 20)).toEqual([]);
    expect(deckSlots([box], () => null, valley)).toEqual([]);
  });

  it("counts a point once where the boxes of two bridges share a margin", () => {
    expect(deckSlots([box, box], decks(1.5), valley)).toHaveLength(41 * 5);
  });
});
