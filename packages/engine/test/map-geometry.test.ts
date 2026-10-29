import { type TerrainGrid, terrainHeightAt } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { SURFACE_CODE, SURFACE_LIFT, drapeTriangles, planSurface, planTerrain } from "../src/renderer/mapcity/ground-plan";
import { type P2, cleanRing, offsetRing, orientedBox, pointInRing, signedArea, triangulate } from "../src/renderer/mapcity/polygon";

const area = (ring: readonly P2[], tris: readonly number[]) => {
  let s = 0;
  for (let t = 0; t < tris.length; t += 3) s += signedArea([ring[tris[t]!]!, ring[tris[t + 1]!]!, ring[tris[t + 2]!]!]);
  return s;
};

const L: P2[] = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 4 },
  { x: 4, z: 4 },
  { x: 4, z: 10 },
  { x: 0, z: 10 },
];

/** A comb: three teeth, deeply concave. */
const COMB: P2[] = [
  { x: 0, z: 0 },
  { x: 12, z: 0 },
  { x: 12, z: 8 },
  { x: 10, z: 8 },
  { x: 10, z: 2 },
  { x: 7, z: 2 },
  { x: 7, z: 8 },
  { x: 5, z: 8 },
  { x: 5, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 8 },
  { x: 0, z: 8 },
];

describe("plane geometry of the map city (ADR-0044)", () => {
  it("triangulates convex and concave outlines into counter-clockwise triangles covering their area", () => {
    for (const ring of [L, COMB, [...COMB].reverse()]) {
      const tris = triangulate(ring);
      expect(tris.length).toBe((ring.length - 2) * 3);
      expect(area(ring, tris)).toBeCloseTo(Math.abs(signedArea(ring)), 6);
      for (let t = 0; t < tris.length; t += 3) expect(signedArea([ring[tris[t]!]!, ring[tris[t + 1]!]!, ring[tris[t + 2]!]!])).toBeGreaterThan(0);
      // Every triangle's centre lies inside the outline (no ear across a notch).
      for (let t = 0; t < tris.length; t += 3) {
        const c = { x: (ring[tris[t]!]!.x + ring[tris[t + 1]!]!.x + ring[tris[t + 2]!]!.x) / 3, z: (ring[tris[t]!]!.z + ring[tris[t + 1]!]!.z + ring[tris[t + 2]!]!.z) / 3 };
        expect(pointInRing(c, ring)).toBe(true);
      }
    }
  });

  it("cleans rings: closing point, duplicates and collinear points go, the result is counter-clockwise", () => {
    const messy = [{ x: 0, z: 0 }, { x: 0, z: 5 }, { x: 0, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 0 }, { x: 0, z: 0 }];
    const clean = cleanRing(messy);
    expect(clean).toHaveLength(4);
    expect(signedArea(clean)).toBeCloseTo(100, 6);
    expect(triangulate([{ x: 0, z: 0 }, { x: 1, z: 0 }])).toEqual([]);
  });

  it("offsets rings out and in, and refuses an inset that turns edges around", () => {
    const sq = cleanRing([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }]);
    expect(signedArea(offsetRing(sq, 1)!)).toBeCloseTo(36, 6);
    expect(signedArea(offsetRing(sq, -1)!)).toBeCloseTo(4, 6);
    expect(offsetRing(sq, -2.5)).toBeNull();
  });

  it("finds the oriented box of a rotated rectangle", () => {
    const a = Math.PI / 6;
    const rect = [
      [-10, -3],
      [10, -3],
      [10, 3],
      [-10, 3],
    ].map(([u, v]) => ({ x: u! * Math.cos(a) - v! * Math.sin(a) + 5, z: u! * Math.sin(a) + v! * Math.cos(a) - 2 }));
    const box = orientedBox(rect);
    expect(box.halfLong).toBeCloseTo(10, 6);
    expect(box.halfShort).toBeCloseTo(3, 6);
    expect(Math.abs(box.ux * Math.cos(a) + box.uz * Math.sin(a))).toBeCloseTo(1, 6);
    expect(box.cx).toBeCloseTo(5, 6);
  });
});

const grid = (originX: number, cell: number, cols: number, rows: number, f: (x: number, z: number) => number): TerrainGrid => {
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(f(originX + c * cell, r * cell));
  return { originX, originZ: 0, cell, cols, rows, heights };
};

