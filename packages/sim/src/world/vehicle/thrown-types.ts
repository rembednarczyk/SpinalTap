import type { Vec3 } from "@seki/core";

/*
 * The state of someone a car throws down and of a taken car's driver (ADR-0097), kept apart from
 * the code that plays them so the entity's components need no import from the systems' side
 * (dependency-cruiser's no-circular).
 */

/** On the road after a blow: the phase, its clip time, the figure's facing and where it lies (`struck.ts`). */
export interface Struck {
  phase: "thrown" | "down" | "getup";
  t: number;
  /** The figure's facing: the throw goes to its right. */
  readonly yaw: number;
  /** Where it was hit, then where it lies. */
  spot: Vec3;
}

/** A driver out of a taken car, the clip time of its phase and the car it came from (`ejected-driver.ts`). */
export interface EjectedDriver {
  /** Pulled out, then on the road (`struck`), then off at a run. */
  phase: "pulled" | "down" | "run";
  /** Seconds into the pull's clip, or into the run. */
  t: number;
  /** The car's heading when taken. */
  readonly yaw: number;
  /** The driver's hips in the seat. */
  spot: Vec3;
  readonly floor: number;
  /** The way he runs (a unit vector on the ground), once up. */
  away?: { x: number; z: number };
}
