import type { EntityId, FactionId, Health, Vec3, ViewDescriptor } from "@seki/core";
import type { Aabb } from "./collision";

export interface CharacterBody {
  readonly radius: number;
  readonly height: number;
}

export interface Combatant {
  weapon: "pistol" | "gangerSmg";
  /** Seconds until the next shot is allowed. */
  cooldown: number;
  /** Weapon put away: no shots until drawn again. Presentation-only otherwise; not saved. */
  holstered: boolean;
  /** Seconds left of the draw; shots wait for it. */
  drawing: number;
}

export interface GangerAi {
  readonly home: Vec3;
  readonly aggroRange: number;
  readonly attackRange: number;
  /**
   * Set once the ganger has decided to fight the player; never resets. Gangers friendly to
   * the player only set it when provoked (gunfire nearby or a hit).
   */
  alerted: boolean;
}

/** A bystander that keeps to its spot and runs from a player the street fears. Stateless by design. */
export interface CivilianAi {
  readonly home: Vec3;
}

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

export interface Interactable {
  readonly kind: "dialogue" | "shop";
  readonly dialogueId: string;
  readonly prompt: string;
  readonly radius: number;
}

/**
 * One ECS entity. Components are optional fields; systems query the ones they need.
 * Hot-path components are mutated in place for performance (see ADR-0002).
 */
export interface Entity {
  readonly id: EntityId;
  /** Stable identity across saves. Only dynamic entities have one. */
  key?: string;
  /** Quest tag reported in EntityKilled. */
  tag?: string;
  /** Streaming chunk the entity belongs to; it leaves the world when that chunk unloads. */
  chunk?: string;
  position: Vec3;
  prevPosition: Vec3;
  yaw: number;
  prevYaw: number;
  pitch: number;
  velocity?: Vec3;
  view?: ViewDescriptor;
  /** Static geometry: collides and blocks line of sight, never moves. */
  solid?: Aabb;
  body?: CharacterBody;
  player?: true;
  health?: Health;
  faction?: FactionId;
  combatant?: Combatant;
  ai?: GangerAi;
  civilian?: CivilianAi;
  schedule?: Scheduled;
  interactable?: Interactable;
}
