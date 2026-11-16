import { describe, expect, it } from "vitest";
import { STEP, waterUnderGrass } from "./water-under-grass";

/** Water of the map under the import's grass (T-295), on a small world. */
const rect = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const chunks = [{ minX: 0, maxX: 100, minZ: 0, maxZ: 100 }];

describe("water-under-grass (T-295)", () => {
  it("counts the water a lawn covers, a sample a quarter of a square metre, on the chunks only", () => {
    // A river 10 x 40 m; a lawn over 10 x 4 m of it, another over 10 x 2 m past the chunk's edge.
    const found = waterUnderGrass({ water: [rect(10, -10, 20, 30)], grass: [rect(5, 10, 25, 14), rect(5, -6, 25, -4)], chunks });
    expect(found.length * STEP * STEP).toBe(40);
    expect(found[0]!.what).toMatch(/^water under grass /);
  });

  it("finds nothing where the water is drawn as water or the lawn lies on the bank", () => {
    expect(waterUnderGrass({ water: [rect(10, 10, 20, 30)], grass: [rect(20, 10, 30, 30)], chunks })).toEqual([]);
    expect(waterUnderGrass({ water: [rect(10, 10, 20, 30)], grass: [], chunks })).toEqual([]);
  });
});
