import { describe, expect, it } from "vitest";
import { kerbSteps } from "./deck-kerb";

/**
 * The glitch scan's check `deck-kerb-step` (G-737) on a carriageway x 0..10, z 0..4 rising
 * 0.1 m per metre of x (its axis along z 2) and a sidewalk x 0.1..9.9, z 4.1..5.9 beside it.
 */

type Piece = { readonly ring: readonly { x: number; z: number }[]; readonly surface: string; readonly a: { x: number; z: number }; readonly b: { x: number; z: number }; readonly y: (x: number) => number };
const box = (x0: number, z0: number, x1: number, z1: number) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const road: Piece = { ring: box(0, 0, 10, 4), surface: "road", a: { x: 0, z: 2 }, b: { x: 10, z: 2 }, y: (x) => 0.1 * x };
const walk = (y: (x: number) => number, ring = box(0.1, 4.1, 9.9, 5.9), surface = "footway"): Piece => ({ ring, surface, a: { x: ring[0]!.x, z: 5 }, b: { x: ring[1]!.x, z: 5 }, y });
const scan = (...pieces: Piece[]) => kerbSteps(pieces, (p, x) => p.y(x));

describe("a bridge's sidewalk off its carriageway's level (G-737)", () => {
  it("finds the points of a sidewalk more than 0.05 m off the carriageway in their cross section, every 0.5 m", () => {
    // 0.15 m under it from end to end: x 0.5..9.5 by z 4.5..5.5, 19 by 3 points.
    const found = scan(road, walk((x) => 0.1 * x - 0.15));
    expect(found).toHaveLength(57);
    expect(found[0]).toEqual({ at: "0.5,4.5", what: "footway -0.10 beside the carriageway at 0.05" });
    // Level at x 0, the carriageway's grade lost to x 10: off by more than 0.05 m from x 1 on (18 columns).
    expect(scan(road, walk(() => 0))).toHaveLength(18 * 3);
  });

  it("finds nothing within 0.05 m, past the carriageway's span, too far off, across it or beside no carriageway", () => {
    expect(scan(road, walk((x) => 0.1 * x + 0.04))).toEqual([]);
    expect(scan(road, walk(() => -1, box(11, 4, 14, 6)))).toEqual([]);
    expect(scan(road, walk(() => -1, box(0, 10, 10, 12)))).toEqual([]);
    expect(scan(road, { ring: box(4, 4, 6, 9), surface: "footway", a: { x: 5, z: 4 }, b: { x: 5, z: 9 }, y: () => -1 })).toEqual([]);
    expect(scan(walk(() => -1))).toEqual([]);
    expect(scan(road, walk(() => -1, undefined, "cobble"))).toEqual([]);
  });
});
