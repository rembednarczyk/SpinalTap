import type { Vec3 } from "../math/vec3";
import type { GarmentLook, GarmentSlot, Rarity, WeaponLook, WeaponSlot } from "../items/types";

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
  /**
   * 0 from the hip .. 1 aimed (ADR-0019): the player's eased aim down sights, an NPC's 1 while
   * it fights. Absent means 0.
   */
  readonly aim?: number;
  /** Field of view multiplier at full aim for the weapon in hand (the camera zooms by it). */
  readonly aimZoom?: number;
  /** 1 while guarding with a melee weapon. Absent means 0. */
  readonly guard?: number;
  /**
   * Vertical speed in m/s while airborne (a jump or a fall, ADR-0021); absent on the ground.
   * The rig tucks the legs on the way up, reaches for the ground on the way down and dips
   * on landing.
   */
  readonly air?: number;
  /** Climbing speed in m/s (positive up) while on a ladder (ADR-0021); absent otherwise. */
  readonly climb?: number;
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
      /** A ramp, stairs or a stair railing: the top slopes instead of being flat (ADR-0020). */
      readonly slope?: Slope;
      /**
       * Drawn as a ladder of this many rungs (ADR-0021): two side rails along the block's
       * height and rungs across its wider horizontal side. Not walkable; the ladder is climbed.
       */
      readonly rungs?: number;
    }
  | {
      readonly kind: "neon";
      readonly size: Vec3;
      readonly color: string;
      readonly label?: string;
    }
  | { readonly kind: "lamp"; readonly color: string }
  /** A bag dropped by a defeated enemy (ADR-0015). `best` is the rarest item inside, for the neon strip. */
  | { readonly kind: "loot"; readonly style: "bag"; readonly best: Rarity | null };

/**
 * Sloped top of a block (ADR-0020): it rises linearly along `axis` towards `dir`, from
 * `low` above the block's bottom at the low end to the full height at the high end.
 * `steps` > 0 draws it as that many stairs; the walkable surface is still the ramp.
 */
export interface Slope {
  readonly axis: "x" | "z";
  readonly dir: 1 | -1;
  readonly low: number;
  readonly steps?: number;
}

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
  | { readonly kind: "weapon"; readonly entityId: EntityId; readonly drawn: boolean; readonly slot?: WeaponSlot }
  /** The entity started reloading; the animation should last `duration` seconds. */
  | { readonly kind: "reload"; readonly entityId: EntityId; readonly duration: number }
  /** A melee swing (ADR-0019): `strike` of the combo, landing after `windup`, then `recovery`. */
  | { readonly kind: "melee"; readonly entityId: EntityId; readonly strike: number; readonly windup: number; readonly recovery: number }
  /** Knocked off balance for `duration` seconds. */
  | { readonly kind: "stagger"; readonly entityId: EntityId; readonly duration: number }
  /** The entity's guard took a blow at `at`; `parried` for a perfect block. */
  | { readonly kind: "block"; readonly entityId: EntityId; readonly parried: boolean; readonly at: Vec3 }
  /**
   * Time of day changed (ADR-0017). `daylight` is 0 at night and 1 by day; `hour` is the
   * fractional hour 0–24, for presentation that wants more than the light level. Not
   * short-lived: the latest one holds until the next.
   */
  | { readonly kind: "time-of-day"; readonly daylight: number; readonly hour: number };

/**
 * What a character wears and carries (ADR-0015): weapons per slot (the active one in hand,
 * the others stowed), garments per slot and visible implants. Built by `appearanceOf` in core.
 */
export interface AppearanceDescriptor {
  readonly weapons: {
    readonly primary: WeaponLook | null;
    readonly secondary: WeaponLook | null;
    readonly melee: WeaponLook | null;
    readonly active: WeaponSlot;
  };
  readonly garments: Readonly<Partial<Record<GarmentSlot, GarmentLook>>>;
  readonly implants: readonly ("optics" | "arms")[];
}

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
  | "overdrive"
  // Weapons, loot and trade (ADR-0015, E12).
  | "reload"
  | "weapon-switch"
  | "loot-pickup"
  | "sell"
  | "repair"
  // Melee (ADR-0019).
  | "swing"
  | "block"
  | "parry"
  // Jumps, landings and ladders (ADR-0021).
  | "jump"
  | "land"
  | "land-hard";
