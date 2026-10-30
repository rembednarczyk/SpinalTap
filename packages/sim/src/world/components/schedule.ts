import type { Vec3 } from "@seki/core";
import type { ActivityPlan } from "../activity-types";
import type { Interactable } from "./interaction";

/**
 * One entry of a daily plan. From minute `at` of the day the NPC walks `path` in order,
 * starting where the previous stop left it, and then stays at the last point facing `yaw`.
 * A patrol (`loop`) instead keeps walking `path` as a closed loop until the next stop.
 */
export interface ScheduleStop {
  /** Short name for tests and debugging ("stragan", "dom", "patrol"). */
  readonly label: string;
  /** Minute of the day (0–1439) the NPC sets off. */
  readonly at: number;
  /** Straight-line waypoints; together with the previous stop they must stay clear of solids. */
  readonly path: readonly [Vec3, ...Vec3[]];
  /** Facing once the NPC stands at its stop. */
  readonly yaw: number;
  readonly loop?: true;
  /**
   * What talking to the NPC means while this stop is current: an interaction that replaces
   * the NPC's own (e.g. a closed stall), or null for none. Omitted: the NPC's own.
   */
  readonly interaction?: Interactable | null;
  /** What the NPC does once it stands at the stop (ADR-0040); omitted: it just stands. */
  readonly activity?: ActivityPlan;
}

/** A daily plan: stops sorted by `at`, repeated every day. The day wraps from the last stop to the first. */
export interface ScheduleDef {
  readonly stops: readonly [ScheduleStop, ...ScheduleStop[]];
  /** Walking speed along the path, metres per real second. */
  readonly speed: number;
}

/** Where the plan wants the NPC right now. A pure function of the plan and the clock. */
export interface SchedulePose {
  readonly stop: number;
  readonly position: Vec3;
  /** Direction of travel while walking; the stop's facing once there. */
  readonly heading: number;
  /** Standing at its stop (not walking, not patrolling). */
  readonly arrived: boolean;
}

/**
 * A daily plan (see schedule.ts). Stateless like the rest of the AI: the pose is recomputed
 * from the clock every step, so nothing of it is saved.
 */
export interface Scheduled {
  readonly def: ScheduleDef;
  /** The NPC's own interaction; a stop may replace it while it is current. */
  readonly own: Interactable | null;
  /** Where the plan wants the NPC this step; null until the schedule system first runs. */
  pose: SchedulePose | null;
}
