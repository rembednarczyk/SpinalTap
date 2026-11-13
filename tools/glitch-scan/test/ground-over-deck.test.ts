import { describe, expect, it } from "vitest";
import { groundOverDeck } from "./ground-over-deck";

/** The glitch scan's check `ground-over-deck` (G-686) on a deck x 0..2, z 0..1 at y 0. */

const deck = { ring: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 0, z: 1 }] };
const on = (x: number, z: number) => (x >= 0 && x <= 2 && z >= 0 && z <= 1 ? 0 : null);

describe("the terrain through a bridge's deck (G-686)", () => {
  it("finds the points under the deck, every 0.25 m, where the ground is more than 0.01 m over it", () => {
    // A bump at x 1.5..2 to 0.02 m: two columns of four points (the ring's far edges are off it).
    const found = groundOverDeck([deck], on, (x) => (x >= 1.5 ? 0.02 : 0));
    expect(found).toHaveLength(8);
    expect(found[0]).toEqual({ at: "1.50,0.00", what: "ground 0.020 over the deck at 0.000" });
  });

  it("finds nothing within the paving's lift, off the deck, at a skipped point, nor twice on two pieces", () => {
    expect(groundOverDeck([deck], on, () => 0.01)).toEqual([]);
    expect(groundOverDeck([deck], on, (x) => (x > 2 ? 1 : -1))).toEqual([]);
    expect(groundOverDeck([deck], on, () => 1, () => true)).toEqual([]);
    expect(groundOverDeck([deck, deck], on, (x) => (x >= 1.75 ? 1 : 0))).toHaveLength(4);
  });
});
