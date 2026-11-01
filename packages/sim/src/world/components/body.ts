import type { WeaponId, WeaponSlot, WeaponStats } from "@seki/core";

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
  /** An NPC that is fighting this step holds its weapon up (presentation only, not saved). */
  engaged?: boolean;
}

/**
 * Melee state of a combatant (ADR-0019): the swing in progress, the combo, the guard and
 * stagger. Transient like the holster and the bloom: not saved, a loaded game starts idle.
 */
export interface MeleeState {
  /** "windup": the swing is on its way and lands when `timer` runs out; "recovery": it landed. */
  phase: "idle" | "windup" | "recovery";
  /** Seconds left of the phase. */
  timer: number;
  /** Index of the current (or last) strike in the weapon's combo. */
  strike: number;
  /** Seconds left in which the next swing continues the combo. */
  combo: number;
  /** The attack button was held during recovery: the next swing starts right after it. */
  queued: boolean;
  /** Seconds left staggered: no swing, no guard, no shot, slow feet. */
  stagger: number;
  /** The stagger is a parry's stun (ADR-0065: open to a takedown from any side while it lasts). */
  stunned?: boolean;
  /** Guard up (the aim button with a melee weapon). */
  guard: boolean;
  /** Seconds left of the parry window opened by raising the guard. */
  parry: number;
  /** Seconds until raising the guard opens a parry window again. */
  parryCooldown: number;
  /** Knockback of an unguarded hit: ground velocity (m/s) for `time` more seconds. */
  knock: { x: number; z: number; time: number };
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
  /** Wants to aim down sights this step (ADR-0019). */
  aiming: boolean;
  /** 0 from the hip .. 1 fully aimed, eased over the weapon's `ads.time`. */
  aim: number;
  /** `aim` at the previous step, for interpolated rendering. */
  prevAim: number;
}
