/**
 * A bridge's way to its abutment (G-344): a deck is level from end to end at the terrain's height
 * at its two ends, so an end node mapped short of the abutment, out over the bank under the
 * bridge, tilts the whole deck. The carriageway of Mełgiewska's south bridge (w50733068) ends 8 m
 * short of its west abutment, where the NMT (bare earth, the bridge left out) is 2.4 m below the
 * road: the carriageway fell 2.4 m along the bridge while its sidewalk beside it stayed level.
 * The bridge's outline (`man_made=bridge`) shows where the structure ends.
 */
import { type Area, type Line } from "./features.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** An end closer than this to the outline's edge lies at the abutment already (m). */
const AT_EDGE = 0.5;
/** The furthest an end is carried on to the abutment (m): further, the outline is not this way's bridge. */
const MAX_REACH = 15;

/** How far from `p` along the unit direction `d` the ray first crosses the ring's edge, or null. */
const rayToEdge = (p: Pt, d: Pt, ring: readonly Pt[]): number | null => {
  let best: number | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - p.x) * ez - (a.z - p.z) * ex) / den;
    const u = ((a.x - p.x) * d.z - (a.z - p.z) * d.x) / den;
    if (t >= 0 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
};

const edgeDistance = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z));
  }
  return best;
};

/**
 * The map's lines with each bridge way that ends inside a bridge's outline carried on straight to
 * the outline's edge, its abutment. Not an end another bridge way goes on from: a bridge mapped in
 * several ways is one deck on through that node.
 */
export const toAbutments = (lines: readonly Line[], areas: readonly Area[]): Line[] => {
  const outlines = areas.filter((a) => a.tags.man_made === "bridge").map((a) => a.ring);
  const isBridge = (l: Line) => l.tags.bridge !== undefined && l.tags.bridge !== "no";
  const ends = new Map<string, number>();
  const key = (p: Pt) => `${p.x},${p.z}`;
  for (const l of lines) if (isBridge(l) && l.line.length >= 2) for (const p of [l.line[0]!, l.line[l.line.length - 1]!]) ends.set(key(p), (ends.get(key(p)) ?? 0) + 1);
  const carry = (end: Pt, before: Pt): Pt => {
    if ((ends.get(key(end)) ?? 0) > 1) return end;
    const len = Math.hypot(end.x - before.x, end.z - before.z);
    if (len === 0) return end;
    const d = { x: (end.x - before.x) / len, z: (end.z - before.z) / len };
    for (const ring of outlines) {
      if (!pointInRing(end, ring) || edgeDistance(end, ring) < AT_EDGE) continue;
      const t = rayToEdge(end, d, ring);
      if (t !== null && t <= MAX_REACH) return { x: end.x + d.x * t, z: end.z + d.z * t };
    }
    return end;
  };
  return lines.map((l) => {
    if (!isBridge(l) || l.line.length < 2) return l;
    const n = l.line.length;
    const first = carry(l.line[0]!, l.line[1]!);
    const last = carry(l.line[n - 1]!, l.line[n - 2]!);
    return first === l.line[0] && last === l.line[n - 1] ? l : { ...l, line: [first, ...l.line.slice(1, n - 1), last] };
  });
};
