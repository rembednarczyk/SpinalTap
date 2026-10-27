import type { Entity } from "./components";

/** An unguarded melee hit shoves the target back at this speed (m/s) for KNOCKBACK_TIME (ADR-0019). */
export const KNOCKBACK_SPEED = 2.6;
export const KNOCKBACK_TIME = 0.15;

/** Ground velocity of a knockback in progress, fading out over its time; zero without one. */
export const knockbackVelocity = (e: Entity): { x: number; z: number } => {
  const k = e.melee?.knock;
  if (!k || k.time <= 0) return { x: 0, z: 0 };
  const f = k.time / KNOCKBACK_TIME;
  return { x: k.x * f, z: k.z * f };
};
