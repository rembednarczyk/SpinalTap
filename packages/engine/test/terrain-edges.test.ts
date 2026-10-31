import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { STEP_DEPTH, planSteps } from "../src/renderer/mapcity/steps-plan";
import { BASIN_RIM, SURFACE_LIFT, TERRAIN_APRON, planBasin, planTerrain } from "../src/renderer/mapcity/ground-plan";

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

  it("leave a flat run as level treads, with only the kerb at either end", () => {
    const sink = new MeshSink();
    planSteps(sink, [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2 }, { x: 0, z: 2 }], () => 0);
    expect(sink.positions.length / 3).toBe(Math.round(3 / STEP_DEPTH) * 4 + 2 * 4);
  });
});
