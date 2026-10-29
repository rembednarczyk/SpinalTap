import type { Slope, Vec3 } from "@seki/core";
import { type Aabb, overFootprint, rayAabb, raySolid, resolveCircleAabb, topAt } from "./collision";
import type { Entity } from "./components";
import { type Prism, circleTouchesPrism, closestOnPrism, overPrism, rayPrism, resolveCirclePrism } from "./prism";

/**
 * One piece of geometry a body collides with (ADR-0043): a solid's box (with its sloped top,
 * ADR-0020), or one convex prism of a solid made of prisms. `box` is the broad phase either way.
 * The box paths are the code of before, step for step, so a world without prisms moves the same.
 */
export interface Collider {
  readonly box: Aabb;
  readonly slope: Slope | undefined;
  readonly prism: Prism | null;
}

export type SolidEntity = Entity & { solid: Aabb };

/** The colliders of solids, in the solids' order (a prism solid gives its parts in their order). */
export const collidersOf = (solids: readonly SolidEntity[]): Collider[] => {
  const out: Collider[] = [];
  for (const s of solids) {
    if (s.prisms) for (const p of s.prisms) out.push({ box: p.box, slope: undefined, prism: p });
    else out.push({ box: s.solid, slope: s.slope, prism: null });
  }
  return out;
};

/** Point of the collider's footprint closest to (x, z), written into `out`. */
export const closestXZ = (c: Collider, x: number, z: number, out: { x: number; z: number }): { x: number; z: number } => {
  if (c.prism) return closestOnPrism(c.prism, x, z, out);
  out.x = Math.max(c.box.min.x, Math.min(x, c.box.max.x));
  out.z = Math.max(c.box.min.z, Math.min(z, c.box.max.z));
  return out;
};

/** Height of the top at a point of the footprint. */
export const colliderTop = (c: Collider, x: number, z: number): number => (c.prism ? c.prism.top : topAt(c.box, c.slope, x, z));

/** True when (x, z) is on the footprint, grown by `margin`. */
export const overCollider = (c: Collider, x: number, z: number, margin = 0): boolean =>
  overFootprint(c.box, x, z, margin) && (!c.prism || overPrism(c.prism, x, z, margin));

/** Does a circle touch the footprint? */
export const circleTouches = (c: Collider, x: number, z: number, radius: number, near: { x: number; z: number }): boolean => {
  const b = c.box;
  if (x < b.min.x - radius || x > b.max.x + radius || z < b.min.z - radius || z > b.max.z + radius) return false;
  if (c.prism) {
    if (!circleTouchesPrism(c.prism, x, z, radius)) return false;
    closestOnPrism(c.prism, x, z, near);
    return true;
  }
  closestXZ(c, x, z, near);
  const dx = x - near.x;
  const dz = z - near.z;
  return dx * dx + dz * dz < radius * radius;
};

/** Pushes a circle out of the footprint. */
export const pushCircleOut = (c: Collider, x: number, z: number, radius: number): { x: number; z: number } =>
  c.prism ? resolveCirclePrism(x, z, radius, c.prism) : resolveCircleAabb(x, z, radius, c.box);

/** Distance along a ray to the collider, or null. */
export const rayCollider = (origin: Vec3, dir: Vec3, c: Collider, maxDist: number): number | null => {
  if (!c.prism) return raySolid(origin, dir, c.box, c.slope, maxDist);
  return rayPrism(origin, dir, c.prism, maxDist);
};

/** Distance along a ray to a solid entity (its box, or the nearest of its prisms behind the box test), or null. */
export const raySolidEntity = (origin: Vec3, dir: Vec3, e: SolidEntity, maxDist: number): number | null => {
  if (!e.prisms) return raySolid(origin, dir, e.solid, e.slope, maxDist);
  if (rayAabb(origin, dir, e.solid, maxDist) === null) return null;
  let best: number | null = null;
  for (const p of e.prisms) {
    const t = rayPrism(origin, dir, p, best ?? maxDist);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
};
