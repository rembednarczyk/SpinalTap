import { Vector3 } from "../babylon";

/**
 * Clipping a cloth shell to its outline (G-870): triangles cut along the edges of a plate instead
 * of kept or dropped whole, so the plate has straight edges and not the cloth's teeth. A point of
 * a clipped triangle is a blend of the source vertices; its position, normal and skin weights are
 * blended the same way when the shell is written.
 */

/** Source vertex indices and their shares, summing to 1. */
export type Blend = readonly (readonly [number, number])[];

/** The half-space `normal · p + d >= 0` of world positions. */
export interface Plane {
  readonly normal: Vector3;
  readonly d: number;
}

const side = (plane: Plane, p: Vector3): number => Vector3.Dot(plane.normal, p) + plane.d;

/** `a` and `b` mixed, `t` of the way to `b`. */
const mix = (a: Blend, b: Blend, t: number): Blend => {
  const out = new Map<number, number>();
  for (const [i, w] of a) out.set(i, (out.get(i) ?? 0) + w * (1 - t));
  for (const [i, w] of b) out.set(i, (out.get(i) ?? 0) + w * t);
  return [...out];
};

/** The part of a convex polygon inside every plane (Sutherland-Hodgman); `at` is a blend's world position. */
export const clipPolygon = (polygon: readonly Blend[], planes: readonly Plane[], at: (b: Blend) => Vector3): Blend[] => {
  let poly: Blend[] = [...polygon];
  for (const plane of planes) {
    if (poly.length < 3) return [];
    const next: Blend[] = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]!;
      const b = poly[(k + 1) % poly.length]!;
      const sa = side(plane, at(a));
      const sb = side(plane, at(b));
      if (sa >= 0) next.push(a);
      if (sa >= 0 !== sb >= 0) next.push(mix(a, b, sa / (sa - sb)));
    }
    poly = next;
  }
  return poly.length < 3 ? [] : poly;
};

/**
 * The strongest bone influences of a blend, `slots` of them, scaled to sum to 1, from the source's
 * bone indices and weights (four per vertex, and four more in the extra buffers when there are).
 */
export const blendSkin = (b: Blend, indices: ArrayLike<number>, weights: ArrayLike<number>, extra: { indices: ArrayLike<number>; weights: ArrayLike<number> } | null, slots: number): { bones: number[]; weights: number[] } => {
  const sum = new Map<number, number>();
  const add = (bones: ArrayLike<number>, ws: ArrayLike<number>, i: number, share: number) => {
    for (let k = 0; k < 4; k++) {
      const w = ws[i * 4 + k] ?? 0;
      if (w > 0) sum.set(bones[i * 4 + k]!, (sum.get(bones[i * 4 + k]!) ?? 0) + w * share);
    }
  };
  for (const [i, share] of b) {
    add(indices, weights, i, share);
    if (extra) add(extra.indices, extra.weights, i, share);
  }
  const top = [...sum].sort((x, y) => y[1] - x[1]).slice(0, slots);
  const total = top.reduce((s, [, w]) => s + w, 0) || 1;
  const bones = Array.from({ length: slots }, (_, k) => top[k]?.[0] ?? 0);
  return { bones, weights: Array.from({ length: slots }, (_, k) => (top[k]?.[1] ?? 0) / total) };
};
