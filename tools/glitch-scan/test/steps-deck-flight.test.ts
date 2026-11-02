import { describe, expect, it } from "vitest";
import { riserOf, stepFaces } from "./steps-faces";
import { deckHeight } from "../../../packages/engine/src/renderer/mapcity/deck-plan";
import { chunkScenery } from "../../../packages/sim/src/content/lublin/city";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { bridgeDeckAt } from "../../../packages/sim/src/content/lublin/decks";

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
      for (const face of stepFaces(ring, groundY)) {
        const q = face.corners;
        const m = { x: (q[0].x + q[1].x + q[2].x) / 3, z: (q[0].z + q[1].z + q[2].z) / 3 };
        const at = `${c.id} (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`;
        // A tread in the viaduct's outline is on its sidewalk, drawn there (G-274), not on the flight.
        if (face.up && bridgeDeckAt(m.x, m.z) === null) treads.push({ s: along(line, m).s, y: Math.max(q[0].y, q[1].y, q[2].y), at });
        else risers.push({ h: riserOf(face).h, at });
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
    expect(Math.min(...ys)).toBeLessThan(-16.8);
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

describe("that flight off the viaduct as the renderer lays it (G-255)", () => {
  const f = MAP_CHUNKS.flatMap((c) => c.flights ?? []).find((x) => x.id === "w56965515")!;
  const line: Pt[] = [];
  for (let i = 0; i + 1 < f.line.length; i += 2) line.push({ x: f.line[i]!, z: f.line[i + 1]! });
  // Off the deck: from where the flight leaves it (734.1, 163.9), 4.0 m from the top, down to the foot.
  const from = Math.hypot(line[3]!.x - line[2]!.x, line[3]!.z - line[2]!.z);
  const views = MAP_CHUNKS.flatMap((c) => chunkScenery(c, []).flatMap((s) => (s.view.kind === "ground" && s.view.surface === "steps" ? [s.view] : [])));
  // A band in the viaduct's outline is on its sidewalk (G-274), laid on its deck as on main.
  const off = views.filter((v) => {
    const mid = { x: v.outline.reduce((a, p) => a + p.x, 0) / v.outline.length, z: v.outline.reduce((a, p) => a + p.z, 0) / v.outline.length };
    const at = along(line, mid);
    return at.off < 1.5 && at.s > from + 0.1 && bridgeDeckAt(mid.x, mid.z) === null;
  });

  it("lays every band off the deck on the flight's grade, as the simulation walks it, from −13.5 down to −17.1", () => {
    expect(off.length).toBeGreaterThanOrEqual(4);
    for (const v of off) {
      const d = v.deck;
      expect(d, JSON.stringify(v.outline)).toBeDefined();
      if (!d) continue;
      for (const face of stepFaces(v.outline, (x, z) => deckHeight(d, x, z))) {
        for (const p of face.corners) {
          expect(p.y).toBeLessThan(-13.4);
          expect(p.y).toBeGreaterThan(-17.2);
        }
        // The treads the renderer lays are those of the ground the simulation walks, within a
        // riser at a tread's middle (a tread is level at its higher end).
        const [a, b, c] = face.corners;
        const m = { x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3 };
        // Off the viaduct's outline, where its slab hides the treads under it (G-274).
        if (face.up && bridgeDeckAt(m.x, m.z) === null) expect(Math.abs(a.y - 0.05 - groundY(m.x, m.z)), `${m.x}, ${m.z}`).toBeLessThan(RISER);
      }
    }
  });
});
