import { describe, expect, it } from "vitest";
import { terrainHeightAt } from "@seki/core";
import { FLIGHT_CELL, STEP_RISE, flightRamps, refineGrid, shapeGrid } from "../src/content/lublin/shape";
import { inBuilding } from "../src/content/lublin/places";
import { FLIGHT_RAMPS, MAP_CHUNKS, PADS, RAMPS } from "../src/content/lublin/sites";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import type { LublinChunkData, LublinFlightData } from "../src/content/lublin/types";

/**
 * Flights of steps against their map `incline` (G-236): where the terrain falls from a flight's
 * foot to its top, it is ramped up the flight from the foot; a flight the terrain climbs keeps it.
 */

/** A 20 × 20 m chunk on a 1 m grid whose ground falls 0.1 m a metre along x. */
const chunk = (id: string, flights: readonly LublinFlightData[]): LublinChunkData => {
  const heights: number[] = [];
  for (let z = 0; z <= 20; z++) for (let x = 0; x <= 20; x++) heights.push(-x / 10);
  return {
    id,
    district: "shinsekai-7",
    bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 },
    terrain: { originX: 0, originZ: 0, cell: 1, cols: 21, rows: 21, heights },
    buildings: [],
    ground: [],
    streets: [],
    markings: [],
    pois: [],
    flights,
  };
};

describe("ramps along flights of steps against their incline (G-236)", () => {
  // Foot at x 4, top at x 10 by a turn at (7, 13): the ground falls 0.6 m foot to top.
  const against: LublinFlightData = { id: "w1", line: [4, 10, 7, 13, 10, 10] };

  it("raises the terrain from the foot up the flight, its step_count's risers or as far as it fell", () => {
    for (const [flight, rise] of [
      [against, 0.6],
      [{ ...against, steps: 7 }, 7 * STEP_RISE],
    ] as const) {
      const c = chunk("c", [flight]);
      const ramps = flightRamps([c]);
      expect(ramps).toHaveLength(3);
      const shaped = shapeGrid(c.terrain, [], ramps);
      const h = (x: number, z: number) => terrainHeightAt(shaped, x, z);
      expect(h(4, 10)).toBeCloseTo(-0.4, 6);
      expect(h(7, 13)).toBeCloseTo(-0.4 + rise / 2, 6);
      expect(h(10, 10)).toBeCloseTo(-0.4 + rise, 6);
      // Off the flight, past its corridor and blend, the ground stays.
      expect(h(7, 5)).toBeCloseTo(-0.7, 6);
    }
  });

  it("leaves a flight the terrain climbs or about level, and takes one in two chunks once", () => {
    expect(flightRamps([chunk("c", [{ id: "w2", line: [10, 10, 4, 10] }])])).toEqual([]);
    expect(flightRamps([chunk("c", [{ id: "w3", line: [4, 10, 5, 10] }])])).toEqual([]);
    expect(flightRamps([chunk("a", [against]), chunk("b", [against])])).toHaveLength(3);
  });
});

describe("flights' ramps in the city (G-236)", () => {
  const chunkAt = (x: number, z: number) => MAP_CHUNKS.find((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ)!;
  const map = (x: number, z: number) => terrainHeightAt(chunkAt(x, z).terrain, x, z);
  const game = (x: number, z: number) => terrainHeightAt(SHAPED_TERRAIN.get(chunkAt(x, z).id)!, x, z);

  it("ramps the cathedral's portal steps w66335060 from their foot on the square up 7 risers", () => {
    // The flight and the landing past its top.
    expect(FLIGHT_RAMPS).toHaveLength(2);
    const { a, b, ya, yb } = FLIGHT_RAMPS.find((r) => r.ya !== r.yb)!;
    expect([a.x, a.z, b.x, b.z]).toEqual([597.3, -185.3, 603.5, -184.6]);
    expect(yb - ya).toBeCloseTo(7 * STEP_RISE, 6);
    // The foot stays on the square's terrain; the top climbs 0.76 of 1.12 m: the grid row 2.1 m off
    // the axis, beside the band, keeps the map's height and pulls the top down bilinearly.
    expect(Math.abs(game(a.x, a.z) - map(a.x, a.z))).toBeLessThanOrEqual(0.05);
    expect(game(b.x, b.z) - game(a.x, a.z)).toBeGreaterThan(0.7);
  });

  it("leaves the ground 2 m or more off a flight's band as the map has it, but in the building it climbs into", () => {
    const off = (x: number, z: number, r: (typeof FLIGHT_RAMPS)[number]) => {
      const [dx, dz] = [r.b.x - r.a.x, r.b.z - r.a.z];
      const t = Math.max(0, Math.min(1, ((x - r.a.x) * dx + (z - r.a.z) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - r.a.x - t * dx, z - r.a.z - t * dz) - r.width / 2;
    };
    let checked = 0;
    for (const r of FLIGHT_RAMPS) {
      for (let x = Math.min(r.a.x, r.b.x) - 12; x <= Math.max(r.a.x, r.b.x) + 12; x += 0.5) {
        for (let z = Math.min(r.a.z, r.b.z) - 12; z <= Math.max(r.a.z, r.b.z) + 12; z += 0.5) {
          if (FLIGHT_RAMPS.some((q) => off(x, z, q) < 2) || inBuilding(x, z)) continue;
          checked++;
          expect(Math.abs(game(x, z) - map(x, z)), `(${x.toFixed(1)}, ${z.toFixed(1)})`).toBeLessThanOrEqual(0.05);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("leaves every chunk's terrain a cell or more off a flight's band as the pads and the steps' ramps shape it on the import's grid (G-236 round 3)", () => {
    // A point of the finer grid is moved only within a band; bilinear, it moves the ground up to a cell's diagonal past it.
    const reach = (r: (typeof FLIGHT_RAMPS)[number]) => r.width / 2 + FLIGHT_CELL * Math.SQRT2 + 0.05;
    const near = (x: number, z: number) =>
      FLIGHT_RAMPS.some((r) => {
        const [dx, dz] = [r.b.x - r.a.x, r.b.z - r.a.z];
        const t = Math.max(0, Math.min(1, ((x - r.a.x) * dx + (z - r.a.z) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - r.a.x - t * dx, z - r.a.z - t * dz) < reach(r);
      });
    let worst = 0;
    for (const c of MAP_CHUNKS) {
      const before = shapeGrid(c.terrain, PADS, RAMPS);
      const after = SHAPED_TERRAIN.get(c.id)!;
      for (let x = c.bounds.minX; x <= c.bounds.maxX; x += 0.5) {
        for (let z = c.bounds.minZ; z <= c.bounds.maxZ; z += 0.5) {
          if (!near(x, z)) worst = Math.max(worst, Math.abs(terrainHeightAt(after, x, z) - terrainHeightAt(before, x, z)));
        }
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it("refines a grid by a whole factor without moving its surface", () => {
    const g = { originX: 0, originZ: 0, cell: 5, cols: 3, rows: 2, heights: [0, 1, 3, 2, -1, 4] };
    const fine = refineGrid(g, 2.5);
    expect([fine.cols, fine.rows, fine.cell]).toEqual([5, 3, 2.5]);
    for (const [x, z] of [[1.3, 0.7], [6.2, 4.9], [10, 5], [3.75, 2.5]] as const) expect(terrainHeightAt(fine, x, z)).toBeCloseTo(terrainHeightAt(g, x, z), 9);
    expect(refineGrid(g, 2)).toBe(g);
    expect(refineGrid(fine, 2.5)).toBe(fine);
  });
});
