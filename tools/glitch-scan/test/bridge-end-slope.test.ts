import { describe, expect, it } from "vitest";
import { bridgeEndsInSlope } from "./bridge-end-slope";

/**
 * The glitch scan's check `bridge-end-in-slope` (G-739) on a deck along x over a ditch: a street
 * level at 0 west of x 0, its bank falling 1 m a metre to the floor at -3 (x 3), as the game's
 * terrain has the Czechówka's under the footbridge of Podzamcze.
 */
const ditch = (x: number) => -Math.min(Math.max(x, 0), 3);
const deck = (ax: number, bx: number) => ({ a: { x: ax, z: 0 }, b: { x: bx, z: 0 } });

describe("bridge ends down a bank (G-739)", () => {
  it("finds an end more than 0.5 m under the terrain within 2.5 m on past it, once a piece", () => {
    expect(bridgeEndsInSlope([deck(1.4, 20)], ditch)).toEqual([{ at: "1.4,0.0", what: "end at -1.40, the terrain up to 0.00 within 2.5 m on" }]);
    // A deck cut into pieces by a niche (G-274): one axis, its ends once.
    expect(bridgeEndsInSlope([deck(1.4, 20), deck(1.4, 20)], ditch)).toHaveLength(1);
    // The other end, on the floor beyond, 2 m from where the terrain rises again.
    expect(bridgeEndsInSlope([deck(1.4, 20)], (x) => (x > 21 ? x - 21 : ditch(x))).map((f) => f.at)).toEqual(["1.4,0.0", "20.0,0.0"]);
  });

  it("finds nothing at the bank's top, 0.5 m down it, on a gentle slope, or at a node another deck goes on from", () => {
    expect(bridgeEndsInSlope([deck(0.15, 20)], ditch)).toEqual([]);
    expect(bridgeEndsInSlope([deck(0.5, 20)], ditch)).toEqual([]);
    expect(bridgeEndsInSlope([deck(1.4, 20)], (x) => -0.15 * x)).toEqual([]);
    expect(bridgeEndsInSlope([deck(1.4, 20), deck(-5, 1.4)], ditch)).toEqual([]);
  });
});
