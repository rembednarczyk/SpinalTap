import { describe, expect, it } from "vitest";
import { generatedCity } from "../../osm-import/test/city.ts";
import { fillGap } from "./fill-gap";

const box = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];

describe("bare terrain in a small hole between the bare ground rule's pieces (fill-gap, G-769)", () => {
  // Two pavings and a lawn round a 0.5 m triangle, as a split's edge left it at Krakowskie.
  const lower = { surface: "square", outline: [0, 0, 2, 0, 2, 1, 1.5, 1, 1, 0.5, 0, 0.5] };
  const upper = { surface: "square", outline: [0, 1, 2, 1, 2, 2, 0, 2] };
  const lawn = { surface: "grass", outline: [0, 0.5, 1, 0.5, 1.25, 0.75, 1, 1, 0, 1] };

  it("names the hole, and none where a piece of the map or a building covers it", () => {
    const fills = [{ id: "c", fills: [lower, upper, lawn] }];
    expect(fillGap(fills, []).map((f) => f.at)).toEqual(["1.3,0.9"]);
    expect(fillGap(fills, [{ ground: [{ outline: box(1, 0.5, 1.5, 1) }], buildings: [] }])).toEqual([]);
    expect(fillGap(fills, [{ ground: [], buildings: [{ x: 1, z: 0.5, outline: box(0, 0, 0.5, 0.5) }] }])).toEqual([]);
  });

  it("names no hole the rule leaves on purpose, over 0.5 m², nor the ground open round the pieces", () => {
    const ring = [{ surface: "square", outline: [0, 0, 4, 0, 4, 4, 0, 4, 0, 3, 3, 3, 3, 1, 0, 1] }, { surface: "square", outline: box(0, 1, 1, 3) }];
    expect(fillGap([{ id: "c", fills: ring }], [])).toEqual([]);
    expect(fillGap([{ id: "c", fills: [lower, upper] }], [])).toEqual([]);
  });

  it("finds none at Krakowskie (297; -226), where a lawn met two pavings on the slant", () => {
    const g = generatedCity();
    const near = fillGap(g.stats, g.chunks).filter((f) => {
      const [x, z] = f.at.split(",").map(Number) as [number, number];
      return Math.abs(x - 297) < 10 && Math.abs(z + 226) < 10;
    });
    expect(near).toEqual([]);
  });
});
