import { type SceneryItem, WORLD_SCENERY, groundY } from "@seki/sim";
import { LUBLIN_CHUNKS, type LublinBuildingData } from "@seki/sim/lublin";
import { MeshSink, hexColor } from "../src/renderer/mesh-sink";
import { type FacadeFrame, type Wall, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { type LandmarkFrame, landmarkAt, planNearLandmark, withLandmark } from "../src/renderer/mapcity/landmarks";
import { SWATCH, onWall } from "../src/renderer/mapcity/landmarks/kit";
import { litMouths } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { mapBuilding } from "../src/renderer/mapcity/map-building";
import type { MapView } from "../src/renderer/mapcity/map-city";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";

/** The map data, the scenery and the landmark frames the landmark kit's tests (ADR-0062) draw from. */

export const data = (id: string): LublinBuildingData => LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;

/** The views the simulation hands the renderer: the scenery of the map buildings, passages included. */
export const scenery = (b: LublinBuildingData): SceneryItem & { view: MapView } => {
  const s = WORLD_SCENERY.find((i) => i.view.kind === "building" && Math.abs(i.at.x - b.x) < 1e-6 && Math.abs(i.at.z - b.z) < 1e-6 && i.view.outline.length === b.outline.length / 2);
  return s as SceneryItem & { view: MapView };
};

export const ringOf = (s: SceneryItem): P2[] => (s.view.kind === "building" ? cleanRing(s.view.outline.map((p) => ({ x: p.x + s.at.x, z: p.z + s.at.z }))) : []);

/** Every building of the data within 40 m of (x, z) with its scenery, and the facade frames of them, plain or as a landmark's. */
export const cityAround = (x: number, z: number) => {
  const near = LUBLIN_CHUNKS.flatMap((c) => c.buildings).filter((b) => Math.hypot(b.x - x, b.z - z) < 40);
  const items = near.map((b, i) => ({ id: i + 1, b, s: scenery(b) })).filter((e) => e.s);
  const neighbour = (px: number, pz: number, self: number): number | null => {
    let top: number | null = null;
    for (const e of items) if (e.id !== self && pointInRing({ x: px, z: pz }, ringOf(e.s))) top = Math.max(top ?? -Infinity, e.s.at.y + (e.s.view.kind === "building" ? e.s.view.height : 0));
    return top;
  };
  const frameOf = (id: string, recipe = true): FacadeFrame => {
    const e = items.find((i) => i.b.id === id)!;
    const view = e.s.view as Extract<MapView, { kind: "building" }>;
    const f = facadeFrame(mapBuilding(e.id, { ring: ringOf(e.s), view, at: e.s.at }, groundY), neighbour);
    return recipe ? withLandmark(f, landmarkAt(e.s.at.x, e.s.at.z, view.outline.length)) : f;
  };
  return { near, items, frameOf };
};

export const near3 = (f: FacadeFrame): MeshSink => {
  const sink = new MeshSink();
  planNearLandmark(sink, f as LandmarkFrame);
  return sink;
};

export const points = (sink: MeshSink) => Array.from({ length: sink.vertexCount }, (_, i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]!, u2: sink.uvs2[i * 2]!, v2: sink.uvs2[i * 2 + 1]!, a: sink.colors[i * 4 + 3]! }));

/** The points of the sink in a swatch's colour. */
export const colored = (sink: MeshSink, hex: string) => {
  const [r, g, b] = hexColor(hex);
  return points(sink).filter((_, i) => Math.abs(sink.colors[i * 4]! - r) < 1e-4 && Math.abs(sink.colors[i * 4 + 1]! - g) < 1e-4 && Math.abs(sink.colors[i * 4 + 2]! - b) < 1e-4);
};

/** Distance from a point outside the ring to its nearest edge (0 inside). */
export const outside = (r: readonly P2[], p: P2): number => {
  if (pointInRing(p, r)) return 0;
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!;
    const b = r[(i + 1) % r.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

/** Metres along a wall of a point's foot on it. */
export const along = (w: Wall, p: P2): number => ((p.x - w.a.x) * (w.b.x - w.a.x) + (p.z - w.a.z) * (w.b.z - w.a.z)) / w.length;

/** World outlines of the data's buildings within 40 m of (x, z) but `self`. */
export const ringsAround = (x: number, z: number, self: readonly string[]): P2[][] =>
  LUBLIN_CHUNKS.flatMap((c) => c.buildings)
    .filter((b) => !self.includes(b.id) && Math.hypot(b.x - x, b.z - z) < 40)
    .map((b) => Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + b.outline[i * 2]!, z: b.z + b.outline[i * 2 + 1]! })));

