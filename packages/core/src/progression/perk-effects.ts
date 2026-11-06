import type { StatModifiers } from "../character/stats";
import { type PerkId, type PerkRanks, perkDef, perkRank } from "./perks";

/**
 * What the perks do (ADR-0059, stage 3). The stats go through `StatModifiers`; the rest are
 * scales and flags the systems read, as they read the implants' perks (ADR-0033). Without a
 * perk every scale is exactly 1 and every bonus 0, so a character without perks plays as before.
 */

/** The perk's effect at its bought rank: rank × `per`. */
const effect = (perks: PerkRanks, id: PerkId): number => perkRank(perks, id) * perkDef(id).per;

/** Is the perk bought (a one-rank perk read as a flag)? */
export const hasProgressionPerk = (perks: PerkRanks, id: PerkId): boolean => perkRank(perks, id) > 0;

/** What the perks do to the stats: health, melee damage, armor, aim, crit damage, clothes' armor. */
export const perkModifiers = (perks: PerkRanks): StatModifiers => ({
  maxHp: effect(perks, "might_tough"),
  meleeDamage: effect(perks, "might_brawler"),
  armor: effect(perks, "might_hardened"),
  aimStability: effect(perks, "reflex_steady"),
  critMultiplier: effect(perks, "reflex_deadeye"),
  garmentArmor: effect(perks, "tech_tailor"),
});

/** Multiplier of the guard's stamina coming back (Second Wind). */
export const staminaRegenScale = (perks: PerkRanks): number => 1 + effect(perks, "might_second_wind");

/** Multiplier of the stun a parry of the player's puts on the attacker (Crushing Parry: the takedown window). */
export const parryStunScale = (perks: PerkRanks): number => 1 + effect(perks, "might_crushing_parry");

/** Multiplier of the player's reload time (Quick Reload). */
export const reloadTimeScale = (perks: PerkRanks): number => 1 - effect(perks, "reflex_quick_reload");

/** Multiplier of the dash's cooldown (Slipstream). */
export const dashCooldownScale = (perks: PerkRanks): number => 1 - effect(perks, "reflex_slipstream");

/** Multiplier of what medkits, bandages and food heal (Field Medic). */
export const healScale = (perks: PerkRanks): number => 1 + effect(perks, "tech_field_medic");

/** Cyberware capacity the perks add (Overclock). */
export const perkCyberCapacity = (perks: PerkRanks): number => effect(perks, "tech_overclock");

/** Multiplier of the pace the active implant's cooldown runs down at (Coolant). */
export const abilityCooldownRate = (perks: PerkRanks): number => 1 + effect(perks, "tech_coolant");

/** Second Heart: the share of maximum health a lethal blow leaves, once per SECOND_HEART_COOLDOWN; 0 without it. */
export const secondHeartShare = (perks: PerkRanks): number => effect(perks, "tech_second_heart");
export const SECOND_HEART_COOLDOWN = 120;

/** RAM the perks add to the pool (Buffer). */
export const perkRam = (perks: PerkRanks): number => effect(perks, "net_buffer");

/** Multiplier of a quickhack's upload time from the perks (Fast Upload). */
export const perkUploadScale = (perks: PerkRanks): number => 1 - effect(perks, "net_fast_upload");

/** Multiplier of the RAM regeneration (Recycler). */
export const ramRegenScale = (perks: PerkRanks): number => 1 + effect(perks, "net_recycler");

/** Multiplier of the pace a camera fills its spot meter at (Ghost Signal). */
export const cameraSpotScale = (perks: PerkRanks): number => 1 - effect(perks, "net_ghost_signal");

/** Chain: metres from the target in which a quickhack also lands on the next target of its kind; 0 without it. */
export const chainRadius = (perks: PerkRanks): number => effect(perks, "net_chain");

/** Multiplier of the noise the player's steps and landings make (Soft Steps). */
export const noiseScale = (perks: PerkRanks): number => 1 - effect(perks, "shadow_soft_steps");

/** Multiplier of the time a takedown takes (Quick Takedown). */
export const takedownTimeScale = (perks: PerkRanks): number => 1 - effect(perks, "shadow_quick_takedown");

/** Share of the walk speed added while carrying a body (Mule). */
export const carrySpeedBonus = (perks: PerkRanks): number => effect(perks, "shadow_mule");

/** Multiplier of the crouched walk's slowdown removed (Prowler): 0.4 takes the crouch from half speed to 0.7. */
export const crouchSpeedBonus = (perks: PerkRanks): number => effect(perks, "shadow_prowler");
