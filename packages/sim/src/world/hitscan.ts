import type { CameraMode, EntityId, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import { type Aabb, rayAabb } from "./collision";
import type { Entity } from "./components";

export interface HitscanResult {
  readonly distance: number;
  readonly point: Vec3;
  readonly entity: Entity | null;
}

export const bodyAabb = (e: Entity): Aabb | null =>
  e.body
    ? {
        min: { x: e.position.x - e.body.radius, y: e.position.y, z: e.position.z - e.body.radius },
        max: { x: e.position.x + e.body.radius, y: e.position.y + e.body.height, z: e.position.z + e.body.radius },
      }
    : null;

/** Casts a ray against static geometry and character bodies. Returns the nearest hit, or the ray end. */
export const hitscan = (world: World<Entity>, origin: Vec3, dir: Vec3, maxDist: number, ignore: EntityId): HitscanResult => {
  let best = maxDist;
  let hitEntity: Entity | null = null;
  for (const e of world.with("solid")) {
    const t = rayAabb(origin, dir, e.solid, best);
    if (t !== null && t < best) {
      best = t;
      hitEntity = null;
    }
  }
  for (const e of world.with("body", "health")) {
    if (e.id === ignore) continue;
    const box = bodyAabb(e);
    const t = box ? rayAabb(origin, dir, box, best) : null;
    if (t !== null && t < best) {
      best = t;
      hitEntity = e;
    }
  }
  return {
    distance: best,
    entity: hitEntity,
    point: { x: origin.x + dir.x * best, y: origin.y + dir.y * best, z: origin.z + dir.z * best },
  };
};

/** True when nothing static blocks the segment between two points. */
export const lineOfSight = (world: World<Entity>, from: Vec3, to: Vec3): boolean => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  for (const e of world.with("solid")) {
    if (rayAabb(from, dir, e.solid, len) !== null) return false;
  }
  return true;
};

export const EYE_HEIGHT = 1.62;

export const eyeOf = (e: Entity): Vec3 => ({ x: e.position.x, y: e.position.y + EYE_HEIGHT, z: e.position.z });

export const chestOf = (e: Entity): Vec3 => ({ x: e.position.x, y: e.position.y + 1.25, z: e.position.z });

/** Over-the-shoulder offset of the TPP camera. The camera sits on the aim ray, so the crosshair stays exact. */
export const TPP_SHOULDER_OFFSET = 0.55;
export const TPP_HEIGHT_OFFSET = 0.12;

/** Where the player's shots start: the eye in FPP, the camera shoulder line in TPP. */
export const aimOrigin = (e: Entity, mode: CameraMode): Vec3 => {
  const eye = eyeOf(e);
  if (mode === "FPP") return eye;
  return {
    x: eye.x + Math.cos(e.yaw) * TPP_SHOULDER_OFFSET,
    y: eye.y + TPP_HEIGHT_OFFSET,
    z: eye.z - Math.sin(e.yaw) * TPP_SHOULDER_OFFSET,
  };
};
