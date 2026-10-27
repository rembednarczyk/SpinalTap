import type { Slope, Vec3 } from "@seki/core";

/** Axis-aligned box, described by its minimum and maximum corners. */
export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

export const aabbFromCenter = (center: Vec3, size: Vec3): Aabb => ({
  min: { x: center.x - size.x / 2, y: center.y - size.y / 2, z: center.z - size.z / 2 },
  max: { x: center.x + size.x / 2, y: center.y + size.y / 2, z: center.z + size.z / 2 },
});

/**
 * Pushes a circle (character footprint on the XZ plane) out of a box.
 * Returns the corrected centre, or the input when there is no overlap.
 */
export const resolveCircleAabb = (x: number, z: number, radius: number, box: Aabb): { x: number; z: number } => {
  const cx = Math.max(box.min.x, Math.min(x, box.max.x));
  const cz = Math.max(box.min.z, Math.min(z, box.max.z));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return { x, z };
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    return { x: x + (dx / d) * push, z: z + (dz / d) * push };
  }
  // Centre is inside the box: leave through the nearest face.
  const exits = [
    { d: x - box.min.x, x: box.min.x - radius, z },
    { d: box.max.x - x, x: box.max.x + radius, z },
    { d: z - box.min.z, x, z: box.min.z - radius },
    { d: box.max.z - z, x, z: box.max.z + radius },
  ];
  exits.sort((a, b) => a.d - b.d);
  const best = exits[0];
  return best ? { x: best.x, z: best.z } : { x, z };
};

/** Slab test. Returns the distance along the (normalized) ray to the first hit, or null. */
export const rayAabb = (origin: Vec3, dir: Vec3, box: Aabb, maxDist: number): number | null => {
  let tmin = 0;
  let tmax = maxDist;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
};

/** Entry and exit distances of a ray through a box, or null when it misses within `maxDist`. */
export const rayAabbRange = (origin: Vec3, dir: Vec3, box: Aabb, maxDist: number): readonly [number, number] | null => {
  let tmin = 0;
  let tmax = maxDist;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return [tmin, tmax];
};

/** Height of a box's top at a point of its footprint (clamped into it); sloped tops rise linearly (ADR-0020). */
export const topAt = (box: Aabb, slope: Slope | undefined, x: number, z: number): number => {
  if (!slope) return box.max.y;
  const p = slope.axis === "x" ? x : z;
  const lo = box.min[slope.axis];
  const span = box.max[slope.axis] - lo;
  const f = span <= 0 ? 1 : Math.max(0, Math.min(1, (p - lo) / span));
  const t = slope.dir === 1 ? f : 1 - f;
  const base = box.min.y + slope.low;
  return base + (box.max.y - base) * t;
};

/** True when the point lies inside the box's footprint on the XZ plane. */
export const overFootprint = (box: Aabb, x: number, z: number, margin = 0): boolean =>
  x >= box.min.x - margin && x <= box.max.x + margin && z >= box.min.z - margin && z <= box.max.z + margin;

/**
 * Ray against a solid: a plain box, or a wedge under a sloped top. Inside the box, the gap
 * between the ray and the slope is linear in the distance, so the first point below the top
 * is one division away.
 */
export const raySolid = (origin: Vec3, dir: Vec3, box: Aabb, slope: Slope | undefined, maxDist: number): number | null => {
  if (!slope) return rayAabb(origin, dir, box, maxDist);
  const range = rayAabbRange(origin, dir, box, maxDist);
  if (!range) return null;
  const [t0, t1] = range;
  const gap = (t: number) => origin.y + dir.y * t - topAt(box, slope, origin.x + dir.x * t, origin.z + dir.z * t);
  const g0 = gap(t0);
  if (g0 <= 0) return t0;
  const g1 = gap(t1);
  if (g1 > 0) return null;
  return t0 + ((t1 - t0) * g0) / (g0 - g1);
};
