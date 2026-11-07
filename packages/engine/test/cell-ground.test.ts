import { describe, expect, it } from "vitest";
import type { GroundSurface } from "@seki/core";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { SURFACE_CODE } from "../src/renderer/mapcity/ground-plan";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * One paving where pieces of one lift overlap (G-320): the cell builder lays only the one drawn
 * over the other there, so the depth buffer never has two of one depth to flicker between.
 */

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

/** A sloping grid of 2.5 m under the pieces, so the drape bends. */
const world = (pieces: readonly { surface: GroundSurface; ring: P2[]; deck?: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } } }[]): MapEntries => {
  const e = new MapEntries();
  const heights: number[] = [];
  for (let k = 0; k < 25; k++) for (let i = 0; i < 25; i++) heights.push(0.05 * i + 0.02 * k + 0.1 * Math.sin(i * 0.7) * Math.cos(k * 0.5));
  e.terrains.set(1, { grid: { originX: -10, originZ: -10, cell: 2.5, cols: 25, rows: 25, heights }, open: undefined, bounds: { minX: -10, maxX: 50, minZ: -10, maxZ: 50 }, mesh: null });
  pieces.forEach((p, i) => e.addGround(100 + i, { surface: p.surface, ring: p.ring, y: 0, bounds: boundsOf(p.ring), cell: "", ...(p.deck ? { deck: p.deck } : {}) }));
  return e;
};

/** The codes of the pieces whose own surface is drawn over (x, z) (not a deck's edges or underside), read off each piece's sink. */
const drawnAt = (e: MapEntries, x: number, z: number): number[] => {
  const out: number[] = [];
  for (const [id, g] of e.grounds) {
    const code = SURFACE_CODE[g.surface as keyof typeof SURFACE_CODE];
    const sink = new MeshSink();
    planGround(sink, new MeshSink(), e, id);
    const p = sink.positions;
    for (let t = 0; t + 2 < sink.indices.length; t += 3) {
      const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!].map((i) => ({ x: p[i * 3]!, z: p[i * 3 + 2]!, code: Math.round(sink.uvs2[i * 2]!) }));
      const d = (b!.z - c!.z) * (a!.x - c!.x) + (c!.x - b!.x) * (a!.z - c!.z);
      if (Math.abs(d) < 1e-9 || a!.code !== code) continue;
      const wa = ((b!.z - c!.z) * (x - c!.x) + (c!.x - b!.x) * (z - c!.z)) / d;
      const wb = ((c!.z - a!.z) * (x - c!.x) + (a!.x - c!.x) * (z - c!.z)) / d;
      if (wa < -1e-9 || wb < -1e-9 || wa + wb > 1 + 1e-9) continue;
      out.push(a!.code);
      break;
    }
  }
  return out;
};

describe("one paving where pieces of one lift overlap (G-320)", () => {
  it("lays a cobbled way over a square it crosses, and the square round it", () => {
    const e = world([
      { surface: "square", ring: rect(0, 0, 30, 30) },
      { surface: "cobble", ring: rect(10, -5, 16, 40) },
    ]);
    expect(drawnAt(e, 13.3, 12.7)).toEqual([SURFACE_CODE.cobble]);
    expect(drawnAt(e, 5.3, 12.7)).toEqual([SURFACE_CODE.square]);
    expect(drawnAt(e, 13.3, 35.1)).toEqual([SURFACE_CODE.cobble]);
  });

  it("lays the smaller of two squares over the larger, one of them wherever both lie", () => {
    const e = world([
      { surface: "square", ring: rect(0, 0, 30, 30) },
      { surface: "square", ring: [{ x: 7.3, z: 4.1 }, { x: 21.7, z: 6.3 }, { x: 18.2, z: 19.4 }, { x: 5.1, z: 16.9 }] },
    ]);
    for (let x = 0.31; x < 30; x += 1.13) for (let z = 0.2718; z < 30; z += 1.0707) expect(drawnAt(e, x, z), `${x}, ${z}`).toHaveLength(1);
  });

  it("cuts nothing out of pieces of other lifts, or out of a way under a bridge's deck", () => {
    const footway = world([
      { surface: "square", ring: rect(0, 0, 30, 30) },
      { surface: "footway", ring: rect(10, 10, 16, 16) },
    ]);
    expect(drawnAt(footway, 13.3, 12.7).sort()).toEqual([SURFACE_CODE.square, SURFACE_CODE.footway].sort());
    const bridge = world([
      { surface: "road", ring: rect(0, 10, 30, 16) },
      { surface: "road", ring: rect(12, 0, 15, 30), deck: { a: { x: 13.5, y: 6, z: -2 }, b: { x: 13.5, y: 6, z: 32 } } },
    ]);
    expect(drawnAt(bridge, 13.3, 12.7)).toEqual([SURFACE_CODE.road, SURFACE_CODE.road]);
  });
});
