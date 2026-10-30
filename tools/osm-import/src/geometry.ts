/** Plane geometry of the importer: rings, simplification, clipping and buffering in world metres. */

export interface Pt {
  readonly x: number;
  readonly z: number;
}

export interface Rect {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

/** Signed area of a ring (no repeated closing point): positive when counter-clockwise (x east, z north). */
export const signedArea = (ring: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};

export const ccw = (ring: readonly Pt[]): Pt[] => (signedArea(ring) < 0 ? [...ring].reverse() : [...ring]);

/** Drops the closing point of a closed way and consecutive duplicates. */
export const openRing = (pts: readonly Pt[], eps = 1e-6): Pt[] => {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > eps) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0]!.x - out[out.length - 1]!.x, out[0]!.z - out[out.length - 1]!.z) <= eps) out.pop();
  return out;
};

export const centroid = (ring: readonly Pt[]): Pt => {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return { x: ring.reduce((s, p) => s + p.x, 0) / n, z: ring.reduce((s, p) => s + p.z, 0) / n };
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const f = p.x * q.z - q.x * p.z;
    cx += (p.x + q.x) * f;
    cz += (p.z + q.z) * f;
  }
  return { x: cx / (6 * a), z: cz / (6 * a) };
};

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
};

/** Douglas-Peucker on an open polyline; the end points stay. */
export const simplifyLine = (pts: readonly Pt[], tolerance: number): Pt[] => {
  if (pts.length <= 2) return [...pts];
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [i, j] = stack.pop()!;
    let best = -1;
    let bestD = tolerance;
    for (let k = i + 1; k < j; k++) {
      const d = segDist(pts[k]!, pts[i]!, pts[j]!);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = true;
      stack.push([i, best], [best, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
};

/**
 * Simplifies a ring to `tolerance`, splitting it at its farthest point from the first vertex so
 * both halves keep their ends. Returns the original ring when the result would be degenerate or
 * self-intersecting.
 */
export const simplifyRing = (ring: readonly Pt[], tolerance: number): Pt[] => {
  if (ring.length <= 3) return [...ring];
  const first = ring[0]!;
  let far = 1;
  for (let k = 2; k < ring.length; k++) {
    if (Math.hypot(ring[k]!.x - first.x, ring[k]!.z - first.z) > Math.hypot(ring[far]!.x - first.x, ring[far]!.z - first.z)) far = k;
  }
  const a = simplifyLine(ring.slice(0, far + 1), tolerance);
  const b = simplifyLine([...ring.slice(far), first], tolerance);
  const out = removeCollinear([...a.slice(0, -1), ...b.slice(0, -1)], tolerance / 4);
  if (out.length < 3 || selfIntersects(out) || Math.abs(signedArea(out)) < 1e-6) return [...ring];
  return out;
};

/** Removes vertices lying on the line through their neighbours (within `eps` metres). */
export const removeCollinear = (ring: readonly Pt[], eps = 1e-3): Pt[] => {
  let pts = [...ring];
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]!;
      const next = pts[(i + 1) % pts.length]!;
      if (segDist(pts[i]!, prev, next) <= eps) {
        pts = [...pts.slice(0, i), ...pts.slice(i + 1)];
        changed = true;
        i--;
      }
    }
  }
  return pts;
};

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};

/** True when two non-adjacent edges of the ring properly cross. */
export const selfIntersects = (ring: readonly Pt[]): boolean => {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(ring[i]!, ring[(i + 1) % n]!, ring[j]!, ring[(j + 1) % n]!)) return true;
    }
  }
  return false;
};

export const pointInRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

export const ringBounds = (pts: readonly Pt[]): Rect => ({
  minX: Math.min(...pts.map((p) => p.x)),
  minZ: Math.min(...pts.map((p) => p.z)),
  maxX: Math.max(...pts.map((p) => p.x)),
  maxZ: Math.max(...pts.map((p) => p.z)),
});

export const rectsOverlap = (a: Rect, b: Rect): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

export const inRect = (p: Pt, r: Rect): boolean => p.x >= r.minX && p.x < r.maxX && p.z >= r.minZ && p.z < r.maxZ;

