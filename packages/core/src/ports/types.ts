import type { Vec3 } from "../math/vec3";

export type EntityId = number;

export type CameraMode = "FPP" | "TPP";

export interface Transform {
  readonly position: Vec3;
  /** Rotation around Y in radians. */
  readonly yaw: number;
  /** Look pitch in radians (only meaningful for the player). */
  readonly pitch: number;
  /** Horizontal speed in m/s, used by the presentation layer for procedural animation. */
  readonly speed: number;
  /**
   * 0 standing .. 1 fully crouched, eased by the simulation (ADR-0016). Drives the crouch pose
   * and the eye height. Absent means standing.
   */
  readonly crouch?: number;
}

/** What the presentation layer should build for an entity. Pure data, engine-agnostic. */
export type ViewDescriptor =
  | { readonly kind: "heroine" }
  | { readonly kind: "npc"; readonly preset: "fixer" | "civilian" | "ripperdoc" }
  | { readonly kind: "enemy"; readonly preset: "ganger" }
  | {
      readonly kind: "block";
      readonly size: Vec3;
      readonly material: "concrete" | "metal" | "asphalt" | "glass";
    }
  | {
      readonly kind: "neon";
      readonly size: Vec3;
      readonly color: string;
      readonly label?: string;
    }
  | { readonly kind: "lamp"; readonly color: string };

/** Why a view goes away: killed or otherwise removed from the world, or streamed out with its chunk. */
export type DespawnReason = "removed" | "unloaded";

/** Short-lived presentation effects triggered by domain events. */
export type EffectDescriptor =
  | { readonly kind: "muzzle-flash"; readonly shooterId: EntityId; readonly from: Vec3; readonly to: Vec3 }
  | { readonly kind: "hit-spark"; readonly at: Vec3; readonly critical: boolean }
  | { readonly kind: "memory-glitch" }
  | { readonly kind: "overdrive"; readonly active: boolean }
  | { readonly kind: "heal" }
  /** The entity was hit: short recoil of the body. */
  | { readonly kind: "flinch"; readonly entityId: EntityId }
  /** The entity holstered its weapon or started drawing it. */
  | { readonly kind: "weapon"; readonly entityId: EntityId; readonly drawn: boolean };

export type AudioCue =
  | "shot"
  | "enemy-shot"
  | "hit"
  | "critical"
  | "hurt"
  | "kill"
  | "ui-select"
  | "quest-update"
  | "memory"
  | "save"
  | "purchase"
  | "denied"
  | "heal"
  | "overdrive";
