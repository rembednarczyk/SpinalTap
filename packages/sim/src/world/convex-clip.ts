import type { GroundPoint } from "@seki/core";

/** Twice the signed area of a ring: positive when counter-clockwise (x right, z up). */
const area2 = (ring: readonly GroundPoint[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    s += a.x * b.z - b.x * a.z;
  }
  return s;
};

/** The part of `poly` on one side of the line through `a` and `b`: its left (`left`) or its right (Sutherland–Hodgman). */
const clipHalf = (poly: readonly GroundPoint[], a: GroundPoint, b: GroundPoint, left: boolean): GroundPoint[] => {
  const side = (p: GroundPoint) => ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) * (left ? 1 : -1);
  const out: GroundPoint[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const [sp, sq] = [side(p), side(q)];
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
    }
  }
  return out;
};

/** The ring without points repeated one after another (a degenerate edge has no side). */
const distinct = (ring: readonly GroundPoint[]): GroundPoint[] =>
  ring.filter((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    return Math.hypot(p.x - q.x, p.z - q.z) > 1e-6;
  });

/** Smallest area of a piece kept (m²): slivers of the clipping are dropped. */
const SLIVER = 1e-3;

/**
 * The convex polygon `subject` without the convex polygon `clip`, as convex pieces: for each edge
 * of `clip` in turn, the part of what is left that lies outside that edge.
 */
export const minusConvex = (subject: readonly GroundPoint[], clip: readonly GroundPoint[]): GroundPoint[][] => {
  const c = distinct(clip);
  if (c.length < 3) return [[...subject]];
  const ccw = area2(c) > 0;
  const out: GroundPoint[][] = [];
  let rest: GroundPoint[] = [...subject];
  for (let i = 0; i < c.length && rest.length >= 3; i++) {
    const [a, b] = [c[i]!, c[(i + 1) % c.length]!];
    const outside = clipHalf(rest, a, b, !ccw);
    if (outside.length >= 3 && Math.abs(area2(outside)) / 2 > SLIVER) out.push(outside);
    rest = clipHalf(rest, a, b, ccw);
  }
  return out;
};
