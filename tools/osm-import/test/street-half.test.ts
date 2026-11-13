import { describe, expect, it } from "vitest";
import { type Band } from "../src/ground.ts";
import { streetHalves } from "../src/street-half.ts";

const road = (line: { x: number; z: number }[], half: number, extra: Partial<Band> = {}): Band => ({
  surface: "road",
  ring: [],
  bridge: false,
  source: "w1",
  carriageway: true,
  kerb: { line, half },
  ...extra,
});

/** A street along +x from (0, 0) to (40, 0): its left is +z. */
const axis = [
  { x: 0, z: 0 },
  { x: 20, z: 0 },
  { x: 40, z: 0 },
];

describe("the carriageway's reach each side of a street's axis (ADR-0080)", () => {
  it("is half the width the import gives it, on both sides; none for a way without a carriageway", () => {
    const halves = streetHalves([road(axis, 3.25)]);
    expect(halves("w1", axis)).toEqual([3.25, 3.25, 3.25, 3.25, 3.25, 3.25]);
    expect(halves("w2", axis)).toBeUndefined();
  });

  it("follows a piece `fitLanes` moved aside: its axis 0.6 m to the left, the street's reach 0.6 m more on the left", () => {
    const fitted = axis.map((p) => ({ x: p.x, z: p.z + 0.6 }));
    expect(streetHalves([road(fitted, 2.5)])("w1", axis)).toEqual([3.1, 1.9, 3.1, 1.9, 3.1, 1.9]);
  });

  it("swaps its sides for a line drawn the other way (`oneway=-1`)", () => {
    const fitted = axis.map((p) => ({ x: p.x, z: p.z + 0.6 }));
    expect(streetHalves([road(fitted, 2.5)])("w1", [...axis].reverse())).toEqual([1.9, 3.1, 1.9, 3.1, 1.9, 3.1]);
  });

  /** Widened by 2 m on the right (-z) from x `from` to `to`, sampled every 0.5 m as `kerbFills` does. */
  const widened = (from: number, to: number) => {
    const inner = Array.from({ length: (to - from) * 2 + 1 }, (_, k) => ({ x: from + k * 0.5, z: -3 }));
    return [{ inner, outer: inner.map((p) => ({ x: p.x, z: -5 })) }];
  };

  it("reaches on to the paving where `kerbFills` widened the asphalt along most of a point's stretch, on that side only", () => {
    // The middle point stands for x 10 to 30: widened along 16 m of its 20.
    expect(streetHalves([road(axis, 3, { widen: widened(12, 28) })])("w1", axis)).toEqual([3, 3, 3, 5, 3, 3]);
  });

  it("does not widen a point's whole stretch by a bay along a part of it", () => {
    // A 10 m bay by the middle point: read linearly, it widened the street up to both ends 20 m off.
    expect(streetHalves([road(axis, 3, { widen: widened(15, 25) })])("w1", axis)).toEqual([3, 3, 3, 3, 3, 3]);
  });

  it("is 0 at a point off every piece of its carriageway (a tunnel's stretch)", () => {
    const piece = axis.slice(0, 2);
    expect(streetHalves([road(piece, 3)])("w1", axis)).toEqual([3, 3, 3, 3, 0, 0]);
  });

  it("does not move when the asphalt's drawn edge does: the ring is not read", () => {
    const ring = [
      { x: 0, z: -3 },
      { x: 40, z: -3 },
      { x: 40, z: 3 },
      { x: 0, z: 3 },
    ];
    const moved = ring.map((p) => ({ x: p.x, z: p.z + 0.05 }));
    expect(streetHalves([road(axis, 3, { ring: moved })])("w1", axis)).toEqual(streetHalves([road(axis, 3, { ring })])("w1", axis));
  });
});
