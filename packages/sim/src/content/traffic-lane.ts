import type { Pt } from "./lublin/roads";

/** The traffic's lane (ADR-0050) and the polyline helpers both its building (`traffic.ts`) and its junctions (`traffic-junctions.ts`) use. */

export type RouteUse = "cars" | "trolley" | "deliveries";

/** Speed through a turn: round before a block, or into another street at a junction (m/s). */
export const TURN_SPEED = 4;

/** One lane of one road, driven from its first point to its last. */
export interface TrafficRoute {
  readonly id: string;
  readonly street: string;
  readonly use: RouteUse;
  /** The lane's line, offset from the street's axis to its side of the road. */
  readonly points: readonly Pt[];
  readonly length: number;
  /** Cruising speed, m/s. */
  readonly speed: number;
  /** Vehicles on it at full traffic. */
  readonly vehicles: number;
  /** Arc lengths where a trolleybus stops (its stops along the lane). */
  readonly stops: readonly number[];
  /** Arc length ranges of the lane's turns (round before a block, or into another street at a junction), driven at `TURN_SPEED`. */
  readonly turns?: readonly (readonly [number, number])[];
  /** Arc length ranges of the arcs it drives from lane to lane at the junctions (ADR-0055), straight on too. */
  readonly arcs?: readonly (readonly [number, number])[];
}

/** The point at arc length `s` of an open polyline (clamped), with the way along it. */
export const pointAt = (pts: readonly Pt[], s: number): { x: number; z: number; tx: number; tz: number } => {
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    if (left <= len || i === pts.length - 1) {
      const t = Math.min(1, left / len);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len };
    }
    left -= len;
  }
  const p = pts[0] ?? [0, 0];
  return { x: p[0], z: p[1], tx: 0, tz: 1 };
};

/**
 * Points of a polyline every `step` from arc length `from` to `to` (both clamped to it), stepped
 * `aside` metres to its right, in one pass: a vehicle's way ahead, read every step.
 */
export const pointsAlong = (pts: readonly Pt[], from: number, to: number, step: number, aside = 0): { x: number; z: number }[] => {
  const cum = cumulative(pts);
  const out: { x: number; z: number }[] = [];
  let at = Math.max(0, from);
  // The first segment reaching `at`, found by halving: a route runs to a thousand points.
  let lo = 1;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! < at) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < pts.length && at <= to; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const start = cum[i - 1]!;
    const len = cum[i]! - start;
    if (len < 1e-9) continue;
    const [tx, tz] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    while (at <= to && (at <= start + len || i === pts.length - 1)) {
      const t = Math.min(1, (at - start) / len);
      out.push({ x: a[0] + (b[0] - a[0]) * t + tz * aside, z: a[1] + (b[1] - a[1]) * t - tx * aside });
      if (t >= 1 && i === pts.length - 1) return out;
      at += step;
    }
  }
  return out;
};

/**
 * `pointAt` by halving over the polyline's arc lengths, for the vehicles: a route joined at the
 * junctions (ADR-0055) runs to a thousand points, and each vehicle reads it several times a step.
 */
export const pointOn = (pts: readonly Pt[], s: number): { x: number; z: number; tx: number; tz: number } => {
  const cum = cumulative(pts);
  if (pts.length < 2) return pointAt(pts, s);
  const at = Math.max(0, s);
  let lo = 1;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! < at) lo = mid + 1;
    else hi = mid;
  }
  // Past a zero-length step, as `pointAt` skips them.
  while (lo < pts.length - 1 && cum[lo]! - cum[lo - 1]! < 1e-9) lo++;
  const a = pts[lo - 1]!;
  const b = pts[lo]!;
  const len = cum[lo]! - cum[lo - 1]!;
  if (len < 1e-9) return pointAt(pts, s);
  const t = Math.min(1, (at - cum[lo - 1]!) / len);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len };
};

const lengths = new WeakMap<readonly Pt[], Float64Array>();

/** Arc length at each point of a polyline, worked out once per polyline. */
const cumulative = (pts: readonly Pt[]): Float64Array => {
  let cum = lengths.get(pts);
  if (cum) return cum;
  cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  lengths.set(pts, cum);
  return cum;
};

/** The part of a polyline between arc lengths `from` and `to`. */
export const slice = (pts: readonly Pt[], from: number, to: number): Pt[] => {
  const a = pointAt(pts, from);
  const b = pointAt(pts, to);
  const out: Pt[] = [[a.x, a.z]];
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    if (s > from && s < to) out.push(pts[i]!);
  }
  out.push([b.x, b.z]);
  return out;
};