const vertices = (sink: MeshSink) => Array.from({ length: sink.vertexCount }, (_, i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]!, code: sink.uvs2[i * 2]! }));

describe("terrain and draped ground (ADR-0044)", () => {
  const slope = (x: number, z: number) => 0.1 * x + 0.05 * z + Math.sin(x / 7) * 0.8;

  it("samples the terrain on the simulation's interpolation, at most 5 m apart, with a skirt below the edges", () => {
    const g = grid(0, 10, 5, 4, slope);
    const sink = new MeshSink();
    planTerrain(sink, g);
    const vs = vertices(sink);
    const top = vs.filter((v) => Math.abs(v.y - terrainHeightAt(g, v.x, v.z)) < 1e-9);
    const skirt = vs.filter((v) => v.y < terrainHeightAt(g, v.x, v.z) - 1);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length + skirt.length).toBe(vs.length);
    const xs = [...new Set(top.map((v) => v.x))].sort((a, b) => a - b);
    expect(xs[1]! - xs[0]!).toBeCloseTo(5, 9);
  });

  it("closes the seam between chunks of different cells: the shared edge is on the same heights, the skirts hang below it", () => {
    // 5 m cells west of x = 20, 2.5 m cells east of it, both sampled from the same ground.
    const west = grid(0, 5, 5, 5, slope);
    const east = grid(20, 2.5, 9, 9, slope);
    const a = new MeshSink();
    const b = new MeshSink();
    planTerrain(a, west);
    planTerrain(b, east);
    const edge = (vs: ReturnType<typeof vertices>) => vs.filter((v) => Math.abs(v.x - 20) < 1e-9);
    const ea = edge(vertices(a));
    const eb = edge(vertices(b));
    // Where both meshes have a vertex on the seam they agree exactly; elsewhere the finer side
    // differs from the coarse one by the bilinear bend only, and both skirts cover the gap.
    for (const v of ea) {
      const twin = eb.find((w) => Math.abs(w.z - v.z) < 1e-9 && Math.abs(w.y - v.y) < 1e-9);
      if (v.y >= terrainHeightAt(west, v.x, v.z) - 1e-9) expect(twin).toBeDefined();
    }
    const lowest = (vs: typeof ea) => Math.min(...vs.map((v) => v.y - slope(v.x, v.z)));
    expect(lowest(ea)).toBeLessThan(-1);
    expect(lowest(eb)).toBeLessThan(-1);
  });

  it("drapes a surface on the terrain at its lift, cutting long triangles", () => {
    const g = grid(0, 10, 7, 7, slope);
    const h = (x: number, z: number) => terrainHeightAt(g, x, z);
    const ring = [{ x: 2, z: 2 }, { x: 58, z: 2 }, { x: 58, z: 9 }, { x: 2, z: 9 }];
    expect(drapeTriangles(ring).length).toBeGreaterThan(20);
    const sink = new MeshSink();
    planSurface(sink, "road", ring, h, null);
    for (const v of vertices(sink)) {
      expect(v.y).toBeCloseTo(h(v.x, v.z) + SURFACE_LIFT.road, 9);
      expect(v.code).toBe(SURFACE_CODE.road);
    }
  });

  it("puts a kerb on the sidewalk edge that faces a road, and none elsewhere", () => {
    const road = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 7 }, { x: 0, z: 7 }];
    const walk = [{ x: 0, z: 7 }, { x: 30, z: 7 }, { x: 30, z: 9.5 }, { x: 0, z: 9.5 }];
    const flat = () => 0;
    const kerbs = (roadAt: ((x: number, z: number) => boolean) | null) => {
      const sink = new MeshSink();
      planSurface(sink, "sidewalk", walk, flat, roadAt);
      return vertices(sink).filter((v) => v.code === SURFACE_CODE.kerb);
    };
    const with_ = kerbs((x, z) => pointInRing({ x, z }, road));
    expect(with_.length).toBeGreaterThan(0);
    expect(with_.every((v) => Math.abs(v.z - 7) < 0.3)).toBe(true);
    expect(Math.max(...with_.map((v) => v.y))).toBeGreaterThan(SURFACE_LIFT.road + 0.05);
    expect(kerbs(() => false)).toHaveLength(0);
  });
});
