import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { EVEN_GRADE, chunkSteepWays, steepWays } from "../src/steep-ways.ts";

const line = (id: number, tags: Record<string, string>, ...pts: [number, number][]): Line => ({ id: `w${id}`, osmId: id, tags, line: pts.map(([x, z]) => ({ x, z })) });
/** A bank falling 9 m over x 10..20 (0.9, as behind Grodzka's houses), level either side of it. */
const bank = (p: { x: number }) => -0.9 * Math.min(10, Math.max(0, p.x - 10));
const ends = (line: readonly number[]) => [line[0], line[1], line[line.length - 2], line[line.length - 1]];

describe("the stretches of the ways walked on foot too steep on the terrain (G-755)", () => {
  it("grows a way's bank along it until one even grade gets up it, foot first", () => {
    const [w, ...rest] = steepWays([line(1, { highway: "pedestrian" }, [-10, 0], [15, 0], [40, 0])], bank);
    expect(rest).toEqual([]);
    expect(w!.id).toBe("w1/0");
    const [x0, , x1] = ends(w!.line) as [number, number, number, number];
    // The foot at the bank's bottom, x > 20, the top at x < 10; 9 m over at least 9 / tg 30°.
    expect(x0).toBeGreaterThan(20);
    expect(x1).toBeLessThan(10);
    expect(9 / (x0 - x1)).toBeLessThanOrEqual(EVEN_GRADE + 0.01);
    // Its polyline keeps the way's bend at x 15.
    expect(w!.line).toHaveLength(6);
  });

  it("takes a way's two banks for one where they grow into each other, and numbers a way's stretches", () => {
    const two = (p: { x: number }) => bank(p) + bank({ x: p.x - 12 });
    expect(steepWays([line(2, { highway: "footway" }, [-10, 0], [60, 0])], two)).toHaveLength(1);
    const far = (p: { x: number }) => bank(p) + bank({ x: p.x - 40 });
    expect(steepWays([line(3, { highway: "path" }, [-10, 0], [90, 0])], far).map((w) => w.id)).toEqual(["w3/0", "w3/1"]);
  });

  it("leaves the streets, the steps, the bridges, the tunnels and a walkable way", () => {
    const kinds: Record<string, string>[] = [{ highway: "residential" }, { highway: "steps" }, { highway: "footway", bridge: "yes" }, { highway: "footway", tunnel: "yes" }, { highway: "pedestrian", area: "yes" }];
    for (const tags of kinds) {
      expect(steepWays([line(4, tags, [-10, 0], [40, 0])], bank), JSON.stringify(tags)).toEqual([]);
    }
    expect(steepWays([line(5, { highway: "footway" }, [-10, 0], [40, 0])], (p) => -0.6 * p.x)).toEqual([]);
  });

  it("gives a chunk the stretches reaching into it, whole", () => {
    const ways = steepWays([line(6, { highway: "pedestrian" }, [-10, 0], [40, 0])], bank);
    expect(chunkSteepWays(ways, { minX: 0, maxX: 12, minZ: -5, maxZ: 5 })).toEqual(ways);
    expect(chunkSteepWays(ways, { minX: 50, maxX: 60, minZ: -5, maxZ: 5 })).toEqual([]);
  });
});
