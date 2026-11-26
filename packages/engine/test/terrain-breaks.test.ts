import type { TerrainGrid } from "@seki/core";
import { terrainHeightAt } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { DRAPE_GRID, type HeightAt, drape, planTerrain } from "../src/renderer/mapcity/ground-plan";
import { FACE_INSET, drapeBreaks } from "../src/renderer/mapcity/terrain-breaks";

// A terrace 2 m over a street, the wall's line slanting across the grid's cells (G-971).
const line = [{ x: -1, z: 3.6 }, { x: 11, z: 6.1 }];
const sd = (p: { x: number; z: number }) => {
  const [dx, dz] = [line[1]!.x - line[0]!.x, line[1]!.z - line[0]!.z];
  return (dx * (p.z - line[0]!.z) - dz * (p.x - line[0]!.x)) / Math.hypot(dx, dz);
};
const cols = 9;
const heights = Array.from({ length: cols * cols }, (_, i) => (sd({ x: (i % cols) * 1.25, z: Math.floor(i / cols) * 1.25 }) >= 0 ? 2 : 0));
const plain: TerrainGrid = { originX: 0, originZ: 0, cell: 1.25, cols, rows: cols, heights };
const broken: TerrainGrid = { ...plain, breaks: [line] };

/** The triangles of a sink whose middle is beside the wall, off its faces, with their highest and lowest vertex. */
const beside = (sink: MeshSink) => {
  const out: { side: number; min: number; max: number }[] = [];
  const p = sink.positions;
  for (let t = 0; t < sink.indices.length; t += 3) {
    const v = [0, 1, 2].map((k) => sink.indices[t + k]! * 3).map((i) => ({ x: p[i]!, y: p[i + 1]!, z: p[i + 2]! }));
    const mid = { x: (v[0]!.x + v[1]!.x + v[2]!.x) / 3, z: (v[0]!.z + v[1]!.z + v[2]!.z) / 3 };
    if (mid.x < 0.5 || mid.x > 9.5 || mid.z < 0.5 || mid.z > 9.5 || Math.abs(sd(mid)) < FACE_INSET + 0.01) continue;
    out.push({ side: Math.sign(sd(mid)), min: Math.min(...v.map((q) => q.y)), max: Math.max(...v.map((q) => q.y)) });
  }
  return out;
};
/** Is each part beside the wall flat at its side's level? */
const flat = (parts: ReturnType<typeof beside>, lift = 0) => parts.every((t) => Math.abs(t.min - lift - (t.side > 0 ? 2 : 0)) < 1e-6 && Math.abs(t.max - lift - (t.side > 0 ? 2 : 0)) < 1e-6);

describe("the terrain and its paving cut at a breakline's wall (G-971)", () => {
  it("draws the terrain flat on either side up to the wall's faces, the step under the wall", () => {
    const before = new MeshSink();
    planTerrain(before, plain);
    // Without the line the cells it crosses slope from the street to the terrace.
    expect(flat(beside(before))).toBe(false);
    const after = new MeshSink();
    planTerrain(after, broken);
    expect(beside(after).length).toBeGreaterThan(100);
    expect(flat(beside(after))).toBe(true);
  });

  it("lays a square over the wall flat on either side too, in the drape's cells the line crosses", () => {
    const ring = [{ x: 0.3, z: 0.3 }, { x: 9.7, z: 0.3 }, { x: 9.7, z: 9.7 }, { x: 0.3, z: 9.7 }];
    const h = Object.assign((x: number, z: number) => terrainHeightAt(broken, x, z), { breaks: drapeBreaks([broken], DRAPE_GRID) }) as HeightAt;
    const sink = new MeshSink();
    drape(sink, ring, h, 0.08, [1, 1, 1, 1], (p) => [p.x, p.z], [0, 0]);
    expect(beside(sink).length).toBeGreaterThan(20);
    expect(flat(beside(sink), 0.08)).toBe(true);
    const smeared = new MeshSink();
    drape(smeared, ring, (x, z) => terrainHeightAt(broken, x, z), 0.08, [1, 1, 1, 1], (p) => [p.x, p.z], [0, 0]);
    expect(flat(beside(smeared), 0.08)).toBe(false);
  });
});
