/**
 * Plane geometry of the map city (ADR-0044): outlines of buildings and ground surfaces as rings
 * of points on the ground plane (x east, z north). Pure functions, no Babylon.
 *
 * Orientation: a ring is counter-clockwise when its signed area (shoelace over x and z) is
 * positive; its interior then lies to the left of every edge and the outward normal of an
 * edge with direction (dx, dz) is (dz, -dx).
 */

export interface P2 {
  readonly x: number;
  readonly z: number;
}

export interface Box2 {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const signedArea = (ring: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};

const cross = (o: P2, a: P2, b: P2): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/**
 * A clean counter-clockwise ring: no repeated closing point, no duplicate neighbours, no
 * collinear middle points (they would make zero-area ears and needless wall quads).
 */
export const cleanRing = (ring: readonly P2[], eps = 0.02): P2[] => {
  let pts: P2[] = [];
  for (const p of ring) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > eps) pts.push({ x: p.x, z: p.z });
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last && pts.length > 1 && Math.hypot(first.x - last.x, first.z - last.z) <= eps) pts.pop();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length] as P2;
      const b = pts[i] as P2;
      const c = pts[(i + 1) % pts.length] as P2;
      const len = Math.hypot(c.x - a.x, c.z - a.z);
      if (Math.abs(cross(a, b, c)) <= eps * Math.max(len, 1e-6)) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (signedArea(pts) < 0) pts = pts.reverse();
  return pts;
};

const inTriangle = (p: P2, a: P2, b: P2, c: P2): boolean => cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9;

/**
 * Ear clipping of a simple polygon (convex or not, counter-clockwise): triangles as index
 * triples into `ring`, each counter-clockwise. A ring that self-intersects still yields
 * n - 2 triangles (the leftover is fanned), so a bad outline never hangs the build.
 */
export const triangulate = (ring: readonly P2[]): number[] => {
  const n = ring.length;
  if (n < 3) return [];
  const idx = Array.from({ length: n }, (_, i) => i);
  if (signedArea(ring) < 0) idx.reverse();
  const out: number[] = [];
  const at = (k: number) => ring[idx[k] as number] as P2;
  let guard = 0;
  while (idx.length > 3 && guard < n * n) {
    guard++;
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const kp = (k + idx.length - 1) % idx.length;
      const kn = (k + 1) % idx.length;
      const a = at(kp);
      const b = at(k);
      const c = at(kn);
      if (cross(a, b, c) <= 1e-9) continue;
      let ear = true;
      for (let j = 0; j < idx.length && ear; j++) {
        if (j === kp || j === k || j === kn) continue;
        const p = at(j);
        if ((p.x === a.x && p.z === a.z) || (p.x === b.x && p.z === b.z) || (p.x === c.x && p.z === c.z)) continue;
        if (inTriangle(p, a, b, c)) ear = false;
      }
      if (!ear) continue;
      out.push(idx[kp] as number, idx[k] as number, idx[kn] as number);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  // What is left (a triangle, or a degenerate rest of a self-intersecting ring) is fanned.
  for (let k = 1; k + 1 < idx.length; k++) out.push(idx[0] as number, idx[k] as number, idx[k + 1] as number);
  return out;
};

export const pointInRing = (p: P2, ring: readonly P2[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as P2;
    const b = ring[j] as P2;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

export const boundsOf = (ring: readonly P2[]): Box2 => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
};

export const perimeter = (ring: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    s += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return s;
};

/** Area centroid (falls back to the vertex mean for a degenerate ring). */
export const centroid = (ring: readonly P2[]): P2 => {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    const sx = ring.reduce((s, p) => s + p.x, 0);
    const sz = ring.reduce((s, p) => s + p.z, 0);
    return { x: sx / Math.max(ring.length, 1), z: sz / Math.max(ring.length, 1) };
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as P2;
    const q = ring[(i + 1) % ring.length] as P2;
    const f = p.x * q.z - q.x * p.z;
    cx += (p.x + q.x) * f;
    cz += (p.z + q.z) * f;
  }
  return { x: cx / (6 * a), z: cz / (6 * a) };
};

/**
 * The ring moved `d` metres outwards (inwards for d < 0) along each corner's bisector, with
 * the mitre capped at 2.5 d so sharp corners do not spike. Null when an inward offset turns
 * an edge around (the ring is too narrow for it).
 */
export const offsetRing = (ring: readonly P2[], d: number): P2[] | null => {
  const n = ring.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n] as P2;
    const c = ring[i] as P2;
    const q = ring[(i + 1) % n] as P2;
    const l1 = Math.hypot(c.x - p.x, c.z - p.z) || 1;
    const l2 = Math.hypot(q.x - c.x, q.z - c.z) || 1;
    const n1 = { x: (c.z - p.z) / l1, z: -(c.x - p.x) / l1 };
    const n2 = { x: (q.z - c.z) / l2, z: -(q.x - c.x) / l2 };
    let bx = n1.x + n2.x;
    let bz = n1.z + n2.z;
    const bl = Math.hypot(bx, bz);
    if (bl < 1e-6) {
      bx = n1.x;
      bz = n1.z;
    } else {
      bx /= bl;
      bz /= bl;
    }
    const cos = Math.max(bx * n1.x + bz * n1.z, 0.4);
    out.push({ x: c.x + (bx * d) / cos, z: c.z + (bz * d) / cos });
  }
  if (d < 0) {
    for (let i = 0; i < n; i++) {
      const a0 = ring[i] as P2;
      const a1 = ring[(i + 1) % n] as P2;
      const b0 = out[i] as P2;
      const b1 = out[(i + 1) % n] as P2;
      if ((a1.x - a0.x) * (b1.x - b0.x) + (a1.z - a0.z) * (b1.z - b0.z) <= 0) return null;
    }
    if (signedArea(out) <= 0) return null;
  }
  return out;
};

