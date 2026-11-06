import { describe, expect, it } from "vitest";
import { ALCHEMIA_LIFT, ALCHEMIA_TERRACE, WORLD_SCENERY } from "@seki/sim";
import { alchemiaLiftIn, bakeAlchemiaLift, bakeAlchemiaLiftFar, bakeButtonRims } from "../src/renderer/alchemia/lift-bake";
import { cellBounds, cellKey } from "../src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../src/renderer/mapcity/prop-shapes";
import { DRESS_FLAG, MeshSink } from "../src/renderer/mesh-sink";

/**
 * The lift of Alchemia drawn (G-284, G-289): baked into a block of the street furniture the city
 * already draws (no draw call or mesh of its own), within its own outline, its screens drawn up to
 * the tops the simulation makes solid (no invisible wall over them), lit neon, the panes of the
 * shaft facing out.
 */

const L = ALCHEMIA_LIFT;
const out = L.half + L.wall;

const verts = (sink: MeshSink) =>
  Array.from({ length: sink.vertexCount }, (_, i) => ({
    x: sink.positions[3 * i]!,
    y: sink.positions[3 * i + 1]!,
    z: sink.positions[3 * i + 2]!,
    nx: sink.normals[3 * i]!,
    nz: sink.normals[3 * i + 2]!,
    alpha: sink.colors[4 * i + 3]!,
  }));

const baked = (quality: "high" | "low" = "high") => {
  const sink = new MeshSink();
  bakeAlchemiaLift(sink, quality);
  return sink;
};

describe("the lift of Alchemia drawn (G-284, G-289)", () => {
  it("bakes into exactly one block of the street furniture, a block with furniture of its own", () => {
    const furniture = WORLD_SCENERY.flatMap((s) => (s.view.kind === "street-props" ? s.view.items : []));
    const key = cellKey(L.centre.x, L.centre.z, PROP_BLOCK);
    expect(alchemiaLiftIn(cellBounds(key, PROP_BLOCK))).toBe(true);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const [ix, iz] = key.split(":").map(Number) as [number, number];
      expect(alchemiaLiftIn(cellBounds(`${ix + dx}:${iz + dz}`, PROP_BLOCK))).toBe(false);
    }
    expect(furniture.some((p) => cellKey(p.x, p.z, PROP_BLOCK) === key)).toBe(true);
  });

  it("stays within the shaft, the bridge and the roof terrace, from the shaft's foot to its cap, in a few thousand triangles", () => {
    const sink = baked();
    const c = ALCHEMIA_TERRACE.corners;
    const xs = [L.centre.x - out, L.centre.x + out, ...c.map((q) => q.x)];
    const zs = [L.centre.z - out, L.centre.z + out + 0.7, ...c.map((q) => q.z)];
    for (const v of verts(sink)) {
      expect(v.x).toBeGreaterThan(Math.min(...xs) - 0.2);
      expect(v.x).toBeLessThan(Math.max(...xs) + 0.2);
      expect(v.z).toBeGreaterThan(Math.min(...zs) - 0.2);
      expect(v.z).toBeLessThan(Math.max(...zs) + 0.2);
      expect(v.y).toBeGreaterThanOrEqual(L.base - 1e-6);
      expect(v.y).toBeLessThanOrEqual(L.cap + 1e-6);
    }
    expect(sink.indices.length / 3).toBeLessThan(4000);
    const far = new MeshSink();
    bakeAlchemiaLiftFar(far);
    expect(far.indices.length / 3).toBeLessThanOrEqual(24);
  });

  it("draws every screen up to the top its solid has, and lights its wires and the shaft's neon", () => {
    const vs = verts(baked());
    const off = (v: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((v.x - a.x) * dx + (v.z - a.z) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(v.x - a.x - t * dx, v.z - a.z - t * dz);
    };
    for (const s of L.screens) {
      const near = vs.filter((v) => off(v, s.a, s.b) < 0.06);
      expect(Math.max(...near.map((v) => v.y)), `${s.a.x},${s.a.z}`).toBeCloseTo(s.top, 5);
      expect(near.some((v) => v.alpha === DRESS_FLAG.lit && v.y > L.levels[1] + 1.2)).toBe(true);
    }
    expect(vs.filter((v) => v.alpha === DRESS_FLAG.lit).length).toBeGreaterThan(100);
  });

  it("faces the shaft's panes out, so the city is in view from the cage, and leaves the wet glass off the phones", () => {
    const sink = baked();
    const vs = verts(sink);
    // The panes are the quads on the shaft's outer faces (under the bridge, where no screen stands): each one's normal points away from the middle.
    const panes = vs.filter((v) => v.alpha === DRESS_FLAG.wet && v.y < L.levels[1] - 0.5 && Math.max(Math.abs(v.x - L.centre.x), Math.abs(v.z - L.centre.z)) > out - 1e-6 && Math.max(Math.abs(v.x - L.centre.x), Math.abs(v.z - L.centre.z)) < out + 1e-6);
    expect(panes.length).toBeGreaterThanOrEqual(8);
    for (const v of panes) expect(v.nx * (v.x - L.centre.x) + v.nz * (v.z - L.centre.z)).toBeGreaterThan(0);
    expect(verts(baked("low")).some((v) => v.alpha === DRESS_FLAG.wet)).toBe(false);
  });

  it("lights a cyan rim round each call button, on the face it hangs on, in front of that face and behind the button", () => {
    const west = L.centre.x - out;
    const rims = new MeshSink();
    bakeButtonRims(rims, L);
    expect(rims.vertexCount).toBe(24 * L.buttons.length);
    for (const b of L.buttons) {
      const vs = verts(rims).filter((v) => Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) < 0.5);
      expect(vs).toHaveLength(24);
      expect(vs.every((v) => v.alpha === DRESS_FLAG.lit)).toBe(true);
      // Wider and taller than the button (0.22 x 0.32), round its middle.
      const zs = vs.map((v) => v.z - b.z);
      const ys = vs.map((v) => v.y - b.y);
      expect(Math.min(...zs)).toBeLessThan(-0.11 - 0.03);
      expect(Math.max(...ys)).toBeGreaterThan(0.16 + 0.03);
      // Between the face (the shaft's west wall, or the bridge's west screen) and the button's middle.
      const face = b.x < west ? west : b.x - 0.11;
      for (const v of vs) expect(Math.abs(v.x - face)).toBeLessThanOrEqual(0.02 + 1e-6);
      for (const v of vs) expect(Math.abs(v.x - face)).toBeLessThan(Math.abs(b.x - face));
    }
    // And in the lift's bake.
    const all = verts(baked());
    for (const b of L.buttons) expect(all.some((v) => v.alpha === DRESS_FLAG.lit && Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) < 0.4)).toBe(true);
  });
});
