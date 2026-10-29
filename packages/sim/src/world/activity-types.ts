import { type ActivityId, type GameClock, type Vec3, secondsSince } from "@seki/core";

/**
 * Vocabulary of routines and activities (ADR-0040). Kept free of the component file so the
 * schedule stops and the content tables can name it without a cycle.
 */

/**
 * What a character does at a stop: one activity, or a cycle of them that changes every
 * `minutes` game minutes from the start of the stop (a cook who sweeps between orders).
 */
export type ActivityPlan = ActivityId | { readonly cycle: readonly [ActivityId, ...ActivityId[]]; readonly minutes: number };

/** The activity of `plan` at the clock's time, counted from minute `from` of the day. A pure function of the clock. */
export const planActivity = (plan: ActivityPlan, clock: GameClock, from = 0): ActivityId => {
  if (typeof plan === "string") return plan;
  const step = Math.floor(secondsSince(clock, from) / 60 / Math.max(1, plan.minutes));
  return plan.cycle[step % plan.cycle.length] ?? plan.cycle[0];
};

/** Kinds of activity spots (smart spots) placed in the districts. */
export type SpotKind = "bench" | "wall" | "vending" | "stall" | "bar";

/** A place in a district where a passer-by stops and does something, facing `yaw`. */
export interface ActivitySpot {
  readonly id: string;
  readonly chunk: string;
  readonly kind: SpotKind;
  /** Where the feet stand. On the ground floor of the chunk. */
  readonly at: Vec3;
  readonly yaw: number;
  /** Narrows the kind's activities (nothing to lean on out on the quay). */
  readonly only?: readonly [ActivityId, ...ActivityId[]];
}

/**
 * A background passer-by (ADR-0040): unnamed, unkeyed and not saved. Where it goes is a pure
 * function of the seed, the clock and its index, so a loaded game puts it back on its routine.
 * The walking state below is transient.
 */
export interface Passerby {
  readonly chunk: string;
  readonly index: number;
  /** The spot of the current slot of its routine. */
  goal: Vec3;
  /** Facing at the spot. */
  yaw: number;
  /** What it does once there. */
  activity: ActivityId;
  /** Where it walks right now on the way (round an obstacle), and the seconds until it looks again. */
  waypoint: Vec3 | null;
  repath: number;
}
