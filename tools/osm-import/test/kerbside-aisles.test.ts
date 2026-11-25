import { describe, expect, it } from "vitest";
import { clipToRing } from "../src/kerbside.ts";

/** A car park's aisles clipped to its ring at the edges they cross (T-352, the curator's review of #1037). */

const square = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];

describe("an aisle clipped to its car park", () => {
  it("keeps the part of a segment inside the ring, cut at the edge it crosses", () => {
    const runs = clipToRing([{ x: -5, z: 5 }, { x: 5, z: 5 }], square);
    expect(runs).toHaveLength(1);
    expect(runs[0]![0]!.x).toBeCloseTo(0, 9);
    expect(runs[0]![1]!.x).toBeCloseTo(5, 9);
  });

  it("splits a line that leaves the ring and comes back into two runs", () => {
    const runs = clipToRing([{ x: 2, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 8 }, { x: 2, z: 8 }], square);
    expect(runs).toHaveLength(2);
    expect(runs[0]![runs[0]!.length - 1]!.x).toBeCloseTo(10, 9);
    expect(runs[1]![0]!.x).toBeCloseTo(10, 9);
  });

  it("keeps a run wholly inside as it is", () => {
    expect(clipToRing([{ x: 1, z: 1 }, { x: 9, z: 9 }], square)).toEqual([[{ x: 1, z: 1 }, { x: 9, z: 9 }]]);
  });
});
