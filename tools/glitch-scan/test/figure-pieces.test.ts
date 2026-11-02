import { describe, expect, it } from "vitest";
import { type FigureLayout, type StreetPropItem, figureVariant } from "../../../packages/core/src";
import { type FigureWorld, figureChecks } from "./figure-pieces";

/**
 * The still crowd's checks (ADR-0058 stage 8) on a small world of their own: a house at x 10..20,
 * z 0..10, a road at z > 30, a square paved 0.08 m over the ground elsewhere, a resident's spot at
 * (0, -10) and a walkers' lane along z = -20. Each check catches its own fault and passes the rest.
 */

const world: FigureWorld = {
  inBuilding: (x, z) => x >= 10 && x <= 20 && z >= 0 && z <= 10,
  onRoad: (_x, z) => z > 30,
  surfaceY: () => 0.08,
  crowdSpots: [{ x: 0, z: -10 }],
  crowdLanes: [
    [
      { x: -50, z: -20 },
      { x: 50, z: -20 },
    ],
  ],
};

const bench = (x: number, z: number, yaw = 0): StreetPropItem => ({ prop: "bench", x, y: 0, z, yaw, variant: 0 });
const figure = (x: number, z: number, f: Partial<FigureLayout> = {}, y = 0.08, yaw = 0): StreetPropItem => ({
  prop: "figure",
  x,
  y,
  z,
  yaw,
  variant: figureVariant({ pose: "stand", body: "a", seat: 0, look: 0, ...f }),
});
/** A sitter on the middle seat of a long bench at (x, z): hips there, its seat's top, the bench's foot. */
const sitter = (x: number, z: number, f: Partial<FigureLayout> = {}): StreetPropItem => ({ ...figure(x, z, { pose: "perch", body: "a", seat: 0.45, ...f }, 0), y: 0 });

const found = (pieces: StreetPropItem[]): Record<string, string[]> =>
  Object.fromEntries(Object.entries(figureChecks(pieces, world)).map(([k, run]) => [k, run().map((f) => f.what)]));
const faults = (pieces: StreetPropItem[]): string[] =>
  Object.entries(found(pieces))
    .filter(([, list]) => list.length > 0)
    .map(([k]) => k);

describe("the still crowd's checks (ADR-0058 stage 8)", () => {
  it("passes a perched sitter on a bench's seat and a figure standing on the paving", () => {
    expect(faults([bench(0, 0), sitter(0, 0), figure(3, 0)])).toEqual([]);
  });

  it("finds a figure in a building, on the road, floating, in the crowd's way", () => {
    expect(faults([figure(15, 5)])).toEqual(["figure-in-building"]);
    expect(faults([figure(0, 30.1)])).toEqual(["figure-on-road"]);
    expect(faults([figure(3, 0, {}, 0.2)])).toEqual(["figure-floating"]);
    // On the paving at its middle, its toes in a kerb 0.16 m higher 5 cm in front: the soles, not the middle, decide.
    const kerb: FigureWorld = { ...world, surfaceY: (_x, z) => (z > 5.05 ? 0.24 : 0.08) };
    const atKerb = Object.entries(figureChecks([figure(3, 5)], kerb)).filter(([, run]) => run().length > 0);
    expect(atKerb.map(([k]) => k)).toEqual(["figure-floating"]);
    expect(atKerb[0]![1]()[0]!.what).toBe("stand figure a sole -0.16 m off the paving");
    // Turned away from the kerb, its heels are in it.
    expect(Object.entries(figureChecks([figure(3, 4.95, {}, 0.08, Math.PI)], kerb)).filter(([, run]) => run().length > 0).map(([k]) => k)).toEqual(["figure-floating"]);
    expect(faults([figure(0.4, -10)])).toEqual(["figure-in-crowd"]);
    expect(faults([figure(5, -19.3)])).toEqual(["figure-in-crowd"]);
  });

  it("finds a figure in a piece's solid or in another figure, a sitter's own bench aside", () => {
    expect(faults([bench(0, 0), figure(0.5, 0.1)])).toEqual(["figure-in-piece"]);
    expect(faults([figure(3, 0), figure(3.3, 0)])).toEqual(["figure-in-piece"]);
    expect(faults([bench(0, 0), sitter(0, 0), bench(0, 0.6)])).toEqual(["figure-in-piece"]);
  });

  it("finds a sitter on no seat: off its middle, turned, at another height, with no bench, its feet in the paving", () => {
    // Off its seat, the bench is no longer its own: it sits in its solid too.
    expect(faults([bench(0, 0), sitter(0.35, 0)])).toEqual(["figure-in-piece", "figure-off-seat"]);
    expect(faults([bench(0, 0), { ...sitter(0, 0), yaw: 0.4 }])).toEqual(["figure-in-piece", "figure-off-seat"]);
    expect(faults([bench(0, 0), sitter(0, 0, { seat: 0.6 })])).toEqual(["figure-in-piece", "figure-off-seat"]);
    expect(faults([sitter(0, 0)])).toEqual(["figure-off-seat"]);
    // Sitting upright on a bench whose seat is 0.37 m over the paving: the man's feet 5 cm in it.
    expect(found([bench(0, 0), sitter(0, 0, { pose: "sit" })])["figure-off-seat"]).toEqual(["sit figure feet -0.05 m off the ground"]);
  });
});
