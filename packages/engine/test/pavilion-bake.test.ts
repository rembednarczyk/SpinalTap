import { describe, expect, it } from "vitest";
import { METRO_ENTRANCES, WORLD_SCENERY } from "@seki/sim";
import { cellBounds, cellKey } from "../src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../src/renderer/mapcity/prop-shapes";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { DRESS_FLAG, MeshSink } from "../src/renderer/mesh-sink";
import { bakePavilion, bakePavilionFar, pavilionsIn } from "../src/renderer/metro/pavilion-bake";
import { LINE_AMBER, PYLON } from "../src/renderer/metro/pavilion-dress";
import { pavilionRoofOver } from "../src/renderer/metro/pavilion-roof";
import { pavilionTitle, planPavilionSigns } from "../src/renderer/metro/pavilion-signs";

/** ADR-0071: up to 2 thousand triangles an entrance, baked into meshes the city already draws. */
const BUDGET = 2000;

const ENTRANCES = METRO_ENTRANCES.map((e) => [`${e.station} ${e.label}`, e] as const);

const vertices = (sink: MeshSink): { x: number; y: number; z: number; rgba: number[]; meta: number[] }[] =>
  Array.from({ length: sink.vertexCount }, (_, i) => ({
    x: sink.positions[i * 3]!,
    y: sink.positions[i * 3 + 1]!,
    z: sink.positions[i * 3 + 2]!,
    rgba: sink.colors.slice(i * 4, i * 4 + 4),
    meta: sink.uvs2.slice(i * 2, i * 2 + 2),
  }));

const amber = (rgba: readonly number[]): boolean => {
  const n = parseInt(LINE_AMBER.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].every((c, i) => Math.abs(rgba[i]! - c / 255) < 1e-6);
};

/**
 * Pairs of a pavilion's upright faces of different colours lying in one plane and overlapping:
 * they flicker against each other (z-fighting). Faces on a horizontal plane are left out: the
 * only ones that meet are the frames' and the panes' tops, hidden under the roof's slab.
 */