/**
 * The uplight fittings at the lit mouths, found in the near sink (metal low by the mouth's wall,
 * grouped by 0.6 m along it): how many stand with their foot on the terrain under them (to 3 cm)
 * outside every ring of `rings`; -1 when one does not.
 */
export const onTheStreet = (f: LandmarkFrame, sink: MeshSink, rings: readonly (readonly P2[])[] = []): number => {
  let n = 0;
  for (const m of litMouths(f)) {
    const low = colored(sink, SWATCH.metal).filter((p) => p.y < m.top - 1 && Math.abs(before(m.w, p) - 0.16) < 0.15 && along(m.w, p) > -0.1 && along(m.w, p) < m.w.length + 0.1);
    const groups: (typeof low)[] = [];
    for (const p of [...low].sort((a, b) => along(m.w, a) - along(m.w, b))) {
      const g = groups[groups.length - 1];
      if (g && along(m.w, p) - along(m.w, g[g.length - 1]!) < 0.6) g.push(p);
      else groups.push([p]);
    }
    for (const g of groups) {
      const u = g.reduce((s, p) => s + along(m.w, p), 0) / g.length;
      const at = onWall(m.w, u, 0, 0.16);
      if (Math.abs(Math.min(...g.map((p) => p.y)) - groundY(at.x, at.z)) > 0.03 || rings.some((r) => pointInRing(at, r))) return -1;
      n++;
    }
  }
  return n;
};

/** Signed distance of a point in front of a wall's plane. */
export const before = (w: Wall, p: P2): number => (p.x - w.a.x) * w.nx + (p.z - w.a.z) * w.nz;

type V3 = { x: number; y: number; z: number };

/** Whether the segment p..q crosses any triangle of the sink (Möller–Trumbore). */
export const crosses = (sink: MeshSink, p: V3, q: V3): boolean => {
  const P = sink.positions;
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
  for (let t = 0; t < sink.indices.length; t += 3) {
    const v = [0, 1, 2].map((k) => sink.indices[t + k]! * 3).map((i) => ({ x: P[i]!, y: P[i + 1]!, z: P[i + 2]! }));
    const [a, b, c] = v as [V3, V3, V3];
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x };
    const det = e1.x * h.x + e1.y * h.y + e1.z * h.z;
    if (Math.abs(det) < 1e-12) continue;
    const s = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
    const u = (s.x * h.x + s.y * h.y + s.z * h.z) / det;
    const qv = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x };
    const w = (d.x * qv.x + d.y * qv.y + d.z * qv.z) / det;
    const k = (e2.x * qv.x + e2.y * qv.y + e2.z * qv.z) / det;
    if (u >= 0 && w >= 0 && u + w <= 1 && k > 0 && k < 1) return true;
  }
  return false;
};

/** The passage's corridor: segments mouth to mouth across its width, up to the springing and the crown on the axis. */
export const passageOpen = (sink: MeshSink, f: FacadeFrame): string[] => {
  const blocked: string[] = [];
  for (const p of f.b.passages ?? []) {
    const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
    const across = { x: -(p.to.z - p.from.z) / len, z: (p.to.x - p.from.x) / len };
    const floor = Math.max(p.floor[0], p.floor[1]);
    for (const s of [-0.8, 0, 0.8].map((k) => (k * p.width) / 2)) {
      for (const y of [floor + 0.3, (floor + p.spring) / 2, p.spring - 0.1, ...(s === 0 ? [p.crown - 0.15] : [])]) {
        const a = { x: p.from.x + across.x * s, y, z: p.from.z + across.z * s };
        const b = { x: p.to.x + across.x * s, y, z: p.to.z + across.z * s };
        if (crosses(sink, a, b)) blocked.push(`s ${s.toFixed(2)}, y ${y.toFixed(2)}`);
      }
    }
  }
  return blocked;
};
