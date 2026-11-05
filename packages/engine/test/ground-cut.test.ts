import { describe, expect, it } from "vitest";
import { terrainHeightAt } from "@seki/core";
import { METRO_CUTS, SHAPED_TERRAIN, groundY } from "@seki/sim";
import { cutGround } from "../src/renderer/mapcity/ground-cut";
import { planTerrain, planSurface } from "../src/renderer/mapcity/ground-plan";
import { MeshSink } from "../src/renderer/mesh-sink";

/** XZ area of the sink's triangles that face up, and whether any lies over (x, z). */
const upArea = (sink: MeshSink): number => {
  let s = 0;
  const p = sink.positions;
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
    s += Math.abs((p[b * 3]! - p[a * 3]!) * (p[c * 3 + 2]! - p[a * 3 + 2]!) - (p[c * 3]! - p[a * 3]!) * (p[b * 3 + 2]! - p[a * 3 + 2]!)) / 2;
  }
  return s;
};
const covers = (sink: MeshSink, x: number, z: number): boolean => {
  const p = sink.positions;
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const v = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!].map((i) => ({ x: p[i * 3]!, z: p[i * 3 + 2]! }));
    const d = (a: (typeof v)[0], b: (typeof v)[0]) => (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    const [d0, d1, d2] = [d(v[0]!, v[1]!), d(v[1]!, v[2]!), d(v[2]!, v[0]!)];
    if ((d0 >= 0 && d1 >= 0 && d2 >= 0) || (d0 <= 0 && d1 <= 0 && d2 <= 0)) return true;
  }
  return false;
};
/** Height the sink draws at (x, z), or null. */
const drawnAt = (sink: MeshSink, x: number, z: number): number | null => {
  const p = sink.positions;
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!].map((i) => ({ x: p[i * 3]!, y: p[i * 3 + 1]!, z: p[i * 3 + 2]! })) as [{ x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }];
    const det = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / det;
    const w = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / det;
    if (u < -1e-9 || w < -1e-9 || u + w > 1 + 1e-9) continue;
    return a.y + u * (b.y - a.y) + w * (c.y - a.y);
  }
  return null;
};

describe("the ground cut under the metro's pavilions (ADR-0071 stage 2)", () => {
  it("takes the rectangle out of a square of paving and keeps the rest where it was", () => {
    const sink = new MeshSink();
    const ring = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ];
    const h = (x: number, z: number) => 0.1 * x + 0.05 * z;
    planSurface(sink, "square", ring, h, null);
    const before = upArea(sink);
    const heights = [
      [1, 1],
      [9, 9],
      [2.9, 5],
      [6, 7.2],
    ].map(([x, z]) => drawnAt(sink, x!, z!));
    expect(cutGround(sink, [{ minX: 3, maxX: 6, minZ: 4, maxZ: 7 }])).toBeGreaterThan(0);
    expect(upArea(sink)).toBeCloseTo(before - 9, 6);
    expect(covers(sink, 4.5, 5.5)).toBe(false);
    expect(covers(sink, 3.05, 4.05)).toBe(false);
    expect([
      [1, 1],
      [9, 9],
      [2.9, 5],
      [6, 7.2],
    ].map(([x, z]) => drawnAt(sink, x!, z!))).toEqual(heights.map((y) => expect.closeTo(y!, 6)));
  });

  it("leaves a sink with nothing over the rectangles as it is", () => {
    const sink = new MeshSink();
    planSurface(sink, "square", [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }], () => 0, null);
    const indices = [...sink.indices];
    expect(cutGround(sink, [{ minX: 10, maxX: 12, minZ: 10, maxZ: 12 }])).toBe(0);
    expect(sink.indices).toEqual(indices);
  });

  it("opens every pavilion's shaft in its chunk's terrain and nothing round it", () => {
    for (const cut of METRO_CUTS) {
      const b = cut.bounds;
      const id = [...SHAPED_TERRAIN.keys()].find((k) => {
        const g = SHAPED_TERRAIN.get(k)!;
        return b.minX >= g.originX && b.maxX <= g.originX + (g.cols - 1) * g.cell && b.minZ >= g.originZ && b.maxZ <= g.originZ + (g.rows - 1) * g.cell;
      })!;
      const grid = SHAPED_TERRAIN.get(id)!;
      const sink = new MeshSink();
      planTerrain(sink, grid);
      cutGround(sink, [b]);
      const mx = (b.minX + b.maxX) / 2;
      const mz = (b.minZ + b.maxZ) / 2;
      expect(covers(sink, mx, mz), id).toBe(false);
      // Just outside the shaft the terrain is drawn at its height.
      for (const [x, z] of [
        [b.minX - 0.05, mz],
        [b.maxX + 0.05, mz],
        [mx, b.minZ - 0.05],
        [mx, b.maxZ + 0.05],
      ] as const) {
        expect(drawnAt(sink, x, z), `${id} ${x},${z}`).toBeCloseTo(terrainHeightAt(grid, x, z), 1);
        expect(Math.abs(groundY(x, z) - terrainHeightAt(grid, x, z))).toBeLessThan(0.05);
      }
    }
  });
});
