import type { GroundPoint, Vec3 } from "@seki/core";
import type { Aabb } from "./collision";

/**
 * A convex prism (ADR-0043): a convex polygon on the XZ plane extruded from `bottom` to `top`.
 * Buildings from map data are made of these (the importer splits outlines into convex parts).
 * Everything is in world metres; the edge normals point outwards and are unit length, so
 * `normals[i]·p - offsets[i]` is the signed distance of p from the line of edge i.
 */
export interface Prism {
  /** Corners, counter-clockwise on the map (x east, z north), no repeats, no collinear ones. */
  readonly points: readonly GroundPoint[];
  readonly normals: readonly GroundPoint[];
  readonly offsets: readonly number[];
  readonly bottom: number;
  readonly top: number;
  /** Bounding box: the broad phase of every test. */
  readonly box: Aabb;
}

/** A convex part as content gives it (ADR-0043): corners relative to the prop's centre, heights above its y. */
export interface PrismDef {
  readonly points: readonly GroundPoint[];
  readonly bottom: number;
  readonly top: number;
}

const EPS = 1e-9;

const signedArea = (pts: readonly GroundPoint[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] as GroundPoint;
    const q = pts[(i + 1) % pts.length] as GroundPoint;
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
};

/** Drops repeated corners and corners on a straight edge. */
const simplify = (pts: readonly GroundPoint[]): GroundPoint[] => {
  let out = pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length] as GroundPoint;
    return Math.abs(p.x - q.x) > 1e-7 || Math.abs(p.z - q.z) > 1e-7;
  });
  for (let changed = true; changed && out.length > 3; ) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length] as GroundPoint;
      const b = out[i] as GroundPoint;
      const c = out[(i + 1) % out.length] as GroundPoint;
      const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
      if (Math.abs(cross) < 1e-9) {
        out = out.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
};

/** True when the polygon (either winding) is convex. */
export const isConvex = (pts: readonly GroundPoint[]): boolean => {
  const p = simplify(pts);
  if (p.length < 3) return false;
  const sign = Math.sign(signedArea(p));
  if (sign === 0) return false;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as GroundPoint;
    const b = p[(i + 1) % p.length] as GroundPoint;
    const c = p[(i + 2) % p.length] as GroundPoint;
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (cross * sign < -1e-9) return false;
  }
  return true;
};

/**
 * A prism from world corners (either winding; made counter-clockwise). Throws on a polygon that
 * is not convex or has no area: that is a content error the importer must not produce.
 */
export const makePrism = (corners: readonly GroundPoint[], bottom: number, top: number): Prism => {
  if (!isConvex(corners) || !(top > bottom)) throw new Error(`not a convex prism: ${JSON.stringify(corners)} ${bottom}..${top}`);
  let points = simplify(corners);
  if (signedArea(points) < 0) points = [...points].reverse();
  const normals: GroundPoint[] = [];
  const offsets: number[] = [];
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as GroundPoint;
    const b = points[(i + 1) % points.length] as GroundPoint;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = { x: (b.z - a.z) / len, z: -(b.x - a.x) / len };
    normals.push(n);
    offsets.push(n.x * a.x + n.z * a.z);
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x);
    minZ = Math.min(minZ, a.z);
    maxZ = Math.max(maxZ, a.z);
  }
  return { points, normals, offsets, bottom, top, box: { min: { x: minX, y: bottom, z: minZ }, max: { x: maxX, y: top, z: maxZ } } };
};

/** World prisms of a prop's convex parts, placed at `center`. */
export const prismsAt = (defs: readonly PrismDef[], center: Vec3): Prism[] =>
  defs.map((d) =>
    makePrism(
      d.points.map((p) => ({ x: center.x + p.x, z: center.z + p.z })),
      center.y + d.bottom,
      center.y + d.top,
    ),
  );

/** Box around every prism (the solid's broad phase). */
export const boundsOfPrisms = (prisms: readonly Prism[]): Aabb => {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const { box } of prisms) {
    min.x = Math.min(min.x, box.min.x);
    min.y = Math.min(min.y, box.min.y);
    min.z = Math.min(min.z, box.min.z);
    max.x = Math.max(max.x, box.max.x);
    max.y = Math.max(max.y, box.max.y);
    max.z = Math.max(max.z, box.max.z);
  }
  return { min, max };
};

