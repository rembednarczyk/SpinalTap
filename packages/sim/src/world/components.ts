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
}

/** A bystander that keeps to its spot and runs from a player the street fears. Stateless by design. */
export interface CivilianAi {
  readonly home: Vec3;
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
  posture?: Posture;
  player?: true;
  health?: Health;
  faction?: FactionId;
  combatant?: Combatant;
  ai?: GangerAi;
  civilian?: CivilianAi;
  interactable?: Interactable;
}
