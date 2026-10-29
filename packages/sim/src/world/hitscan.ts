import type { CameraMode, EntityId, HitZone, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import { type Aabb, rayAabb } from "./collision";
import { groundOf } from "./ground";
import { solidIndexOf } from "./solid-index";
import { raySolidEntity } from "./solids";
import type { Entity } from "./components";
import { bodyHeightOf, crouchOf, rayHitboxes } from "./hitboxes";

export interface HitscanResult {
  readonly distance: number;
  readonly point: Vec3;
  readonly entity: Entity | null;
  /** Body part hit; null when the ray hit geometry or nothing. */
  readonly zone: HitZone | null;
}

/** Hitboxes reach a little outside the collision footprint (arms, knees while crouched). */
const BROAD_MARGIN = 0.12;

/** Box around every hitbox of a character, for a cheap early out. Lower while crouched. */
export const bodyAabb = (e: Entity): Aabb | null => {
  if (!e.body) return null;
  const r = e.body.radius + BROAD_MARGIN;
  return {
    min: { x: e.position.x - r, y: e.position.y, z: e.position.z - r },
    max: { x: e.position.x + r, y: e.position.y + bodyHeightOf(e), z: e.position.z + r },
  };
};

/**
 * Distance along a ray to the first static geometry: solids (boxes, slopes, prisms) and the
 * terrain (ADR-0043), or null within `maxDist`.
 */
export const rayGeometry = (world: World<Entity>, origin: Vec3, dir: Vec3, maxDist: number): number | null => {
  let best = maxDist;
  let hit = false;
  const end = { x: origin.x + dir.x * maxDist, y: 0, z: origin.z + dir.z * maxDist };
  // The nearest hit does not depend on the order: the index hands over the solids along the ray.
  for (const e of solidIndexOf(world).alongSegment(origin, end)) {
    const t = raySolidEntity(origin, dir, e, best);
    if (t !== null && t < best) {
      best = t;
      hit = true;
    }
  }
  const t = groundOf(world).rayHit(origin, dir, best);
  if (t !== null && t < best) return t;
  return hit ? best : null;
};

/** Casts a ray against static geometry and character bodies. Returns the nearest hit, or the ray end. */
export const hitscan = (world: World<Entity>, origin: Vec3, dir: Vec3, maxDist: number, ignore: EntityId): HitscanResult => {
  let best = rayGeometry(world, origin, dir, maxDist) ?? maxDist;
  let hitEntity: Entity | null = null;
  let zone: HitZone | null = null;
  for (const e of world.with("body", "health")) {
    if (e.id === ignore) continue;
    const box = bodyAabb(e);
    if (!box || rayAabb(origin, dir, box, best) === null) continue;
    const hit = rayHitboxes(e, origin, dir, best);
    if (hit && hit.distance < best) {
      best = hit.distance;
      hitEntity = e;
      zone = hit.zone;
    }
  }
  return {
    distance: best,
    entity: hitEntity,
    zone,
    point: { x: origin.x + dir.x * best, y: origin.y + dir.y * best, z: origin.z + dir.z * best },
  };
};

/** True when nothing static (solids, and the terrain unless `terrain` is false) blocks the segment between two points. */
export const lineOfSight = (world: World<Entity>, from: Vec3, to: Vec3, terrain = true): boolean => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  for (const e of solidIndexOf(world).alongSegment(from, to)) {
    if (raySolidEntity(from, dir, e, len) !== null) return false;
  }
  return !terrain || groundOf(world).rayHit(from, dir, len) === null;
};

export const EYE_HEIGHT = 1.62;
/** Eye height fully crouched; matches the crouch pose of the rig. */
export const CROUCH_EYE_HEIGHT = 1.14;
const CHEST_HEIGHT = 1.25;

/** Eye height for a crouch amount (0 standing .. 1 crouched). The camera uses the same curve. */
export const eyeHeightAt = (crouch: number): number => EYE_HEIGHT + (CROUCH_EYE_HEIGHT - EYE_HEIGHT) * Math.min(1, Math.max(0, crouch));

export const eyeOf = (e: Entity): Vec3 => ({ x: e.position.x, y: e.position.y + eyeHeightAt(crouchOf(e)), z: e.position.z });

/** Centre of the torso, where AI aims; lower while crouched. */
export const chestOf = (e: Entity): Vec3 => {
  const scale = e.body ? bodyHeightOf(e) / e.body.height : 1;
  return { x: e.position.x, y: e.position.y + CHEST_HEIGHT * scale, z: e.position.z };
};

/**
 * Over-the-shoulder offset of the TPP camera. The camera sits on the aim ray, so the crosshair
 * stays exact. At eye height, low over the right shoulder (ADR-0049; 0.12 m higher before).
 */
export const TPP_SHOULDER_OFFSET = 0.55;
export const TPP_HEIGHT_OFFSET = 0;

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
