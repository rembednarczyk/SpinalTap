import type { EnemyTypeId, EntityId, FactionId, Health, Vec3, ViewDescriptor, WeaponId, WeaponSlot, WeaponStats } from "@seki/core";
import type { Aabb } from "./collision";

export interface CharacterBody {
  readonly radius: number;
  readonly height: number;
}

/**
 * Weapon state of a character (ADR-0015). For the player the domain is the source of truth
 * (equipment, the weapon instance and its loaded rounds, the ammo pouch); `weapon`, `uid` and
 * `stats` are a cache that `syncPlayerWeapon` refreshes every step. NPCs keep everything here.
 */
export interface Combatant {
  /** Weapon in the active slot, null when that slot is empty. */
  weapon: WeaponId | null;
  /** Its effective stats (the player's with rarity and mods, NPCs' from the `npc` profile). */
  stats: WeaponStats | null;
  /** The player's active weapon instance; undefined before the first sync, null for NPCs. */
  uid?: string | null;
  slot: WeaponSlot;
  /** Rounds in the magazine of an NPC. Not saved: NPC magazines come back full. */
  loaded: number;
  /** Seconds left of a reload step, 0 when not reloading. Not saved. */
  reloading: number;
  /** Seconds until the next shot is allowed. */
  cooldown: number;
  /** Weapon put away: no shots until drawn again. Presentation-only otherwise; not saved. */
  holstered: boolean;
  /** Seconds left of the draw; shots wait for it. */
  drawing: number;
  /** Extra spread from recent shots in radians; recovers over time. Not saved (ADR-0016). */
  bloom: number;
}

/**
 * How the character holds itself (ADR-0016). Transient like the holster: not saved, a loaded
 * game starts standing.
 */
export interface Posture {
  /** Wants to crouch (the input is held). */
  crouched: boolean;
  /** 0 standing .. 1 fully crouched, eased towards `crouched` over CROUCH_TIME. */
  amount: number;
  /** `amount` at the previous step, for interpolated rendering. */
  prevAmount: number;
  /** Sprinting this step (widens the aim cone). */
  sprinting: boolean;
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
  /**
   * Key of the NPC this ganger was sent to kill (a protection job's wave). It goes for the
   * victim, and turns on the player only once alerted and with the player in sight and range.
   */
  readonly victim?: string;
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
  /**
   * "pickup": taken on the spot (a contract crate); no conversation opens. "loot": a bag;
   * `dialogueId` is then the container key.
   */
  readonly kind: "dialogue" | "shop" | "pickup" | "loot";
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
  posture?: Posture;
  player?: true;
  health?: Health;
  /** Who dealt the last damage. Transient (never saved): death is resolved in the same step. */
  lastHitBy?: EntityId;
  faction?: FactionId;
  combatant?: Combatant;
  ai?: GangerAi;
  /** Enemy type (ADR-0015): weapon, outfit and loot table come from it. */
  enemy?: { readonly type: EnemyTypeId };
  civilian?: CivilianAi;
  schedule?: Scheduled;
  interactable?: Interactable;
  /** A bag in the world; its contents live in `domain.loot` under this key. */
  lootBag?: { readonly key: string };
}
