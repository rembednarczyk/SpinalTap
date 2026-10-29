import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { TERRAIN_APRON, planTerrain } from "../src/renderer/mapcity/ground-plan";

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
