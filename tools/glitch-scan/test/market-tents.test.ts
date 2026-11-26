import { describe, expect, it } from "vitest";
import { PAD, stallsOffTents, underTent } from "./market-tents";

describe("market-stall-off-tent (G-964)", () => {
  // A tent 10 x 4 m turned 90 degrees (its axis along +z), its middle at (5, 5).
  const tent = [5, 5, 90, 10, 4] as const;
  it("takes a point under a turned tent, its edge grown by the pad, and none past it", () => {
    expect(underTent({ x: 5, z: 9.9 }, tent)).toBe(true);
    expect(underTent({ x: 7 + PAD - 0.01, z: 5 }, tent)).toBe(true);
    expect(underTent({ x: 7 + PAD + 0.01, z: 5 }, tent)).toBe(false);
    expect(underTent({ x: 5, z: 10 + PAD + 0.01 }, tent)).toBe(false);
  });

  it("finds a stall in the market under no tent, and none under one or outside the market", () => {
    const market = { id: "m", polygon: [0, 0, 20, 0, 20, 20, 0, 20], tents: [tent] };
    const found = stallsOffTents([market], [{ x: 5, z: 5 }, { x: 15, z: 15 }, { x: 30, z: 5 }]);
    expect(found).toEqual([{ at: "15,15", what: "m: a stall at 15.0,15.0 under none of its 1 tents" }]);
  });
});
