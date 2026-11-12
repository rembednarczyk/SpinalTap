import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { STEP_DEPTH, planSteps } from "../src/renderer/mapcity/steps-plan";
import { BASIN_RIM, SURFACE_LIFT, TERRAIN_APRON, planBasin, planTerrain } from "../src/renderer/mapcity/ground-plan";
import type { P2 } from "../src/renderer/mapcity/polygon";

const grid = { originX: 0, originZ: 0, cell: 10, cols: 3, rows: 3, heights: [0, 0, 0, 1, 1, 1, 2, 2, 2] };

describe("terrain at the edge of the map data", () => {
  it("gets a level apron on to the horizon; closed sides keep only their skirts", () => {
    const bare = new MeshSink();
    planTerrain(bare, grid);
    const apron = new MeshSink();
    planTerrain(apron, grid, { south: true, north: false, west: false, east: false });
    expect(apron.positions.length).toBeGreaterThan(bare.positions.length);
    let farZ = 0;
    for (let i = 2; i < apron.positions.length; i += 3) farZ = Math.min(farZ, apron.positions[i] ?? 0);
    expect(farZ).toBeCloseTo(-TERRAIN_APRON, 6);
    const closed = new MeshSink();
    planTerrain(closed, grid, { south: false, north: false, west: false, east: false });
    expect(closed.positions).toEqual(bare.positions);
  });
});


describe("fountain basins", () => {
  it("hold their water above the square inside a stone rim", () => {
    const water = new MeshSink();
    const stone = new MeshSink();
    const square = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
      { x: 0, z: 4 },
    ];
    planBasin(water, stone, square, () => 1);
    const ys = (s: MeshSink) => s.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys(water))).toBeCloseTo(1 + SURFACE_LIFT.basin, 6);
    expect(Math.max(...ys(stone))).toBeCloseTo(1 + BASIN_RIM.top, 6);
    expect(Math.min(...ys(stone))).toBeCloseTo(1, 6);
    // Each side: outer face, ledge, inner face; four corners each.
    expect(stone.positions.length / 3).toBe(4 * 3 * 4);
  });
});


