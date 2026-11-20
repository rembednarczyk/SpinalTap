import type { FactionId } from "../reputation/reputation";
import type { LootTableId } from "./loot";
import type { GarmentId, WeaponId } from "./types";

export type EnemyTypeId = "hebi_ganger" | "hebi_lookout" | "hebi_enforcer" | "hebi_brawler" | "kagami_cleaner" | "tessen_guard" | "tessen_sniper";

/**
 * How an enemy with the AI of a ganger sees the player (ADR-0069). It sees in a cone in front of
 * it out to `sight`, a crouching player only from `crouchSight` of that, and anyone standing within
 * `near` whatever its facing (unless they crouch). Seeing fills its suspicion at `suspicionRate`
 * (before the difficulty's awareness and the distance), at 1 it raises the alarm. Once alerted it
 * sees all round.
 */
export interface SightProfile {
  /** Metres it sees a standing player from (the faction's stance may stretch it). */
  readonly sight: number;
  /** Half-angle of its cone, radians. */
  readonly cone: number;
  /** Multiplier of `sight` for a crouching player. */
  readonly crouchSight: number;
  /** Metres within which it sees a standing player whatever its facing. */
  readonly near: number;
  /**
   * Suspicion per second with the player close by, standing, before `awareness`: some 1.5 s to the
   * alarm for a Hebi, slower for the trained (ADR-0069 after the 17.11 audit, as in Cyberpunk 2077).
   * It falls off to 45% of that at the far end of sight, and a crouching player fills it half as fast.
   */
  readonly suspicionRate: number;
}

/** Values of ADR-0069, the meter slowed after the 17.11 audit (18.11); stage 8 of ADR-0059 tunes them. */
const HEBI_SIGHT: SightProfile = { sight: 17, cone: 1.2, crouchSight: 0.5, near: 2, suspicionRate: 0.67 };
const TRAINED_SIGHT: SightProfile = { sight: 17, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 0.53 };
const GUARD_SIGHT: SightProfile = { sight: 18, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 0.47 };
/** W-3's observer in the tower's cabin (ADR-0082 §2): a guard's eyes that reach 40 m. */
const SNIPER_SIGHT: SightProfile = { ...GUARD_SIGHT, sight: 40 };

/** What an enemy carries and wears (plan §5.1). The sim spawns it, the loot table pays for it. */
export interface EnemyType {
  readonly id: EnemyTypeId;
  readonly faction: FactionId;
  readonly hp: number;
  /** Fired through the weapon's NPC profile. */
  readonly weapon: WeaponId;
  /** Fixed outfit: armor per zone and, later, the look. */
  readonly outfit: readonly GarmentId[];
  /** Rolled once, at death, into a bag. */
  readonly loot: LootTableId;
  /**
   * Its sight (ADR-0069). A sniper on its perch keeps its own (ADR-0024, its rifle's range): the
   * sniper's profile is for one with the AI of a ganger, W-3's observer before the alarm (ADR-0082).
   */
  readonly vision: SightProfile;
  /** An elite is a level above its district's band (ADR-0059); the rest are regulars. */
  readonly rank?: "elite";
}

export const ENEMY_TYPES = {
  // Today's ganger armor (3) became the Hebi jacket with no head cover, so a head hit skips it.
  hebi_ganger: { id: "hebi_ganger", faction: "hebi", hp: 80, weapon: "hebi_smg", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common", vision: HEBI_SIGHT },
  hebi_lookout: { id: "hebi_lookout", faction: "hebi", hp: 80, weapon: "unity9", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common", vision: HEBI_SIGHT },
  hebi_enforcer: { id: "hebi_enforcer", faction: "hebi", hp: 140, weapon: "raijin12", outfit: ["hebi_jacket", "moto_helmet", "cargo_pants"], loot: "hebi_enforcer", vision: TRAINED_SIGHT, rank: "elite" },
  // Melee (ADR-0019): closes in with a telescopic baton and swings with a readable windup.
  hebi_brawler: { id: "hebi_brawler", faction: "hebi", hp: 90, weapon: "baton", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common", vision: HEBI_SIGHT },
  // Act II (ADR-0023): Kagami's recovery team on the overpass, vests and visors, no gang colours.
  kagami_cleaner: {
    id: "kagami_cleaner",
    faction: "kagami",
    hp: 110,
    weapon: "hebi_smg",
    outfit: ["ballistic_vest", "tactical_visor", "kevlar_pants"],
    loot: "hebi_enforcer",
    vision: TRAINED_SIGHT,
    rank: "elite",
  },
  // Doki (ADR-0024). The guard is armoured: an SMG barely scratches the vest, aim for the face.
  tessen_guard: {
    id: "tessen_guard",
    faction: "tessen",
    hp: 110,
    weapon: "tessen_ar5",
    outfit: ["tessen_vest", "tessen_helmet", "kevlar_pants"],
    loot: "tessen_guard",
    vision: GUARD_SIGHT,
  },
  // Takes a high perch, telegraphs every shot with a laser and falls back when Seki gets close.
  tessen_sniper: { id: "tessen_sniper", faction: "tessen", hp: 70, weapon: "kagero_dmr", outfit: ["tactical_visor", "cargo_pants"], loot: "tessen_sniper", vision: SNIPER_SIGHT },
} as const satisfies Record<EnemyTypeId, EnemyType>;

/** The sight of an enemy type (every type names its own); anything untyped sees as a Hebi ganger. */
export const sightOf = (type: EnemyTypeId | undefined): SightProfile => (ENEMY_TYPES[type ?? "hebi_ganger"] as EnemyType).vision;
