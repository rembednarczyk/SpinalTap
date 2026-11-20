import { describe, expect, it } from "vitest";
import { type FootPiece, type OffGroundWorld, alchemiaOffGround, boxPiece } from "./alchemia-ground";

const flat = () => 0;
const world = (pieces: FootPiece[], ground: OffGroundWorld["ground"] = flat, models: FootPiece[] = [], supports: FootPiece[] = []): OffGroundWorld => ({ pieces, models, supports, ground });
/** A chair's seat over its four legs (or none), on flat ground. */
const chair = (legs: boolean): FootPiece[] => [
  boxPiece(0, 0.42, 0, 0.42, 0.41, 0.45, "chair"),
  ...(legs ? [[0, 0], [0.39, 0], [0.39, 0.39], [0, 0.39]].map(([x, z]) => boxPiece(x!, x! + 0.03, z!, z! + 0.03, 0, 0.41, "frame")) : []),
];

describe("alchemia-off-ground (the user's 20.11)", () => {
  it("finds a piece hanging over the ground it stands on, not one on it, sunk in it or high on a storey", () => {
    expect(alchemiaOffGround(world([boxPiece(0, 2, 0, 1, 0, 1, "wall")]))).toEqual([]);
    expect(alchemiaOffGround(world([boxPiece(0, 2, 0, 1, -0.3, 1, "wall")]))).toEqual([]);
    expect(alchemiaOffGround(world([boxPiece(0, 2, 0, 1, 0.04, 1, "wall")]))).toEqual([]);
    const over = alchemiaOffGround(world([boxPiece(0, 2, 0, 1, 0.3, 1, "pane")]));
    expect(over).toHaveLength(1);
    expect(over[0]!.what).toMatch(/pane y 0\.30: 0\.30 m over/);
    // On a storey (its foot over `STANDING` above the ground): a sign, a slab's light, a canopy.
    expect(alchemiaOffGround(world([boxPiece(0, 2, 0, 1, 3, 4, "screen")]))).toEqual([]);
  });

  it("finds the downhill end of a level piece on a slope, and none where a plinth fills under it", () => {
    const slope = (x: number) => -0.1 * x;
    const glass = boxPiece(0, 10, 0, 0.2, 0, 2, "pane");
    const found = alchemiaOffGround(world([glass], slope));
    expect(found).toHaveLength(1);
    expect(found[0]!.at).toBe("10,0");
    const plinth = boxPiece(0, 10, 0, 0.2, -1.3, 0.05, "roof");
    expect(alchemiaOffGround(world([glass], slope, [], [plinth]))).toEqual([]);
  });

  it("takes a seat as held by its legs, a model as held by the planter it stands in", () => {
    expect(alchemiaOffGround(world(chair(true)))).toEqual([]);
    expect(alchemiaOffGround(world(chair(false)))).toHaveLength(1);
    const tree = boxPiece(4.9, 5.1, 4.9, 5.1, 10.4, 16, "model");
    const planter = boxPiece(4.4, 5.6, 4.4, 5.6, 9.95, 10.6, "planter");
    const roof = boxPiece(0, 10, 0, 10, 9.7, 10, "roof");
    expect(alchemiaOffGround(world([], flat, [tree, planter], [roof]))).toEqual([]);
    expect(alchemiaOffGround(world([], flat, [tree], [roof]))).toHaveLength(1);
  });

  it("finds a top cut by the ground at part of its outline, not one carried on by the piece on it, nor one wholly in the ground", () => {
    const bank = (x: number) => (x > 5 ? 0.4 : 0);
    const step = boxPiece(0, 10, 0, 1, -0.3, 0.2, "step");
    const found = alchemiaOffGround(world([step], bank));
    expect(found).toHaveLength(1);
    expect(found[0]!.what).toMatch(/step top y 0\.20: 0\.20 m under the ground/);
    expect(alchemiaOffGround(world([step, boxPiece(0, 10, 0, 1, 0.2, 3, "wall")], bank))).toEqual([]);
    expect(alchemiaOffGround(world([boxPiece(0, 10, 0, 1, -2, -0.5, "wall")], bank))).toEqual([]);
  });

  it("reads no ground where it is dug out under a room", () => {
    expect(alchemiaOffGround(world([boxPiece(0, 4, 0, 4, 1, 1.3, "roof")], () => null))).toEqual([]);
  });
});