describe("outdoor steps", () => {
  it("climb a slope in level treads joined by risers", () => {
    const sink = new MeshSink();
    // A 3 m wide run 6.6 m long along x, the ground rising 1 m per 3 m.
    const ring = [
      { x: 0, z: -1.5 },
      { x: 6.6, z: -1.5 },
      { x: 6.6, z: 1.5 },
      { x: 0, z: 1.5 },
    ];
    planSteps(sink, ring, (x) => x / 3);
    const ys = new Set<number>();
    for (let i = 1; i < sink.positions.length; i += 3) ys.add(Math.round((sink.positions[i] ?? 0) * 100) / 100);
    // About 20 treads, each at its own level.
    expect(ys.size).toBeGreaterThanOrEqual(Math.round(6.6 / STEP_DEPTH) - 1);
    // Treads (4 corners), risers between them and one at each end up from the ground.
    const treads = Math.round(6.6 / STEP_DEPTH);
    expect(sink.positions.length / 3).toBe(treads * 4 + (treads - 1 + 2) * 4);
    // No tread sinks into the slope: each stands at or above the ground at both its ends.
    for (let i = 0; i < sink.positions.length; i += 3) expect((sink.positions[i + 1] ?? 0) + 1e-6).toBeGreaterThanOrEqual(Math.min((sink.positions[i] ?? 0) / 3, 2.2) - 0.34);
  });

  it("lie as paving on ground too gentle for a flight, not as a row of dark lines (G-018)", () => {
    const sink = new MeshSink();
    // Plac Litewski: a run 18.6 m long rising 0.87 m, 1.5 cm per tread of STEP_DEPTH.
    const ground = (x: number) => (x / 18.6) * 0.87;
    planSteps(sink, [{ x: 0, z: 0 }, { x: 18.6, z: 0 }, { x: 18.6, z: 3 }, { x: 0, z: 3 }], ground);
    expect(sink.empty).toBe(false);
    for (let v = 0; v < sink.vertexCount; v++) {
      // No riser: every face looks up, and lies on the ground just above it.
      expect(sink.normals[v * 3 + 1] ?? 0).toBeGreaterThan(0.9);
      expect((sink.positions[v * 3 + 1] ?? 0) - ground(sink.positions[v * 3] ?? 0)).toBeCloseTo(0.05, 3);
    }
  });

  // Bands the map's edge cuts slantwise: schody w481462067 at Stare Miasto's edge x = 760 and the
  // flight at Nabrzeże's edge z = 60. Each cut band's box runs about 1 m past the edge, where the
  // ground, off every chunk, is 0; on the map it slopes, lowest at the edge.
  const CUT = [
    { ring: [{ x: 757.3, z: -213.3 }, { x: 760, z: -210.9 }, { x: 760, z: -206.9 }, { x: 755.3, z: -211 }], ground: (x: number) => (x > 760 ? 0 : -20.1 + (760 - x) * 0.5), mapEdgeAt: (a: P2, c: P2) => a.x === 760 && c.x === 760, edge: -20.1 },
    { ring: [{ x: 2660.4, z: 60 }, { x: 2656.5, z: 63.4 }, { x: 2654.5, z: 61.1 }, { x: 2655.8, z: 60 }], ground: (_: number, z: number) => (z < 60 ? 0 : -18.2 + (z - 60) * 0.5), mapEdgeAt: (a: P2, c: P2) => a.z === 60 && c.z === 60, edge: -18.2 },
  ];
  it.each(CUT)("end on the ground of the map where the map's edge cuts the band, not on the void past it (G-703)", ({ ring, ground, mapEdgeAt, edge }) => {
    const sink = new MeshSink();
    planSteps(sink, ring, ground, mapEdgeAt);
    let tallest = 0;
    for (let q = 0; q + 3 < sink.vertexCount; q += 4) {
      if (Math.abs(sink.normals[q * 3 + 1] ?? 0) > 0.5) continue;
      const ys = [0, 1, 2, 3].map((k) => sink.positions[(q + k) * 3 + 1] ?? 0);
      tallest = Math.max(tallest, Math.max(...ys) - Math.min(...ys));
    }
    expect(tallest).toBeLessThan(0.5);
    // The lower end stands on the ground at the edge.
    let low = Infinity;
    for (let v = 0; v < sink.vertexCount; v++) low = Math.min(low, sink.positions[v * 3 + 1] ?? 0);
    expect(low).toBeCloseTo(edge, 1);
  });

  // Verifier's case of G-703 round 1: a gentle band beside a bridge's deck 3 m high past x = 6.2.
  // The drape reads the surface under each point (`surfaceAt`, G-301), the terrain here, not the
  // deck the ground's corners round it reach: with or without a cut at the map's edge (x = 0).
  it.each([
    { name: "inside the map", mapEdgeAt: () => false },
    { name: "cut at the map's edge", mapEdgeAt: (a: P2, c: P2) => a.x === 0 && c.x === 0 },
  ])("lie on the surface under them beside a bridge's deck, not on the deck ($name)", ({ mapEdgeAt }) => {
    const terrain = (x: number) => 0.01 * x;
    const h = Object.assign((x: number) => (x > 6.2 ? 3 : terrain(x)), { surfaceAt: () => terrain });
    const sink = new MeshSink();
    planSteps(sink, [{ x: 0, z: 0.3 }, { x: 6.1, z: 0.3 }, { x: 6.1, z: 2.1 }, { x: 0, z: 2.1 }], h, mapEdgeAt);
    let top = -Infinity;
    for (let v = 0; v < sink.vertexCount; v++) top = Math.max(top, sink.positions[v * 3 + 1] ?? 0);
    expect(top).toBeLessThan(0.12);
  });

  it("share their normals with the band past a seam of chunks, where the ground goes on (G-703)", () => {
    const ground = (x: number, z: number) => 0.01 * x + 0.004 * x * x + 0.02 * z;
    const lay = (ring: { x: number; z: number }[]) => {
      const sink = new MeshSink();
      planSteps(sink, ring, ground, () => false);
      const at = new Map<string, number[]>();
      for (let v = 0; v < sink.vertexCount; v++) {
        const key = [0, 1, 2].map((k) => (sink.positions[v * 3 + k] ?? 0).toFixed(4)).join(",");
        at.set(key, [0, 1, 2].map((k) => sink.normals[v * 3 + k] ?? 0));
      }
      return at;
    };
    // One band cut at the seam x = 10, on a line of the drape's grid.
    const west = lay([{ x: 4, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 3 }, { x: 4, z: 3 }]);
    const east = lay([{ x: 10, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 3 }, { x: 10, z: 3 }]);
    const shared = [...west.keys()].filter((k) => east.has(k));
    expect(shared.length).toBeGreaterThanOrEqual(2);
    for (const k of shared) expect(east.get(k)).toEqual(west.get(k));
  });

  it("leave a flat run as level treads, with only the kerb at either end", () => {
    const sink = new MeshSink();
    planSteps(sink, [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2 }, { x: 0, z: 2 }], () => 0);
    expect(sink.positions.length / 3).toBe(Math.round(3 / STEP_DEPTH) * 4 + 2 * 4);
  });
});
