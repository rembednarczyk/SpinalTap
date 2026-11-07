import { describe, expect, it } from "vitest";
import { pavilionOnPaving, pavilionPrisms, pavingInGame, segmentHitsPrism } from "./pavilion-checks";
import { alchemiaHidesLandmarks } from "./alchemia-checks";

/** A 10 × 10 m square pavilion at the origin, its ladder's foot west of it. */
const square = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
  { x: 0, z: 10 },
];
const clear = { outline: square, foot: { x: -1, z: 5 }, walks: [], paved: [], streets: [] };

describe("pavilion-on-paving (ADR-0074 stage 3)", () => {
  it("finds the pavilion on a sidewalk's paving, a hand's breadth off it, on a crossing, by a carriageway and its ladder on a sidewalk", () => {
    expect(pavilionOnPaving(clear)).toEqual([]);
    const walk = (x: number) => ({ line: [{ x, z: -20 }, { x, z: 30 }], half: 1.25 });
    expect(pavilionOnPaving({ ...clear, walks: [walk(11.6)] })).toEqual([]);
    expect(pavilionOnPaving({ ...clear, walks: [walk(11.5)] })).toHaveLength(1);
    expect(pavilionOnPaving({ ...clear, walks: [walk(9)] })).toHaveLength(1);
    const crossing = [{ x: 8, z: -2 }, { x: 12, z: -2 }, { x: 12, z: 3 }, { x: 8, z: 3 }];
    expect(pavilionOnPaving({ ...clear, paved: [crossing] })).toHaveLength(1);
    expect(pavilionOnPaving({ ...clear, streets: [[{ x: -20, z: -3 }, { x: 30, z: -3 }]] })).toHaveLength(1);
    expect(pavilionOnPaving({ ...clear, streets: [[{ x: -20, z: -5 }, { x: 30, z: -5 }]] })).toEqual([]);
    expect(pavilionOnPaving({ ...clear, foot: { x: -1.5, z: 5 }, walks: [walk(-2)] }).map((f) => f.what)).toContain("the pavilion's ladder foot on a sidewalk");
  });

  it("keeps the game's pavilion off Bajkowskiego's and Lubartowska's sidewalks, the crossing and the carriageways", () => {
    const k = pavingInGame();
    expect(k.walks.length).toBeGreaterThanOrEqual(2);
    expect(k.paved.length).toBeGreaterThanOrEqual(2);
    expect(k.streets.length).toBeGreaterThanOrEqual(2);
    expect(pavilionOnPaving(k)).toEqual([]);
  });
});

describe("the pavilion's solids in the landmark check (ADR-0074 stage 3)", () => {
  it("cuts a sight line through a prism and passes one over it or beside it", () => {
    const q = { points: square, bottom: 0, top: 5 };
    expect(segmentHitsPrism({ x: -5, y: 2, z: 5 }, { x: 15, y: 2, z: 5 }, q)).toBe(true);
    expect(segmentHitsPrism({ x: -5, y: 6, z: 5 }, { x: 15, y: 6, z: 5 }, q)).toBe(false);
    expect(segmentHitsPrism({ x: -5, y: 2, z: 12 }, { x: 15, y: 2, z: 12 }, q)).toBe(false);
    expect(segmentHitsPrism({ x: -5, y: 2, z: 5 }, { x: -1, y: 2, z: 5 }, q)).toBe(false);
    expect(segmentHitsPrism({ x: 5, y: 2, z: 5 }, { x: 5, y: 9, z: 5 }, { ...q, points: [...square].reverse() })).toBe(true);
  });

  it("takes in the triangle, the annex, the attic and the sign, and hides no landmark's top", () => {
    const prisms = pavilionPrisms();
    expect(prisms.length).toBeGreaterThan(10);
    expect(Math.max(...prisms.map((p) => p.top))).toBeGreaterThan(5);
    expect(alchemiaHidesLandmarks()).toEqual([]);
  });
});
