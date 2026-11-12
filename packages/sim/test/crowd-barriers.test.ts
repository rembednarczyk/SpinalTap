import { describe, expect, it } from "vitest";
import { firstCrossing } from "../src/content/crowd-barriers";

/**
 * `firstCrossing` cuts a moved loop's little loops one by one (G-613): of several crossings it
 * gives the first in the order of going round, the moved segment with the lowest index and,
 * for it, the lowest crossed segment, not the last one it finds.
 */

type Pt = readonly [number, number];

/**
 * Within one 4 m cell (so the grid hands the segments back in the order they went in): segment
 * 0 runs east along z = 2 and the loop zigzags across it four times, segments 2, 3, 4 and 5.
 */
const ZIGZAG: readonly Pt[] = [
  [0.5, 2],
  [3.5, 2],
  [3.5, 3.5],
  [3, 1],
  [2.5, 3.5],
  [2, 1],
  [1.5, 3.5],
  [1, 3.5],
];

describe("firstCrossing", () => {
  it("gives the first of several crossings of a moved segment, in the loop's order", () => {
    // Only the first point moved: segments 0 and 7 are tried, 0 first.
    const flags = ZIGZAG.map((_, i) => i === 0);
    expect(firstCrossing(ZIGZAG, flags)).toEqual({ i: 0, j: 2, at: [3.2, 2] });
  });

  it("goes round from the first moved segment: an earlier one wins over a later one", () => {
    // Points 0 and 4 moved: segments 0, 3, 4 and 7 are tried; 0 comes first, with its first crossing.
    const flags = ZIGZAG.map((_, i) => i === 0 || i === 4);
    expect(firstCrossing(ZIGZAG, flags)).toEqual({ i: 0, j: 2, at: [3.2, 2] });
    // Point 4 alone: segments 3 and 4 both cross segment 0; 3 is tried first.
    const later = ZIGZAG.map((_, i) => i === 4);
    expect(firstCrossing(ZIGZAG, later)).toEqual({ i: 0, j: 3, at: [2.8, 2] });
  });

  it("finds none on an untouched or a simple loop", () => {
    expect(firstCrossing(ZIGZAG, ZIGZAG.map(() => false))).toBeNull();
    const square: Pt[] = [[0, 0], [3, 0], [3, 3], [0, 3]];
    expect(firstCrossing(square, square.map(() => true))).toBeNull();
  });
});
