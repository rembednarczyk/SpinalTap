/**
 * Convex decomposition of building outlines for the simulation's prism solids (ADR-0042):
 * ear-clipping triangulation, then Hertel-Mehlhorn, which removes every diagonal whose removal
 * keeps both sides convex. At most four times the optimal number of parts, in O(n²).
 */
import { type Pt, signedArea } from "./geometry.ts";

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const inTriangle = (p: Pt, a: Pt, b: Pt, c: Pt): boolean =>
  cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;

/** Triangles of a simple counter-clockwise ring, as index triples. Null when clipping gets stuck. */
export const triangulate = (ring: readonly Pt[]): [number, number, number][] | null => {
  const idx = ring.map((_, i) => i);
  const tris: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > ring.length * ring.length + 10) return null;
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k - 1 + idx.length) % idx.length]!;
      const i1 = idx[k]!;
      const i2 = idx[(k + 1) % idx.length]!;
      const a = ring[i0]!;
      const b = ring[i1]!;
      const c = ring[i2]!;
      const turn = cross(a, b, c);
      if (turn <= 1e-12) {
        // A collinear vertex with no area: drop it without a triangle.
        if (Math.abs(turn) <= 1e-12 && (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z) > 0) {
          idx.splice(k, 1);
          clipped = true;
          break;
        }
        continue;
      }
      let blocked = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        const p = ring[j]!;
        if ((p.x === a.x && p.z === a.z) || (p.x === b.x && p.z === b.z) || (p.x === c.x && p.z === c.z)) continue;
        if (inTriangle(p, a, b, c)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      tris.push([i0, i1, i2]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) return null;
  }
  if (idx.length === 3 && cross(ring[idx[0]!]!, ring[idx[1]!]!, ring[idx[2]!]!) > 1e-12) tris.push([idx[0]!, idx[1]!, idx[2]!]);
  return tris;
};

/** True when the counter-clockwise ring of indices is convex (no right turns). */
const convexIdx = (ring: readonly Pt[], poly: readonly number[]): boolean => {
  for (let k = 0; k < poly.length; k++) {
    const a = ring[poly[k]!]!;
    const b = ring[poly[(k + 1) % poly.length]!]!;
    const c = ring[poly[(k + 2) % poly.length]!]!;
    if (cross(a, b, c) < -1e-9) return false;
  }
  return true;
};

/** Merges two polygons sharing an edge u→v in `p` (v→u in `q`), given u. */
const mergeAt = (p: readonly number[], q: readonly number[], u: number): number[] => {
  const pi = p.indexOf(u);
  const rotP = [...p.slice(pi + 1), ...p.slice(0, pi + 1)]; // starts after u, ends at u: v ... u
  const qi = q.indexOf(u);
  const rotQ = [...q.slice(qi), ...q.slice(0, qi)]; // u ... v
  return [...rotP.slice(0, -1), ...rotQ.slice(0, -1)];
};

const sharedEdge = (p: readonly number[], q: readonly number[]): [number, number] | null => {
  for (let k = 0; k < p.length; k++) {
    const u = p[k]!;
    const v = p[(k + 1) % p.length]!;
    const j = q.indexOf(v);
    if (j >= 0 && q[(j + 1) % q.length] === u) return [u, v];
  }
  return null;
};

/** Removes vertices of a part that lie on a straight line between its neighbours. */
const tidy = (ring: readonly Pt[], poly: readonly number[]): Pt[] => {
  const pts = poly.map((i) => ring[i]!);
  return pts.filter((p, k) => {
    const a = pts[(k - 1 + pts.length) % pts.length]!;
    const b = pts[(k + 1) % pts.length]!;
    return Math.abs(cross(a, p, b)) > 1e-9;
  });
};

/**
 * Splits a simple ring into convex counter-clockwise parts whose areas sum to the ring's area.
 * Null when the ring cannot be triangulated (self-intersecting input).
 */
export const convexParts = (input: readonly Pt[]): Pt[][] | null => {
  const ring = signedArea(input) < 0 ? [...input].reverse() : [...input];
  const tris = triangulate(ring);
  if (!tris) return null;
  let polys: number[][] = tris.map((t) => [...t]);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        const e = sharedEdge(polys[i]!, polys[j]!);
        if (!e) continue;
        const m = mergeAt(polys[i]!, polys[j]!, e[0]);
        if (!convexIdx(ring, m)) continue;
        polys = [...polys.slice(0, i), m, ...polys.slice(i + 1, j), ...polys.slice(j + 1)];
        merged = true;
        break outer;
      }
    }
  }
  return polys.map((p) => tidy(ring, p)).filter((p) => p.length >= 3);
};

export const isConvex = (poly: readonly Pt[], eps = 1e-6): boolean => {
  for (let k = 0; k < poly.length; k++) {
    if (cross(poly[k]!, poly[(k + 1) % poly.length]!, poly[(k + 2) % poly.length]!) < -eps) return false;
  }
  return true;
};
