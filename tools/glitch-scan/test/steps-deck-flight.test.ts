import { describe, expect, it } from "vitest";
import { planSteps } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { deckHeight } from "../../../packages/engine/src/renderer/mapcity/deck-plan";
import { chunkScenery } from "../../../packages/sim/src/content/lublin/city";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";

type Pt = { readonly x: number; readonly z: number };

/** Distance from the top of the polyline `line` (foot first) to the point of it nearest `p`, and how far off it `p` lies. */
const along = (line: readonly Pt[], p: Pt): { readonly s: number; readonly off: number } => {
  let best = { s: 0, off: Infinity };
  let s = 0;
  for (let i = line.length - 1; i > 0; i--) {
    const [a, b] = [line[i]!, line[i - 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len)));
    const off = Math.hypot(p.x - a.x - t * (b.x - a.x), p.z - a.z - t * (b.z - a.z));
    if (off < best.off) best = { s: s + t * len, off };
    s += len;
  }
  return best;
};

/** The treads (their middles' distance from the top and height) and risers' heights of the bands of map steps on the flight `id`, drawn on the game's ground. */
const flight = (id: string) => {
  const f = MAP_CHUNKS.flatMap((c) => c.flights ?? []).find((x) => x.id === id)!;
  const line: Pt[] = [];
  for (let i = 0; i + 1 < f.line.length; i += 2) line.push({ x: f.line[i]!, z: f.line[i + 1]! });
  const treads: { readonly s: number; readonly y: number; readonly at: string }[] = [];
  const risers: { readonly h: number; readonly at: string }[] = [];
  for (const c of MAP_CHUNKS) {
    for (const g of c.ground) {
      if (g.surface !== "steps") continue;
      const ring: Pt[] = [];
      for (let i = 0; i + 1 < g.outline.length; i += 2) ring.push({ x: g.outline[i]!, z: g.outline[i + 1]! });
      const mid = { x: ring.reduce((a, p) => a + p.x, 0) / ring.length, z: ring.reduce((a, p) => a + p.z, 0) / ring.length };
      if (along(line, mid).off > 1.5) continue;
      const sink = new MeshSink();
      planSteps(sink, ring, groundY);
      for (let v = 0; v < sink.vertexCount; v += 4) {
        const q = [0, 1, 2, 3].map((k) => ({ x: sink.positions[(v + k) * 3]!, y: sink.positions[(v + k) * 3 + 1]!, z: sink.positions[(v + k) * 3 + 2]! }));
        // A sliver's quads with no place (a band cut by a chunk's edge into a needle): nowhere on the flight.
        if (!q.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))) continue;
        const m = { x: q.reduce((a, p) => a + p.x, 0) / 4, z: q.reduce((a, p) => a + p.z, 0) / 4 };
        const at = `${c.id} (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`;
        if (Math.abs(sink.normals[v * 3 + 1]!) > 0.5) treads.push({ s: along(line, m).s, y: q[0]!.y, at });
        else risers.push({ h: Math.max(...q.map((p) => p.y)) - Math.min(...q.map((p) => p.y)), at });
      }
    }
  }
  return { treads, risers };
};

/** The tallest riser a flight may have, and how far a tread may lie over one nearer its top (m). */
const RISER = 0.3;

describe("the flight of steps down from the viaduct of Zamkowa (G-255)", () => {
  const { treads, risers } = flight("w56965515");

  it("goes down from the deck at −13.5 to the foot at −17.1", () => {
    expect(treads.length).toBeGreaterThan(20);
    const ys = treads.map((t) => t.y);
    expect(Math.max(...ys)).toBeGreaterThan(-13.6);
    expect(Math.max(...ys)).toBeLessThan(-13.3);
    expect(Math.min(...ys)).toBeGreaterThan(-17.25);
    expect(Math.min(...ys)).toBeLessThan(-16.9);
  });

  it("has no riser over 0.3 m", () => {
    expect(risers.filter((r) => r.h > RISER).map((r) => `${r.at} ${r.h.toFixed(2)} m`)).toEqual([]);
  });

  it("has no tread over one nearer its top by more than a riser: no hump, no slab left on the deck", () => {
    const up = treads.flatMap((t) => {
      const higher = treads.filter((u) => u.s < t.s - 0.5).reduce((m, u) => Math.min(m, u.y), Infinity);
      return t.y > higher + RISER ? [`${t.at} ${t.s.toFixed(1)} m down at ${t.y.toFixed(2)}, ${(t.y - higher).toFixed(2)} m over a tread above it`] : [];
    });
    expect(up).toEqual([]);
  });
});

describe("the run of that flight off the viaduct as the renderer lays it (G-255)", () => {
  const f = MAP_CHUNKS.flatMap((c) => c.flights ?? []).find((x) => x.id === "w56965515")!;
  const line: Pt[] = [];
  for (let i = 0; i + 1 < f.line.length; i += 2) line.push({ x: f.line[i]!, z: f.line[i + 1]! });
  // The run from the bend (729.5, 159.9) up to where the flight leaves the deck (734.1, 163.9): 4.0 to 10.1 m from the top.
  const [from, to] = [Math.hypot(line[3]!.x - line[2]!.x, line[3]!.z - line[2]!.z), Math.hypot(line[3]!.x - line[2]!.x, line[3]!.z - line[2]!.z) + Math.hypot(line[2]!.x - line[1]!.x, line[2]!.z - line[1]!.z)];
  const views = MAP_CHUNKS.flatMap((c) => chunkScenery(c, []).flatMap((s) => (s.view.kind === "ground" && s.view.surface === "steps" ? [s.view] : [])));
  const onRun = views.filter((v) => {
    const at = along(line, { x: v.outline.reduce((a, p) => a + p.x, 0) / v.outline.length, z: v.outline.reduce((a, p) => a + p.z, 0) / v.outline.length });
    return at.off < 1.5 && at.s > from && at.s < to;
  });

  it("lays each band of the run on the grade from the deck's height down to the terrain at the bend", () => {
    expect(onRun.length).toBe(3);
    for (const v of onRun) {
      const d = v.deck;
      expect(d, JSON.stringify(v.outline)).toBeDefined();
      if (!d) continue;
      expect(d.b.y).toBeCloseTo(-13.53, 1);
      expect(d.a.y).toBeCloseTo(-15.32, 1);
      const sink = new MeshSink();
      planSteps(sink, v.outline, (x, z) => deckHeight(d, x, z));
      const ys: number[] = [];
      for (let k = 0; k < sink.vertexCount; k++) if (Number.isFinite(sink.positions[k * 3]!)) ys.push(sink.positions[k * 3 + 1]!);
      expect(Math.max(...ys)).toBeLessThan(-13.4);
      expect(Math.min(...ys)).toBeGreaterThan(-15.45);
    }
  });
});
