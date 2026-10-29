import type { CrowdLane } from "../content/crowd";

/**
 * Geometry of the residents' routes (ADR-0041): a closed polygon rounded at its corners and
 * measured along its length, so a walker's place is a point at an arc length. Pure functions.
 */

export interface LanePoint {
  readonly x: number;
  readonly z: number;
  /** Unit direction of travel along the lane at this point. */
  readonly tx: number;
  readonly tz: number;
}

export interface LaneGeom {
  readonly id: string;
  readonly xs: readonly number[];
  readonly zs: readonly number[];
  /** Arc length at each point; the last one closes the loop back to the first. */
  readonly cum: readonly number[];
  readonly length: number;
}

/** Corners are rounded this far along each side (m), or half the side when it is shorter. */
const CORNER = 1.4;
const CORNER_STEPS = 4;

/** The polygon with each corner replaced by a short curve (a quadratic Bézier through it). */
export const roundCorners = (points: readonly (readonly [number, number])[], radius = CORNER): [number, number][] => {
  const n = points.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i] as readonly [number, number];
    const a = points[(i + n - 1) % n] as readonly [number, number];
    const b = points[(i + 1) % n] as readonly [number, number];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(radius, la / 2) / Math.max(la, 1e-9);
    const rb = Math.min(radius, lb / 2) / Math.max(lb, 1e-9);
    const s: [number, number] = [p[0] + (a[0] - p[0]) * ra, p[1] + (a[1] - p[1]) * ra];
    const e: [number, number] = [p[0] + (b[0] - p[0]) * rb, p[1] + (b[1] - p[1]) * rb];
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const t = k / CORNER_STEPS;
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  return out;
};

const cache = new Map<string, LaneGeom>();

/** The measured, rounded geometry of a lane. Memoised by id (lanes are content). */
export const laneGeom = (lane: CrowdLane): LaneGeom => {
  let g = cache.get(lane.id);
  if (g) return g;
  const pts = roundCorners(lane.points);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cum: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1] as [number, number];
    const b = pts[i % pts.length] as [number, number];
    cum.push((cum[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  g = { id: lane.id, xs, zs, cum, length: cum[pts.length] ?? 0 };
  cache.set(lane.id, g);
  return g;
};

/** Arc length wrapped into [0, length). */
export const wrapArc = (g: LaneGeom, s: number): number => {
  const r = s % g.length;
  return r < 0 ? r + g.length : r;
};

/** Index of the segment holding arc length `s` (already wrapped): binary search over `cum`. */
const segmentAt = (g: LaneGeom, s: number): number => {
  let lo = 0;
  let hi = g.xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((g.cum[mid] ?? 0) <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/** The point at arc length `s` (any real number: the lane is a loop) and the way along it there. */
export const lanePoint = (g: LaneGeom, s: number): LanePoint => {
  const w = wrapArc(g, s);
  const i = segmentAt(g, w);
  const j = (i + 1) % g.xs.length;
  const ax = g.xs[i] ?? 0;
  const az = g.zs[i] ?? 0;
  const dx = (g.xs[j] ?? 0) - ax;
  const dz = (g.zs[j] ?? 0) - az;
  const len = Math.hypot(dx, dz);
  const t = len > 1e-9 ? (w - (g.cum[i] ?? 0)) / len : 0;
  return len > 1e-9 ? { x: ax + dx * t, z: az + dz * t, tx: dx / len, tz: dz / len } : { x: ax, z: az, tx: 1, tz: 0 };
};

/** Arc length of the lane's point nearest to (x, z). */
export const nearestArc = (g: LaneGeom, x: number, z: number): number => {
  let best = 0;
  let bestD = Infinity;
  const n = g.xs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = g.xs[i] ?? 0;
    const az = g.zs[i] ?? 0;
    const dx = (g.xs[j] ?? 0) - ax;
    const dz = (g.zs[j] ?? 0) - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = (g.cum[i] ?? 0) + Math.sqrt(len2) * t;
    }
  }
  return best;
};
