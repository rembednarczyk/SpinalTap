import { describe, expect, it } from "vitest";
import { PLAZA_GOING, PODIUM, SOUTH_STEPS } from "../../../packages/sim/src/content/alchemia";
import { STAIR_N } from "../../../packages/sim/src/content/tessen-w3/layout";
import { type FloorKind, type Foot, type Pt, type StairWorld, type StepQuad, MIN_BARE, flightsOf, mergeFeet, stairFootUnpaved, stepFeet } from "./stair-foot";
import { cityStairWorld } from "./stair-foot-world";

type Box = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly y0: number; readonly y1: number };

const quad = (b: Box): Pt[] => [
  { x: b.x0, z: b.z0 },
  { x: b.x1, z: b.z0 },
  { x: b.x1, z: b.z1 },
  { x: b.x0, z: b.z1 },
];
const inBox = (b: Box, x: number, z: number) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

/** A podium 3 m wide (x 0..3, z 0..3, top 0.6) with three steps of 0.15 down south to the ground at 0, its strip z -1.9..-0.9. */
const PODIUM_BOX: Box = { x0: 0, x1: 3, z0: 0, z1: 3, y0: 0, y1: 0.6 };
const STEPS: readonly Box[] = [1, 2, 3].map((k) => ({ x0: 0, x1: 3, z0: -0.3 * k, z1: -0.3 * (k - 1), y0: 0, y1: 0.6 - 0.15 * k }));

/** The world round it: the ground's surface by `ground`, solids the podium, the steps' own and `more`. */
const world = (ground: (x: number, z: number) => FloorKind, more: readonly Box[] = [], flights: readonly Foot[] = []): StairWorld => {
  const solids = [PODIUM_BOX, ...STEPS, ...more];
  return {
    steps: STEPS.map((b): StepQuad => ({ ring: quad(b), top: b.y1, bottom: b.y0, what: "test step" })),
    flights,
    floorAt: (x, z, y) => {
      let best: { top: number; kind: FloorKind } | null = y >= 0 ? { top: 0, kind: ground(x, z) } : null;
      for (const b of solids) if (inBox(b, x, z) && b.y1 <= y && b.y1 > (best?.top ?? -Infinity)) best = { top: b.y1, kind: "floor" };
      return best;
    },
    solidIn: (x, z, y0, y1) => y0 < 0 || solids.some((b) => inBox(b, x, z) && b.y0 < y1 && b.y1 > y0),
  };
};

describe("stair-foot-unpaved (the curator's review of C5, PR #793)", () => {
  it("finds the lowest step's front, not the upper steps' nor the steps' ends", () => {
    const feet = mergeFeet(stepFeet(world(() => "paved")));
    expect(feet).toHaveLength(1);
    expect(feet[0]!.out).toEqual({ x: 0, z: -1 });
    expect(feet[0]!.y).toBe(0);
    expect(feet[0]!.a.z).toBeCloseTo(-0.9, 9);
    expect(feet[0]!.b.z).toBeCloseTo(-0.9, 9);
  });

  it("finds a flight whose strip is bare or a lawn, and none on paving or a floor", () => {
    expect(stairFootUnpaved(world(() => "paved"))).toEqual([]);
    expect(stairFootUnpaved(world(() => "floor"))).toEqual([]);
    const bare = stairFootUnpaved(world(() => "bare"));
    expect(bare).toEqual([{ at: "1.5,-1.4", what: "test step: foot (0.0; -0.9)-(3.0; -0.9) at y 0.00, 3.00 m² (100%) of its strip unpaved" }]);
    expect(stairFootUnpaved(world(() => "lawn"))).toHaveLength(1);
    // Past the strip a metre deep the ground is no matter.
    expect(stairFootUnpaved(world((_, z) => (z < -1.95 ? "bare" : "paved")))).toEqual([]);
  });

  it("counts a part of the strip from a quarter of a square metre, and none under a wall standing on it", () => {
    const part = stairFootUnpaved(world((x) => (x < 1 ? "bare" : "paved")));
    expect(part).toHaveLength(1);
    expect(part[0]!.what).toContain("1.00 m² (33%)");
    // One cell of a quarter metre square is under it, a column of four is it.
    expect(stairFootUnpaved(world((x, z) => (x < 0.25 && z > -1.15 ? "bare" : "paved")))).toEqual([]);
    expect(stairFootUnpaved(world((x) => (x < 0.25 ? "bare" : "paved")))[0]!.what).toContain(`${MIN_BARE.toFixed(2)} m²`);
    const wall: Box = { x0: -1, x1: 4, z0: -2, z1: -0.9, y0: 0, y1: 2 };
    expect(stairFootUnpaved(world(() => "bare", [wall]))).toEqual([]);
  });

  it("finds a sloped flight's foot as given, and merges a step's parts into one foot", () => {
    const foot: Foot = { a: { x: 10, z: 0 }, b: { x: 10, z: 2 }, out: { x: 1, z: 0 }, y: 0, what: "sloped" };
    const found = stairFootUnpaved(world((x) => (x > 9 ? "bare" : "paved"), [], [foot]));
    expect(found.map((f) => f.what.split(":")[0])).toEqual(["sloped"]);
    const half = (a: number, b: number): Foot => ({ ...foot, a: { x: 10, z: a }, b: { x: 10, z: b } });
    expect(mergeFeet([half(0, 1), half(1, 2)])).toEqual([{ ...foot }]);
    expect(mergeFeet([half(0, 1), { ...half(1, 2), y: 0.2 }])).toHaveLength(2);
    // A foot stepping out with the falling ground, a going further and a riser lower at each step, is one flight; a storey over it is another.
    const stepped: Foot = { ...half(1, 2), a: { x: 10.28, z: 1 }, b: { x: 10.28, z: 2 }, y: -0.15 };
    expect(flightsOf([half(0, 1), stepped]).map((g) => g.length)).toEqual([2]);
    expect(flightsOf([half(0, 1), { ...stepped, y: 4 }]).map((g) => g.length)).toEqual([1, 1]);
    expect(stairFootUnpaved(world(() => "paved", [], [half(0, 1), stepped])).length).toBe(0);
    expect(stairFootUnpaved(world((x) => (x > 9 ? "bare" : "paved"), [], [half(0, 1), stepped])).length).toBe(1);
  });

  it("sees the game's flights: C5's south stairs on the paving, W-3's stair in its hall", () => {
    const w = cityStairWorld();
    const feet = mergeFeet([...w.flights, ...stepFeet(w)]);
    // The south flight's lowest steps: where the ground falls west, more of them come out of the paving.
    const foot = PODIUM.minZ - SOUTH_STEPS * PLAZA_GOING;
    expect(feet.filter((f) => f.what === "Alchemia step" && f.out.z === -1 && Math.abs(f.a.z - foot) < 1).length).toBeGreaterThan(0);
    expect(w.flights.some((f) => f.a.x === STAIR_N.maxX && f.out.x === 1)).toBe(true);
  });
});
