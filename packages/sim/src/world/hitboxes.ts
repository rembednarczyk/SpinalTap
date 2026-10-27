import type { HitZone, Vec3 } from "@seki/core";
import { type Aabb, rayAabb } from "./collision";
import type { Entity } from "./components";

/** Height of a crouched body as a share of the standing one (1.8 m -> 1.26 m). */
export const CROUCH_BODY_SCALE = 0.7;

/** Standing body height the zone table below is drawn for. */
const REFERENCE_HEIGHT = 1.8;

/**
 * One body part as a box in the entity's local frame: x to its right, y up from the feet,
 * z forward. Heights are shares of the body height; widths are metres at 1.8 m. `crouchZ`
 * shifts the box forward when fully crouched (knees and a leaning torso come forward).
 */
interface ZoneBox {
  readonly zone: HitZone;
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly z: readonly [number, number];
  readonly crouchZ: readonly [number, number];
}

/** Checked in this order; on equal distances the earlier zone wins (head before torso). */
export const ZONE_BOXES: readonly ZoneBox[] = [
  { zone: "head", x: [-0.12, 0.12], y: [0.875, 1], z: [-0.12, 0.12], crouchZ: [0.08, 0.08] },
  { zone: "torso", x: [-0.2, 0.2], y: [0.5, 0.875], z: [-0.13, 0.13], crouchZ: [0.06, 0.06] },
  { zone: "arm", x: [-0.32, -0.2], y: [0.45, 0.83], z: [-0.1, 0.1], crouchZ: [0.06, 0.06] },
  { zone: "arm", x: [0.2, 0.32], y: [0.45, 0.83], z: [-0.1, 0.1], crouchZ: [0.06, 0.06] },
  { zone: "leg", x: [-0.19, -0.01], y: [0, 0.5], z: [-0.11, 0.11], crouchZ: [0, 0.3] },
  { zone: "leg", x: [0.01, 0.19], y: [0, 0.5], z: [-0.11, 0.11], crouchZ: [0, 0.3] },
];

/** 0 standing .. 1 fully crouched. */
export const crouchOf = (e: Entity): number => e.posture?.amount ?? 0;

/** Current body height: lower while crouched. */
export const bodyHeightOf = (e: Entity): number => (e.body ? e.body.height * (1 - (1 - CROUCH_BODY_SCALE) * crouchOf(e)) : 0);

/** Local hitbox of one zone for a body of standing height `height` at crouch `crouch`. */
export const zoneBox = (box: ZoneBox, height: number, crouch: number): Aabb => {
  const w = height / REFERENCE_HEIGHT;
  const h = height * (1 - (1 - CROUCH_BODY_SCALE) * crouch);
  return {
    min: { x: box.x[0] * w, y: box.y[0] * h, z: (box.z[0] + box.crouchZ[0] * crouch) * w },
    max: { x: box.x[1] * w, y: box.y[1] * h, z: (box.z[1] + box.crouchZ[1] * crouch) * w },
  };
};

/** Turns a world-space point or direction into the entity's local frame (yaw only). */
const toLocal = (v: Vec3, yaw: number, origin: Vec3 | null): Vec3 => {
  const x = origin ? v.x - origin.x : v.x;
  const y = origin ? v.y - origin.y : v.y;
  const z = origin ? v.z - origin.z : v.z;
  // Forward = (sin, cos), right = (cos, -sin), as in player control.
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: x * c - z * s, y, z: x * s + z * c };
};

export interface ZoneHit {
  readonly distance: number;
  readonly zone: HitZone;
}

/**
 * Nearest body part a ray hits within `maxDist`, or null when it passes by (between the legs,
 * past an arm). Boxes are oriented by the entity's yaw and squashed while it crouches.
 */
export const rayHitboxes = (e: Entity, origin: Vec3, dir: Vec3, maxDist: number): ZoneHit | null => {
  if (!e.body) return null;
  const o = toLocal(origin, e.yaw, e.position);
  const d = toLocal(dir, e.yaw, null);
  const crouch = crouchOf(e);
  let best: ZoneHit | null = null;
  for (const box of ZONE_BOXES) {
    const t = rayAabb(o, d, zoneBox(box, e.body.height, crouch), best?.distance ?? maxDist);
    if (t !== null && (!best || t < best.distance)) best = { distance: t, zone: box.zone };
  }
  return best;
};
