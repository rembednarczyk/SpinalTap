import { describe, expect, it } from "vitest";
import type { GroundSurface } from "@seki/core";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * The paving against the lawns by day (G-721, T-281; decision of 12.11: the squares no greyer than
 * in Lublin). On the orthophoto Plac Litewski's granite is 1.9 to 2.1 times as bright as its lawns,
 * its setts the same stone as its slabs, and its fountains' shallow pools light (G-129). The colours
 * are read off what the map city lays, the fountain's floor included: the water material draws
 * whatever it gets near-black by day.
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
const chroma = (c: readonly number[]): number[] => c.map((v) => v / (c[0]! + c[1]! + c[2]!));

describe("the paving's colour by day (G-721)", () => {
  it("is at least 1.8 times as bright as the lawn", () => {
    expect(luma(laidColour("square")) / luma(laidColour("grass"))).toBeGreaterThanOrEqual(1.8);
  });

  it("lays setts and paths in the slabs' stone: brightness within 5%, the same hue", () => {
    const square = laidColour("square");
    for (const s of ["cobble", "footway"] as const) {
      const c = laidColour(s);
      expect(Math.abs(luma(c) / luma(square) - 1), s).toBeLessThanOrEqual(0.05);
      chroma(c).forEach((v, i) => expect(Math.abs(v - chroma(square)[i]!), s).toBeLessThanOrEqual(0.01));
    }
  });

  it("gives a fountain's shallow pool a light floor, at least 0.7 of the square (G-129)", () => {
    // The floor, not the rim's ledge: below the rim's top.
    const floor = laidColour("basin", (y) => y > 0.2 && y < 0.4);
    expect(luma(floor) / luma(laidColour("square"))).toBeGreaterThanOrEqual(0.7);
  });
});
