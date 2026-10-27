import { type Vec3, normalize } from "../math/vec3";
import type { RandomPort } from "../ports/random-port";

/**
 * How wide a weapon's aim cone gets. All angles are half-angles of the cone in radians.
 * The shooter's state (stance, movement, recent shots) widens or narrows it.
 */
export interface SpreadProfile {
  /** Standing still, no bloom. */
  readonly base: number;
  /** Multiplier on `base` while crouched (below 1: crouching steadies the aim). */
  readonly crouch: number;
  /** Added at full walking speed; scales with the share of walk speed. */
  readonly move: number;
  /** Added on top of `move` while sprinting. */
  readonly sprint: number;
  /** Bloom added by every shot... */
  readonly bloomPerShot: number;
  /** ...up to this much... */
  readonly bloomMax: number;
  /** ...and recovered at this rate, radians per second. */
  readonly recovery: number;
}

export interface ShooterState {
  /** 0 standing .. 1 fully crouched; partway while getting up or down. */
  readonly crouch: number;
  /** Horizontal speed as a share of walk speed, 0..1 (higher values are clamped). */
  readonly moving: number;
  readonly sprinting: boolean;
  /** Current bloom in radians. */
  readonly bloom: number;
  /** Share of spread removed by implants, see `DerivedStats.aimStability`. */
  readonly aimStability: number;
  /** 0 from the hip .. 1 fully aimed down sights (ADR-0019); absent means from the hip. */
  readonly aim?: number;
  /** Multiplier on the whole cone at full aim (`AdsProfile.spread`); absent means 1. */
  readonly aimMultiplier?: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Half-angle of the aim cone in radians for a weapon in the given hands. */
export const spreadAngle = (profile: SpreadProfile, s: ShooterState): number => {
  const crouch = clamp01(s.crouch);
  const stance = 1 + (profile.crouch - 1) * crouch;
  const moving = clamp01(s.moving);
  // Moving while crouched is a slow, careful step: it costs less than walking upright.
  const motion = moving * profile.move * (1 - 0.5 * crouch) + (s.sprinting ? profile.sprint : 0);
  const raw = profile.base * stance + motion + Math.max(0, s.bloom);
  const ads = 1 + ((s.aimMultiplier ?? 1) - 1) * clamp01(s.aim ?? 0);
  return raw * ads * (1 - clamp01(s.aimStability));
};

/** Bloom after one more shot. */
export const addBloom = (profile: SpreadProfile, bloom: number): number => Math.min(profile.bloomMax, bloom + profile.bloomPerShot);

/** Bloom after `dt` seconds without shooting. */
export const recoverBloom = (profile: SpreadProfile, bloom: number, dt: number): number => Math.max(0, bloom - profile.recovery * dt);

/**
 * A direction inside the cone of half-angle `angle` around `dir`, uniform over the cone's cap.
 * Consumes exactly two random numbers whatever the angle, so the RNG stream stays aligned.
 */
export const sampleCone = (dir: Vec3, angle: number, rng: RandomPort): Vec3 => {
  const u = rng.next();
  const v = rng.next();
  const d = normalize(dir);
  if (angle <= 0) return d;
  const cosMax = Math.cos(angle);
  const cosT = 1 - u * (1 - cosMax);
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = v * Math.PI * 2;
  // Orthonormal basis around d; pick the helper axis least aligned with d.
  const helper = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const a = normalize({ x: helper.y * d.z - helper.z * d.y, y: helper.z * d.x - helper.x * d.z, z: helper.x * d.y - helper.y * d.x });
  const b = { x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x };
  const ca = Math.cos(phi) * sinT;
  const cb = Math.sin(phi) * sinT;
  return {
    x: d.x * cosT + a.x * ca + b.x * cb,
    y: d.y * cosT + a.y * ca + b.y * cb,
    z: d.z * cosT + a.z * ca + b.z * cb,
  };
};