/** Oriented bounding box (smallest area over the hull's edge directions): centre, long axis, half sizes. */
export interface Obb {
  readonly cx: number;
  readonly cz: number;
  /** Unit vector along the long side. */
  readonly ux: number;
  readonly uz: number;
  readonly halfLong: number;
  readonly halfShort: number;
}

const hull = (pts: readonly P2[]): P2[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  if (s.length < 3) return s;
  const lower: P2[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as P2, lower[lower.length - 1] as P2, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i] as P2;
    while (upper.length >= 2 && cross(upper[upper.length - 2] as P2, upper[upper.length - 1] as P2, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

export const orientedBox = (ring: readonly P2[]): Obb => {
  const h = hull(ring);
  let best: Obb | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i] as P2;
    const b = h[(i + 1) % h.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const p of h) {
      const u = p.x * ux + p.z * uz;
      const v = -p.x * uz + p.z * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area >= bestArea - 1e-9) continue;
    bestArea = area;
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    const cx = cu * ux - cv * uz;
    const cz = cu * uz + cv * ux;
    const long = u1 - u0 >= v1 - v0;
    best = long
      ? { cx, cz, ux, uz, halfLong: (u1 - u0) / 2, halfShort: (v1 - v0) / 2 }
      : { cx, cz, ux: -uz, uz: ux, halfLong: (v1 - v0) / 2, halfShort: (u1 - u0) / 2 };
  }
  if (best) return best;
  const c = centroid(ring);
  return { cx: c.x, cz: c.z, ux: 1, uz: 0, halfLong: 0, halfShort: 0 };
};

/** Coordinates of p in the box frame: along the long axis, across it. */
export const obbLocal = (o: Obb, p: P2): { u: number; v: number } => {
  const dx = p.x - o.cx;
  const dz = p.z - o.cz;
  return { u: dx * o.ux + dz * o.uz, v: -dx * o.uz + dz * o.ux };
};

export const distanceToBox = (x: number, z: number, b: Box2): number => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
