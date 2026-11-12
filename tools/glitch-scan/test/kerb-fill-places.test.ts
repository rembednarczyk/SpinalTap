import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";

/**
 * G-570: the curator's places along the kerbs of G-522's fills, on the orthophoto (PZGiK), read off
 * the city's ground as generated: the surfaces drawn at a point of each, in draw order.
 */
const inRing = (x: number, z: number, o: readonly number[]): boolean => {
  let r = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    const [ax, az, bx, bz] = [o[i]!, o[i + 1]!, o[j]!, o[j + 1]!];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) r = !r;
  }
  return r;
};
const surfacesAt = (x: number, z: number): string[] => {
  const chunk = MAP_CHUNKS.find((c) => x >= c.bounds.minX && x < c.bounds.maxX && z >= c.bounds.minZ && z < c.bounds.maxZ)!;
  return chunk.ground.filter((g) => inRing(x, z, g.outline)).map((g) => g.surface);
};

describe("the kerbs of G-522's fills on the orthophoto (G-570)", () => {
  it.each<[string, number, number, string[]]>([
    ["Kapucyńska's parking lane on the east", 150.5, -128, ["road"]],
    ["Lubartowska's bus bay at Brama Krakowska 01", 452.5, 13, ["road"]],
    // The estimate is the asphalt's width there (T-247): the gap is the pavement with the lamp posts.
    ["Królewska's pavement north of the carriageway", 565, -204.5, ["sidewalk"]],
    ["the verge of Andersa's northbound carriageway", 2385, 375, ["grass"]],
    ["the verge before the greenhouses by the parking aisle w1561106064", 2684, 291.6, ["grass"]],
  ])("draws %s as it is", (_, x, z, want) => {
    expect(surfacesAt(x, z)).toEqual(want);
  });
});
