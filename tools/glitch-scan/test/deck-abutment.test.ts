import { describe, expect, it } from "vitest";
import { abutmentSteps } from "./deck-abutment";

/**
 * The glitch scan's check `deck-abutment-step` (G-349) on a deck x 0..10, z 0..4 at y 0, a street
 * on the terrain past its west end (x < 0) falling across it by `fall` per metre of z.
 */

type Piece = { readonly ring: readonly { x: number; z: number }[] };
const deck: Piece = { ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 0, z: 4 }] };
const on = (x: number, z: number) => x >= 0 && x <= 10 && z >= 0 && z <= 4;
const scan = (fall: number, paved = (x: number) => x < 0, under = 0) =>
  abutmentSteps([deck], {
    height: () => 0,
    deck: (x, z) => (on(x, z) ? 0 : null),
    ground: (x, z) => (x < 0 ? -fall * z : -under),
    paved: (x) => paved(x),
    headroom: 2,
  });

describe("steps at a bridge's abutments (G-349)", () => {
  it("finds the deck's end over a street falling across it more than 0.25 m, every 0.5 m", () => {
    const found = scan(0.1);
    // The west end from z 0 to 4, sampled at the middles of its 0.5 m pieces: the ground under the deck by more than 0.25 m from z 2.5 on (2.75, 3.25, 3.75).
    expect(found.map((f) => f.at)).toEqual(["0.0,3.8", "0.0,3.3", "0.0,2.8"]);
    expect(found[0]).toEqual({ at: "0.0,3.8", what: "deck 0.00 by the ground at -0.38 0.3 m beyond" });
  });

  it("finds nothing at a kerb, off the streets, or over a way under the bridge", () => {
    expect(scan(0.06)).toEqual([]);
    expect(scan(0.1, () => false)).toEqual([]);
    expect(scan(0, (x) => x > 10, 3)).toEqual([]);
    expect(scan(0, (x) => x > 10, 1).length).toBeGreaterThan(0);
  });
});