/** Largest signed distance of the point from the edge lines: ≤ 0 inside, and ≤ the true distance outside. */
export const edgeDistance = (p: Prism, x: number, z: number): number => {
  let d = -Infinity;
  const { normals, offsets } = p;
  for (let i = 0; i < normals.length; i++) {
    const n = normals[i] as GroundPoint;
    const s = n.x * x + n.z * z - (offsets[i] as number);
    if (s > d) d = s;
  }
  return d;
};

/** True when the point lies on the prism's footprint, grown by `margin`. */
export const overPrism = (p: Prism, x: number, z: number, margin = 0): boolean => edgeDistance(p, x, z) <= margin;

/** Closest point of the footprint to (x, z): the point itself inside, else on the boundary. Written into `out`. */
export const closestOnPrism = (p: Prism, x: number, z: number, out: { x: number; z: number }): { x: number; z: number } => {
  if (edgeDistance(p, x, z) <= 0) {
    out.x = x;
    out.z = z;
    return out;
  }
  let best = Infinity;
  const pts = p.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as GroundPoint;
    const b = pts[(i + 1) % pts.length] as GroundPoint;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez)));
    const qx = a.x + ex * t;
    const qz = a.z + ez * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < best) {
      best = d;
      out.x = qx;
      out.z = qz;
    }
  }
  return out;
};

const scratch = { x: 0, z: 0 };

/**
 * Pushes a circle out of the footprint (the walls slant any way): along the line from the
 * closest point when the centre is outside, through the nearest edge when it is inside.
 * Returns the input when there is no overlap.
 */
export const resolveCirclePrism = (x: number, z: number, radius: number, p: Prism): { x: number; z: number } => {
  const inside = edgeDistance(p, x, z);
  if (inside <= 0) {
    let k = 0;
    let best = -Infinity;
    for (let i = 0; i < p.normals.length; i++) {
      const n = p.normals[i] as GroundPoint;
      const s = n.x * x + n.z * z - (p.offsets[i] as number);
      if (s > best) {
        best = s;
        k = i;
      }
    }
    const n = p.normals[k] as GroundPoint;
    return { x: x + n.x * (radius - best), z: z + n.z * (radius - best) };
  }
  if (inside >= radius) return { x, z };
  const q = closestOnPrism(p, x, z, scratch);
  const dx = x - q.x;
  const dz = z - q.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return { x, z };
  const d = Math.sqrt(d2);
  const push = radius - d;
  return { x: x + (dx / d) * push, z: z + (dz / d) * push };
};

/** Does a circle at (x, z) touch the footprint? */
export const circleTouchesPrism = (p: Prism, x: number, z: number, radius: number): boolean => {
  const e = edgeDistance(p, x, z);
  if (e <= 0) return true;
  if (e >= radius) return false;
  const q = closestOnPrism(p, x, z, scratch);
  return (x - q.x) ** 2 + (z - q.z) ** 2 < radius * radius;
};

/**
 * Entry and exit distances of a ray (normalised direction) through the prism, clipped to
 * [0, maxDist] (Cyrus-Beck against the walls, a slab test against the floor and the roof).
 */
export const rayPrismRange = (origin: Vec3, dir: Vec3, p: Prism, maxDist: number): readonly [number, number] | null => {
  let t0 = 0;
  let t1 = maxDist;
  if (Math.abs(dir.y) < EPS) {
    if (origin.y < p.bottom || origin.y > p.top) return null;
  } else {
    let a = (p.bottom - origin.y) / dir.y;
    let b = (p.top - origin.y) / dir.y;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  for (let i = 0; i < p.normals.length; i++) {
    const n = p.normals[i] as GroundPoint;
    const den = n.x * dir.x + n.z * dir.z;
    const num = (p.offsets[i] as number) - (n.x * origin.x + n.z * origin.z);
    if (Math.abs(den) < EPS) {
      if (num < 0) return null;
      continue;
    }
    const t = num / den;
    if (den < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
};

/** Distance along the ray to the first point of the prism, or null. */
export const rayPrism = (origin: Vec3, dir: Vec3, p: Prism, maxDist: number): number | null => rayPrismRange(origin, dir, p, maxDist)?.[0] ?? null;
