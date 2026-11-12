/**
 * Computational geometry on the ground plane (x east, z north), the one copy in the project:
 * the foot of the perpendicular on a segment and the distance to it, the signed area of a ring
 * (shoelace formula), the point-in-ring test (crossing number, even-odd rule) and a polyline
 * moved aside. In the spirit of turf's `nearestPointOnLine`, `pointToLineDistance`, `area` and
 * `booleanPointInPolygon`; points come as `{ x, z }` or as `[x, z]` pairs, hot loops take scalars.
 */

/** A point on the ground plane (any `{ x, z }`, a `GroundPoint` or a `Vec3`). */
export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

/** A point on the ground plane as an `[x, z]` pair. */
export type PairXZ = readonly [number, number];

/**
 * Where the foot of the perpendicular from (px, pz) falls on the segment a-b: the orthogonal
 * projection's parameter along a→b, clamped to [0, 1] (the foot is `a + (b - a) * t`). A segment
 * whose squared length is 0, or below `minLen2`, gives 0, its end `a`.
 */
export const segmentParam = (px: number, pz: number, ax: number, az: number, bx: number, bz: number, minLen2 = 0): number => {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  return len2 < minLen2 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len2 || 1)));
};

/**
 * Distance from (px, pz) to the segment a-b: to the foot at `segmentParam`, so a segment whose
 * squared length is 0, or below `minLen2`, counts as its end `a`.
 */
export const segmentDistance = (px: number, pz: number, ax: number, az: number, bx: number, bz: number, minLen2 = 0): number => {
  const t = segmentParam(px, pz, ax, az, bx, bz, minLen2);
  return Math.hypot(px - (ax + (bx - ax) * t), pz - (az + (bz - az) * t));
};

/**
 * Signed area of a ring by the shoelace (Gauss) formula: positive when it runs counter-clockwise
 * seen with x to the right and z up. A closing point equal to the first adds nothing.
 */
export const signedArea = (ring: readonly PointXZ[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as PointXZ;
    const b = ring[(i + 1) % ring.length] as PointXZ;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};

/**
 * Is (x, z) inside the ring? Crossing number (ray casting towards +x) with the even-odd rule, so
 * a self-crossing ring's doubly wound part is outside. An edge counts for the ray when one end
 * is above z and the other at or below it (half-open in z), and the crossing when x lies
 * strictly left of it: a point on a left or bottom edge is inside, on a right or top edge
 * outside. A ring may be open or closed (a repeated first point is a level edge, never counted).
 */
export const pointInRingEvenOdd = (x: number, z: number, ring: readonly PointXZ[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as PointXZ;
    const b = ring[j] as PointXZ;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** `pointInRingEvenOdd` for a ring of `[x, z]` pairs: the same rule on the same edges. */
export const pointInPairRingEvenOdd = (x: number, z: number, ring: readonly PairXZ[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i] as PairXZ;
    const [bx, bz] = ring[j] as PairXZ;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
};

/**
 * Unit direction of a polyline at its point `i`: along the chord from the point before to the
 * point after (central difference; at an end, its segment). Zero length gives the raw vector.
 */
export const polylineTangent = (pts: readonly PairXZ[], i: number): [number, number] => {
  const a = pts[Math.max(0, i - 1)] as PairXZ;
  const b = pts[Math.min(pts.length - 1, i + 1)] as PairXZ;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
};

/**
 * The polyline moved `off` metres to its right (heading north, right is east), each point along
 * the normal of its `polylineTangent`: no mitre, so a sharp corner's offset is not `off` from
 * both its segments. A negative `off` moves it left.
 */
export const offsetPolylineRight = (pts: readonly PairXZ[], off: number): [number, number][] =>
  pts.map((p, i) => {
    const [tx, tz] = polylineTangent(pts, i);
    return [p[0] + tz * off, p[1] - tx * off];
  });
