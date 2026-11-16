import { describe, expect, it } from "vitest";
import { MAP_CHUNKS, rawHeight } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { CUT_LIMIT, PLINTH_GAP, groundUnderPlinth, steepWayCut } from "./terrain-cuts";

/** A 10 × 6 m building about (5, 3), its foot at 0. */
const HOUSE = { id: "w1", x: 5, z: 3, y: 0, outline: [-5, -3, 5, -3, 5, 3, -5, 3] };

describe("ground-under-plinth (G-755 review)", () => {
  it("finds the outline's points where the ground lies over 0.05 m under the foot", () => {
    expect(groundUnderPlinth([HOUSE], () => 0)).toEqual([]);
    expect(groundUnderPlinth([HOUSE], () => -PLINTH_GAP + 0.01)).toEqual([]);
    // A cut along x > 8: the east side and the ends of the long sides past it.
    const found = groundUnderPlinth([HOUSE], (x) => (x > 8 ? -0.5 : 0));
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((f) => f.at)).toEqual(["9,0", "10,0", "10,1", "10,2", "10,3", "10,4", "10,5", "10,6", "9,6"]);
    expect(found.every((f) => f.what.startsWith("w1: ground 0.50 m under the foot"))).toBe(true);
  });

  it("takes no point off the map, where the ground is NaN", () => {
    expect(groundUnderPlinth([HOUSE], () => Number.NaN)).toEqual([]);
  });
});

describe("steep-way-cut (G-755 review)", () => {
  const way = { id: "w2/0", line: [0, 0, 20, 0] };

  it("finds the points of a stretch's band cut over 2 m under the NMT", () => {
    expect(steepWayCut([way], () => -CUT_LIMIT, () => 0)).toEqual([]);
    expect(steepWayCut([way], (x) => (x > 15 ? -2.5 : 0), () => 0).map((f) => f.at)).toEqual(["16,0", "17,0", "18,0", "19,0", "20,0"]);
    // Beside the axis only: found on the band's lines, not on the axis.
    const side = steepWayCut([way], (_x, z) => (z > 2 ? -3 : 0), () => 0, [-2.5, 0, 2.5]);
    expect(side.length).toBe(21);
    expect(steepWayCut([way], (_x, z) => (z > 2 ? -3 : 0), () => 0)).toEqual([]);
  });

  it("finds w179264855's band within 2 m of the NMT in the city (G-755: 1.86 m deepest)", () => {
    const ground = (x: number, z: number) => (MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) ? groundY(x, z) : Number.NaN);
    const ways = MAP_CHUNKS.flatMap((c) => c.steepWays ?? []).filter((w) => w.id === "w179264855/0");
    expect(ways).toHaveLength(1);
    expect(steepWayCut(ways, ground, rawHeight, [-2.5, -1.25, 0, 1.25, 2.5])).toEqual([]);
    // The same band 1.5 m deeper is found.
    expect(steepWayCut(ways, (x, z) => ground(x, z) - 1.5, rawHeight, [-2.5, -1.25, 0, 1.25, 2.5]).length).toBeGreaterThan(0);
  });
});
