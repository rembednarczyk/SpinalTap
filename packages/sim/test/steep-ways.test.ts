import { describe, expect, it } from "vitest";
import { type TerrainGrid, terrainHeightAt } from "@seki/core";
import { MAX_WALK_SLOPE } from "../src/world/ground";
import { type SteepWay, shapeWays, steepWays, wayRamps } from "../src/content/lublin/steep-ways";
import type { LublinChunkData } from "../src/content/lublin/types";

/**
 * The stretches of the ways walked on foot too steep on the terrain (G-755): laid at an even grade
 * along their polyline, bends and all, where the game's ground is still too steep along them.
 */

/** A 40 × 40 m grid of 2.5 m whose bank falls 9 m over x 10..20 (0.9), level either side. */
const bank = (x: number) => -0.9 * Math.min(10, Math.max(0, x - 10));
const grid = (): TerrainGrid => {
  const heights: number[] = [];
  for (let r = 0; r <= 16; r++) for (let c = 0; c <= 16; c++) heights.push(bank(c * 2.5));
  return { originX: 0, originZ: 0, cell: 2.5, cols: 17, rows: 17, heights };
};
/** Down the bank by a bend: foot (26, 22), bend (15, 20), top (2, 18). */
const WAY: SteepWay = { id: "w1/0", line: [{ x: 26, z: 22 }, { x: 15, z: 20 }, { x: 2, z: 18 }] };
const at = (g: TerrainGrid) => (x: number, z: number) => terrainHeightAt(g, x, z);

describe("steep ways laid at an even grade (G-755)", () => {
  it("lays the axis from the terrain at its foot to its top, past its bend, at a grade a walker climbs", () => {
    const g = grid();
    const ramps = wayRamps([WAY], at(g));
    expect(ramps).toHaveLength(1);
    const h = at(shapeWays(g, ramps));
    // At its ends within the bilinear grid's reach of the ramp's points beside them.
    expect(Math.abs(h(26, 22) - bank(26))).toBeLessThan(0.3);
    expect(Math.abs(h(2, 18) - bank(2))).toBeLessThan(0.3);
    // Every 2 m of the axis climbs under MAX_WALK_SLOPE, either side of the bend too.
    const pts = WAY.line;
    let worst = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [a, b] = [pts[k]!, pts[k + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let s = 0; s + 2 <= len; s += 0.25) {
        const p = (t: number) => ({ x: a.x + ((b.x - a.x) * t) / len, z: a.z + ((b.z - a.z) * t) / len });
        worst = Math.max(worst, Math.abs(h(p(s + 2).x, p(s + 2).z) - h(p(s).x, p(s).z)) / 2);
      }
    }
    expect(worst).toBeLessThan(MAX_WALK_SLOPE);
    // Off the band and its blend the ground stays.
    expect(h(15, 5)).toBeCloseTo(bank(15), 6);
  });

  it("leaves a stretch the game's ground is walkable along: levelled already, or on a deck over the bank", () => {
    const g = grid();
    expect(wayRamps([WAY], () => 0)).toEqual([]);
    expect(wayRamps([WAY], at(g), () => -3)).toEqual([]);
  });

  it("takes a stretch in two chunks once", () => {
    const chunk = (id: string): LublinChunkData => ({ id, district: "shinsekai-7", bounds: { minX: 0, maxX: 40, minZ: 0, maxZ: 40 }, terrain: grid(), buildings: [], ground: [], streets: [], markings: [], pois: [], steepWays: [{ id: "w1/0", line: [26, 22, 15, 20, 2, 18] }] });
    expect(steepWays([chunk("a"), chunk("b")])).toEqual([WAY]);
  });
});
