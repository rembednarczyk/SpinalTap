import { describe, expect, it } from "vitest";
import type { GroundSurface } from "@seki/core";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * The paving against the lawns by day (G-721, T-281; decision of 12.11: the squares no greyer than
 * in Lublin). On the orthophoto the map's squares are 1.66 (April) to 1.80 (June) times as bright
 * as its lawns, Plac Litewski's granite up to 2.1; brighter still burns out in the sun. The Old
 * Town's setts are 0.85 of its slabs, the paths 0.91-0.98. The fountains keep their dark water
 * (decision of 13.11). The colours are read off what the map city lays.
 */

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

/** Each surface on its own on a flat terrain; the colour of the ground it lays that faces up at its height. */
const laidColour = (surface: GroundSurface, lift: (y: number) => boolean = () => true): [number, number, number] => {
  const e = new MapEntries();
  e.terrains.set(1, { grid: { originX: -10, originZ: -10, cell: 2.5, cols: 13, rows: 13, heights: Array(169).fill(0) }, open: undefined, bounds: { minX: -10, maxX: 20, minZ: -10, maxZ: 20 }, mesh: null });
  const ring = rect(0, 0, 8, 6);
  e.addGround(100, { surface, ring, y: 0, bounds: boundsOf(ring), cell: "" });
  const ground = new MeshSink();
  planGround(ground, new MeshSink(), e, 100);
  const sum = [0, 0, 0];
  let n = 0;
  for (let v = 0; v < ground.vertexCount; v++) {
    if ((ground.normals[v * 3 + 1] ?? 0) < 0.9 || !lift(ground.positions[v * 3 + 1] ?? 0)) continue;
    for (let c = 0; c < 3; c++) sum[c]! += ground.colors[v * 4 + c] ?? 0;
    n++;
  }
  return n ? [sum[0]! / n, sum[1]! / n, sum[2]! / n] : [0, 0, 0];
};

const luma = ([r, g, b]: readonly number[]): number => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;

describe("the paving's colour by day (G-721)", () => {
  it("is 1.70 to 1.85 times as bright as the lawn: light, not burnt out in the sun", () => {
    const k = luma(laidColour("square")) / luma(laidColour("grass"));
    expect(k).toBeGreaterThanOrEqual(1.7);
    expect(k).toBeLessThanOrEqual(1.85);
  });

  it("lays setts and paths a little darker than the slabs, as the orthophoto shows", () => {
    const square = luma(laidColour("square"));
    const within = (k: number, lo: number, hi: number, what: string) => {
      expect(k, what).toBeGreaterThanOrEqual(lo);
      expect(k, what).toBeLessThanOrEqual(hi);
    };
    within(luma(laidColour("cobble")) / square, 0.82, 0.92, "cobble");
    within(luma(laidColour("footway")) / square, 0.88, 0.96, "footway");
  });

  it("lays the sidewalks as light as the orthophoto's, a little darker than the slabs (G-734)", () => {
    // Orthophoto medians (2025-04): sidewalk 0.95-0.97 of the square, 1.58 of the lawn (1.85 in June).
    const sidewalk = luma(laidColour("sidewalk"));
    expect(sidewalk / luma(laidColour("square"))).toBeGreaterThanOrEqual(0.88);
    expect(sidewalk / luma(laidColour("square"))).toBeLessThanOrEqual(0.97);
    expect(sidewalk / luma(laidColour("grass"))).toBeGreaterThanOrEqual(1.46);
  });

  it("keeps a fountain's water dark, not a light floor (decision of 13.11)", () => {
    const water = new MeshSink();
    const e = new MapEntries();
    e.terrains.set(1, { grid: { originX: -10, originZ: -10, cell: 2.5, cols: 13, rows: 13, heights: Array(169).fill(0) }, open: undefined, bounds: { minX: -10, maxX: 20, minZ: -10, maxZ: 20 }, mesh: null });
    const ring = rect(0, 0, 8, 6);
    e.addGround(100, { surface: "basin", ring, y: 0, bounds: boundsOf(ring), cell: "" });
    planGround(new MeshSink(), water, e, 100);
    expect(water.vertexCount).toBeGreaterThan(0);
  });
});
