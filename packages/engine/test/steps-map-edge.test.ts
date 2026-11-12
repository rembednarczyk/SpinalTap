import { LUBLIN_CHUNKS, groundView } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf, cleanRing } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * Steps the map's edge cuts (G-703), laid the way the map city lays them: every chunk's terrain
 * in `MapEntries`, the band through `planGround`. A riser of a band at the edge went down to the
 * ground past it, 0 off every chunk: a wall of up to 23.7 m. The cut has to be told by the
 * terrains the renderer holds, which answer for a hair past their bounds.
 */

/** Stare Miasto's east edge (x = 760), Podzamcze's south edge (z = 160), Nabrzeże's north edge (z = 60). */
const EDGES = [
  { chunk: "stare-miasto-1-0", on: (p: P2) => p.x === 760 },
  { chunk: "podzamcze-2-0", on: (p: P2) => p.z === 160 },
  { chunk: "nabrzeze-1-0", on: (p: P2) => p.z === 60 },
];

const city = (): MapEntries => {
  const e = new MapEntries();
  let id = 1;
  for (const c of LUBLIN_CHUNKS) {
    const g = c.terrain;
    e.terrains.set(id++, { grid: g, open: undefined, bounds: { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell }, mesh: null });
  }
  return e;
};

/** The tallest side face of a sink's quads (m): a riser, or the wall a riser became. */
const tallestSide = (s: MeshSink): number => {
  let tallest = 0;
  for (let q = 0; q + 3 < s.vertexCount; q += 4) {
    if (Math.abs(s.normals[q * 3 + 1] ?? 0) > 0.5) continue;
    const ys = [0, 1, 2, 3].map((k) => s.positions[(q + k) * 3 + 1] ?? 0);
    tallest = Math.max(tallest, Math.max(...ys) - Math.min(...ys));
  }
  return tallest;
};

describe("steps cut by the map's edge, laid by the map city (G-703)", () => {
  const e = city();
  let id = 1_000_000;
  it.each(EDGES)("end on the ground at the edge of $chunk, with no wall down past it", ({ chunk, on }) => {
    const c = LUBLIN_CHUNKS.find((k) => k.id === chunk);
    if (!c) throw new Error(chunk);
    const cut: number[] = [];
    for (const g of c.ground) {
      if (g.surface !== "steps") continue;
      const view = groundView(g);
      if (view.kind !== "ground") continue;
      const ring = cleanRing(view.outline.map((p) => ({ x: p.x, z: p.z })));
      if (ring.length < 3 || !ring.some(on)) continue;
      e.addGround(++id, { surface: "steps", ring, y: 0, bounds: boundsOf(ring), cell: "" });
      cut.push(id);
    }
    expect(cut.length).toBeGreaterThan(0);
    for (const at of cut) {
      const ground = new MeshSink();
      planGround(ground, new MeshSink(), e, at);
      expect(ground.vertexCount).toBeGreaterThan(0);
      expect(tallestSide(ground)).toBeLessThan(0.5);
      let low = Infinity;
      for (let v = 0; v < ground.vertexCount; v++) low = Math.min(low, ground.positions[v * 3 + 1] ?? 0);
      expect(low).toBeLessThan(-1);
    }
  });
});