/** Sutherland-Hodgman clip of any simple ring against an axis-aligned rectangle. */
export const clipRingToRect = (ring: readonly Pt[], r: Rect): Pt[] => {
  type Edge = { inside: (p: Pt) => boolean; cut: (a: Pt, b: Pt) => Pt };
  const lerpX = (a: Pt, b: Pt, x: number): Pt => ({ x, z: a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x) });
  const lerpZ = (a: Pt, b: Pt, z: number): Pt => ({ x: a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z), z });
  const edges: Edge[] = [
    { inside: (p) => p.x >= r.minX, cut: (a, b) => lerpX(a, b, r.minX) },
    { inside: (p) => p.x <= r.maxX, cut: (a, b) => lerpX(a, b, r.maxX) },
    { inside: (p) => p.z >= r.minZ, cut: (a, b) => lerpZ(a, b, r.minZ) },
    { inside: (p) => p.z <= r.maxZ, cut: (a, b) => lerpZ(a, b, r.maxZ) },
  ];
  let out: Pt[] = [...ring];
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const prev = input[(i - 1 + input.length) % input.length]!;
      if (e.inside(cur)) {
        if (!e.inside(prev)) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (e.inside(prev)) out.push(e.cut(prev, cur));
    }
    if (out.length === 0) return [];
  }
  return openRing(out);
};

/** Clips an open polyline to a rectangle; returns the pieces inside (Liang-Barsky per segment). */
export const clipLineToRect = (line: readonly Pt[], r: Rect): Pt[][] => {
  const pieces: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const checks: [number, number][] = [
      [-dx, a.x - r.minX],
      [dx, r.maxX - a.x],
      [-dz, a.z - r.minZ],
      [dz, r.maxZ - a.z],
    ];
    let visible = true;
    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) visible = false;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!visible || t0 > t1) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
      continue;
    }
    const pa = { x: a.x + t0 * dx, z: a.z + t0 * dz };
    const pb = { x: a.x + t1 * dx, z: a.z + t1 * dz };
    if (cur.length === 0) cur.push(pa);
    cur.push(pb);
    if (t1 < 1) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
};

/**
 * Offsets an open polyline by `offset` metres to its left (negative: right), with mitred joins
 * capped at three times the offset.
 */
export const offsetLine = (line: readonly Pt[], offset: number): Pt[] => {
  const out: Pt[] = [];
  const n = line.length;
  const normal = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
  };
  for (let i = 0; i < n; i++) {
    const p = line[i]!;
    const n0 = i > 0 ? normal(line[i - 1]!, p) : null;
    const n1 = i < n - 1 ? normal(p, line[i + 1]!) : null;
    let m = n0 && n1 ? { x: n0.x + n1.x, z: n0.z + n1.z } : (n0 ?? n1)!;
    const ml = Math.hypot(m.x, m.z);
    if (ml < 1e-9) m = n1 ?? n0!;
    else m = { x: m.x / ml, z: m.z / ml };
    const ref = n1 ?? n0!;
    const cos = m.x * ref.x + m.z * ref.z;
    const k = Math.min(1 / Math.max(cos, 1e-6), 3);
    out.push({ x: p.x + m.x * offset * k, z: p.z + m.z * offset * k });
  }
  return out;
};

/** A strip `width` wide along a polyline, between offsets `from` and `from + width` to its left. */
export const stripAlong = (line: readonly Pt[], from: number, width: number): Pt[] => {
  if (line.length < 2) return [];
  const a = offsetLine(line, from);
  const b = offsetLine(line, from + width);
  return ccw([...a, ...b.reverse()]);
};

/** A band `width` wide centred on a polyline. */
export const bufferLine = (line: readonly Pt[], width: number): Pt[] => stripAlong(line, -width / 2, width);

/** Length of a polyline. */
export const lineLength = (line: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) s += Math.hypot(line[i + 1]!.x - line[i]!.x, line[i + 1]!.z - line[i]!.z);
  return s;
};

/** The point at arc length `s` along a polyline (clamped to its ends). */
export const pointAlong = (line: readonly Pt[], s: number): Pt => {
  let left = Math.max(0, s);
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len) return { x: a.x + ((b.x - a.x) * left) / (len || 1), z: a.z + ((b.z - a.z) * left) / (len || 1) };
    left -= len;
  }
  return line[line.length - 1] ?? { x: 0, z: 0 };
};

/** The part of a polyline between arc lengths `from` and `to`, ends interpolated. */
export const sliceLine = (line: readonly Pt[], from: number, to: number): Pt[] => {
  const out: Pt[] = [];
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const at = (d: number): Pt => ({ x: a.x + ((b.x - a.x) * d) / (len || 1), z: a.z + ((b.z - a.z) * d) / (len || 1) });
    if (s + len >= from && s <= to) {
      if (out.length === 0) out.push(at(Math.max(0, from - s)));
      if (s + len <= to) out.push(b);
      else {
        out.push(at(to - s));
        break;
      }
    }
    s += len;
  }
  return out;
};

/** Rounds to 0.1 m. */
export const r1 = (v: number): number => Math.round(v * 10) / 10 + 0;
