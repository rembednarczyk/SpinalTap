import { describe, expect, it } from "vitest";
import { PAST, frontFar } from "./front-far";

const box = (minX: number, minZ: number, maxX: number, maxZ: number) => [minX, minZ, maxX, minZ, maxX, maxZ, minX, maxZ];

/** The glitch scan's check `front-far` (G-889). */
describe("front-far", () => {
  it("counts the samples of a frontage's pieces further than its reach and 6 m past it, once each", () => {
    // A pedestrian street along x at z = 0, its reach 8 m: its pieces may lie up to 14 m off the axis.
    const fronts = [{ line: [{ x: -10, z: 0 }, { x: 30, z: 0 }], reach: 8 }];
    const ground = [
      { surface: "square" as const, outline: box(0, 0, 2, 14), front: true as const },
      // A strip 1 m wide running off the street to 20 m: its last 6 m are past the frontage.
      { surface: "square" as const, outline: box(4, 0, 5, 20), front: true as const },
      { surface: "grass" as const, outline: box(4, 0, 5, 20), front: true as const },
      { surface: "square" as const, outline: box(10, 0, 12, 30) },
    ];
    const found = frontFar(fronts, [{ id: "c", ground }]);
    expect(8 + PAST).toBe(14);
    // 2 by 12 samples of the strip past 14 m, the grass under the setts the same places; a piece off the frontages none.
    expect(found.length).toBe(24);
    expect(found.every((f) => f.what.startsWith("c: square of a frontage"))).toBe(true);
    expect(found.map((f) => f.at).filter((a) => a.startsWith("4.25,"))[0]).toBe("4.25,14.25");
  });

  it("counts a frontage's piece with no axis near it", () => {
    expect(frontFar([], [{ id: "c", ground: [{ surface: "square", outline: box(0, 0, 1, 1), front: true }] }]).map((f) => f.what)).toEqual(Array(4).fill("c: square of a frontage far m past its reach"));
  });
});
