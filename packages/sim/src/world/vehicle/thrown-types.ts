import type { Vec3 } from "@seki/core";

/*
 * The state of a taken car's driver (ADR-0097), kept apart from
 * the code that plays them so the entity's components need no import from the systems' side
 * (dependency-cruiser's no-circular).
 */

/** A driver out of a taken car, the clip time of its phase and the car it came from (`ejected-driver.ts`). */
export interface EjectedDriver {
  phase: "pulled" | "thrown" | "down" | "getup" | "run";
  /** Seconds into the phase's clip (or the phase, for `down` and `run`). */
  t: number;
  /** The car's heading when taken. */
  readonly yaw: number;
  /** The driver's hips in the seat, then the spot on the road it is thrown from. */
  spot: Vec3;
  readonly floor: number;
  /** The way he runs (a unit vector on the ground), once up. */
  away?: { x: number; z: number };
}
