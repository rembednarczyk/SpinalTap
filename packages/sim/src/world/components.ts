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
}

export interface GangerAi {
  readonly home: Vec3;
  readonly aggroRange: number;
  readonly attackRange: number;
  /** Set once the ganger has noticed the player; never resets in M0. */
  alerted: boolean;
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
  interactable?: Interactable;
}
