import { describe, expect, it } from "vitest";
import { ON_BUILDING, PAD, marketsWithoutTents, stallsOffTents, tentsOnBuildings, underTent } from "./market-tents";

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

  it("finds a tent over a building by more than 2 m², and not one whose corner touches an eave", () => {
    // A tent 4 x 2 m along +x at (10, 10): a building east of x = 11 covers 1 x 2 = 2 m² of it, one east of x = 10.5, 3 m².
    const market = { id: "m", polygon: [0, 0, 20, 0, 20, 20, 0, 20], tents: [[10, 10, 0, 4, 2] as const] };
    expect(tentsOnBuildings([market], (x) => x > 11)).toEqual([]);
    const found = tentsOnBuildings([market], (x) => x > 10.5);
    expect(found).toHaveLength(1);
    expect(found[0]!.what).toBe(`m: the tent at 10.0,10.0 lies 3.0 m² over a building`);
    expect(ON_BUILDING).toBe(2);
  });

  it("tracks a market with no tents mapped, and not one with them", () => {
    const polygon = [0, 0, 20, 0, 20, 20, 0, 20];
    expect(marketsWithoutTents([{ id: "a", polygon }, { id: "b", polygon, tents: [] }, { id: "c", polygon, tents: [[5, 5, 0, 4, 2]] }])).toEqual([
      { at: "0,0", what: "a: no tents mapped" },
      { at: "0,0", what: "b: no tents mapped" },
    ]);
  });
});