const flushUprights = (sink: MeshSink): string[] => {
  type Tri = { lo: [number, number]; hi: [number, number]; color: string };
  const planes = new Map<string, Tri[]>();
  const at = (i: number): [number, number, number] => [sink.positions[i * 3]!, sink.positions[i * 3 + 1]!, sink.positions[i * 3 + 2]!];
  for (let t = 0; t < sink.indices.length / 3; t++) {
    const ids = [0, 1, 2].map((k) => sink.indices[t * 3 + k]!);
    const [a, b, c] = ids.map(at) as [[number, number, number], [number, number, number], [number, number, number]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const len = Math.hypot(...n);
    if (len < 1e-9 || Math.abs(n[1]! / len) > 0.5) continue;
    const [nx, nz] = [n[0]! / len, n[2]! / len];
    // Along the plane: the horizontal tangent and the height.
    const coords = [a, b, c].map((p): [number, number] => [p[0] * nz - p[2] * nx, p[1]]);
    const key = `${nx.toFixed(3)},${nz.toFixed(3)}|${(nx * a[0] + nz * a[2]).toFixed(3)}`;
    const tri: Tri = {
      lo: [Math.min(...coords.map((q) => q[0])), Math.min(...coords.map((q) => q[1]))],
      hi: [Math.max(...coords.map((q) => q[0])), Math.max(...coords.map((q) => q[1]))],
      color: sink.colors.slice(ids[0]! * 4, ids[0]! * 4 + 3).map((x) => x.toFixed(3)).join(","),
    };
    planes.set(key, [...(planes.get(key) ?? []), tri]);
  }
  const found: string[] = [];
  for (const [key, tris] of planes) {
    for (let i = 0; i < tris.length; i++) {
      for (let j = i + 1; j < tris.length; j++) {
        const [p, q] = [tris[i]!, tris[j]!];
        if (p.color === q.color) continue;
        const across = Math.min(p.hi[0], q.hi[0]) - Math.max(p.lo[0], q.lo[0]);
        const up = Math.min(p.hi[1], q.hi[1]) - Math.max(p.lo[1], q.lo[1]);
        if (across > 0.01 && up > 0.01) found.push(`${key}: ${p.color} and ${q.color}`);
      }
    }
  }
  return found;
};

describe("the metro's pavilions in the furniture's blocks (ADR-0071 stages 2 and 3)", () => {
  it("bakes each one under its budget of triangles, near and far", () => {
    for (const e of METRO_ENTRANCES) {
      const near = new MeshSink();
      bakePavilion(near, e);
      const far = new MeshSink();
      bakePavilionFar(far, e);
      expect(near.indices.length / 3, `${e.station} ${e.label}`).toBeLessThan(BUDGET);
      expect(near.indices.length / 3).toBeGreaterThan(300);
      expect(far.indices.length / 3).toBeLessThanOrEqual(24);
    }
  });

  it("puts each one in exactly one block, a block that has furniture of its own (so the block's meshes exist)", () => {
    const furniture = WORLD_SCENERY.flatMap((s) => (s.view.kind === "street-props" ? s.view.items : []));
    for (const e of METRO_ENTRANCES) {
      const key = cellKey(e.spot.x, e.spot.z, PROP_BLOCK);
      const bounds = cellBounds(key, PROP_BLOCK);
      expect(pavilionsIn(bounds)).toContain(e);
      expect(furniture.some((p) => cellKey(p.x, p.z, PROP_BLOCK) === key), `${e.station} ${e.label}`).toBe(true);
    }
  });

  it("draws the stairs down to the hall's floor and the pylon's cube up to 4.2 m over the street", () => {
    const e = METRO_ENTRANCES[0]!;
    const sink = new MeshSink();
    bakePavilion(sink, e);
    const ys = sink.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(e.floor - 0.3, 5);
    expect(Math.max(...ys)).toBeCloseTo(e.street + PYLON.height, 5);
  });

  it.each(ENTRANCES)("%s: an amber lit M on each face of the pylon's cube, over the roof", (_n, e) => {
    const sink = new MeshSink();
    bakePavilion(sink, e);
    const m = vertices(sink).filter((v) => v.rgba[3] === DRESS_FLAG.lit && amber(v.rgba) && v.y > e.street + PYLON.height - PYLON.cube);
    // Four strokes on each of four faces, a stroke a box of 24 corners.
    expect(m.length).toBe(4 * 4 * 24);
    for (const v of m) expect(v.y).toBeLessThan(e.street + PYLON.height);
  });

  it.each(ENTRANCES)("%s: no upright face of the frames shares a plane with the glass (no flicker)", (_n, e) => {
    const sink = new MeshSink();
    bakePavilion(sink, e);
    expect(flushUprights(sink)).toEqual([]);
  });

  it("leaves the reflections off the glass on the phone (ADR-0071)", () => {
    const e = METRO_ENTRANCES[0]!;
    const wet = (q: "low" | "high") => {
      const sink = new MeshSink();
      bakePavilion(sink, e, q);
      return vertices(sink).filter((v) => v.rgba[3] === DRESS_FLAG.wet).length;
    };
    expect(wet("high")).toBeGreaterThan(0);
    expect(wet("low")).toBe(0);
  });
});

describe("the metro pavilions' names in the signs' mesh (ADR-0071 stage 3)", () => {
  it("read the station and the entrance, once where they are the same", () => {
    const by = (station: string, label: string) => pavilionTitle(METRO_ENTRANCES.find((e) => e.station === station && e.label === label)!);
    expect(by("shinsekai", "A")).toBe("PLAC LITEWSKI");
    expect(by("kanal", "B")).toBe("BRAMA KRAKOWSKA · ALCHEMIA");
    expect(by("targ", "B")).toBe("PLAC ZAMKOWY · DWORZEC AUTOBUSOWY");
  });

  it.each(ENTRANCES)("%s: letters on the fascias and the pylon's plate, inside the roof's outline", (_n, e) => {
    const sink = new MeshSink();
    expect(planPavilionSigns(sink, { minX: e.spot.x - 1, maxX: e.spot.x + 1, minZ: e.spot.z - 1, maxZ: e.spot.z + 1 })).toBe(1);
    const vs = vertices(sink);
    expect(vs.every((v) => Math.round(v.meta[1]!) === MAP_SIGN_KIND.glyph)).toBe(true);
    const r = e.roof;
    for (const v of vs) {
      expect(v.x).toBeGreaterThan(r.minX - 0.05);
      expect(v.x).toBeLessThan(r.maxX + 0.05);
      expect(v.z).toBeGreaterThan(r.minZ - 0.05);
      expect(v.z).toBeLessThan(r.maxZ + 0.05);
    }
    // Every letter on each fascia not against a wall, and the entrance's letter on the plate.
    const letters = [...pavilionTitle(e)].filter((c) => c !== " ").length;
    const faces = e.spot.wall ? 1 : 2;
    expect(vs.length).toBe((letters * faces + 1) * 4);
  });

  it("plan nothing for a cell without a pavilion", () => {
    const sink = new MeshSink();
    expect(planPavilionSigns(sink, { minX: 0, maxX: 10, minZ: 0, maxZ: 10 })).toBe(0);
    expect(sink.empty).toBe(true);
  });
});

describe("the rain under the pavilions' roofs (G-331)", () => {
  it.each(ENTRANCES)("%s: stops under the eaves, on the stairs and in the hall, not beside or over the roof", (_n, e) => {
    const r = e.roof;
    const o = e.outline;
    const mid = { x: (o.minX + o.maxX) / 2, z: (o.minZ + o.maxZ) / 2 };
    expect(pavilionRoofOver(mid.x, e.floor + 1, mid.z)).toBe(true);
    expect(pavilionRoofOver(mid.x, e.street + 1, mid.z)).toBe(true);
    expect(pavilionRoofOver(r.minX + 0.1, e.street + 2, r.minZ + 0.1)).toBe(true);
    expect(pavilionRoofOver(mid.x, e.street + 3.4, mid.z)).toBe(false);
    expect(pavilionRoofOver(r.maxX + 0.2, e.street + 1, mid.z)).toBe(false);
    expect(pavilionRoofOver(mid.x, e.street + 1, r.minZ - 0.2)).toBe(false);
  });
});
