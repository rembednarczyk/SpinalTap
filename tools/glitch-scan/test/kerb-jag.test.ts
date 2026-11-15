import { describe, expect, it } from "vitest";
import { kerbJag, zigzags } from "./kerb-jag";
import type { GroundChunk } from "./ground-strips";

/** A road 40 m long along x (z from -4 to 0) and a sidewalk along it (z from 0 up), its kerb the sidewalk's south edge. */
const chunk = (kerb: readonly (readonly [number, number])[]): GroundChunk => ({
  id: "t-0-0",
  bounds: { minX: 0, maxX: 40, minZ: -10, maxZ: 10 },
  ground: [
    { surface: "road", outline: [0, -4, 40, -4, 40, 0, 0, 0] },
    // The kerb runs east, so the edge's normal (right of it, as the renderer reads it) points at the road.
    { surface: "sidewalk", outline: [...kerb.flatMap(([x, z]) => [x, z]), 40, 4, 0, 4] },
  ],
});
const STRAIGHT: [number, number][] = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];

describe("jagged kerbs (kerb-jag)", () => {
  it("finds none on a straight kerb, a bend or an arc that only turns one way", () => {
    expect(kerbJag([chunk(STRAIGHT)], [])).toEqual([]);
    expect(zigzags([[0, 0], [1, 0], [2, 0.2], [3, 0.6], [3.5, 1.2]])).toEqual([]);
  });

  it("finds a zigzag of 0.3 m within 3 m and a step of 0.3 m, not one of 0.05 m", () => {
    expect(zigzags([[0, 0], [0.5, 0.3], [1, 0], [1.5, 0.3], [2, 0]]).length).toBeGreaterThan(0);
    expect(zigzags([[0, 0], [0.3, 0], [0.7, 0.3], [1.2, 0.3], [1.7, 0.3]]).length).toBeGreaterThan(0);
    expect(zigzags([[0, 0], [0.5, 0.05], [1, 0], [1.5, 0.05], [2, 0]])).toEqual([]);
  });

  it("finds a jag of the sidewalk's edge against the road, and not where the street's own axis zigzags", () => {
    // Kerb from the west to the east end with a notch 0.4 m deep at x = 20.
    const notched: [number, number][] = [[0, 0], [20, 0], [20.5, 0.4], [21, 0], [21.5, 0.4], [22, 0], [40, 0]];
    const found = kerbJag([chunk(notched)], []);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.what).toContain("kerb zigzag 0.4");
    const wavy: [number, number][] = [[20, -1], [20.5, -0.7], [21, -1], [21.5, -0.7], [22, -1]];
    expect(kerbJag([chunk(notched)], [wavy])).toEqual([]);
  });
});
