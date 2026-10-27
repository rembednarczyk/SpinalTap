import type { FactionId } from "../reputation/reputation";
import type { LootTableId } from "./loot";
import type { GarmentId, WeaponId } from "./types";

export type EnemyTypeId = "hebi_ganger" | "hebi_lookout" | "hebi_enforcer" | "hebi_brawler" | "tessen_guard" | "tessen_sniper";

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
}

export const ENEMY_TYPES = {
  // Today's ganger armor (3) became the Hebi jacket with no head cover, so a head hit skips it.
  hebi_ganger: { id: "hebi_ganger", faction: "hebi", hp: 80, weapon: "hebi_smg", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common" },
  hebi_lookout: { id: "hebi_lookout", faction: "hebi", hp: 80, weapon: "unity9", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common" },
  hebi_enforcer: { id: "hebi_enforcer", faction: "hebi", hp: 140, weapon: "raijin12", outfit: ["hebi_jacket", "moto_helmet", "cargo_pants"], loot: "hebi_enforcer" },
  // Melee (ADR-0019): closes in with a telescopic baton and swings with a readable windup.
  hebi_brawler: { id: "hebi_brawler", faction: "hebi", hp: 90, weapon: "baton", outfit: ["hebi_jacket", "cargo_pants"], loot: "hebi_common" },
  // Doki (ADR-0024). The guard is armoured: an SMG barely scratches the vest, aim for the face.
  tessen_guard: {
    id: "tessen_guard",
    faction: "tessen",
    hp: 110,
    weapon: "tessen_ar5",
    outfit: ["tessen_vest", "tessen_helmet", "kevlar_pants"],
    loot: "tessen_guard",
  },
  // Takes a high perch, telegraphs every shot with a laser and falls back when Seki gets close.
  tessen_sniper: { id: "tessen_sniper", faction: "tessen", hp: 70, weapon: "kagero_dmr", outfit: ["tactical_visor", "cargo_pants"], loot: "tessen_sniper" },
} as const satisfies Record<EnemyTypeId, EnemyType>;
