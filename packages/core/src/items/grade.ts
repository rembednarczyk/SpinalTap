import { CYBERWARE_CATALOG, type CyberwareDefinition, isCyberwareId } from "../cyberware/cyberware";
import { MAX_LEVEL, MIN_LEVEL } from "../progression/curve";
import { isGarmentId, isWeaponId } from "./catalog";
import { atLeast, rollRarityAt } from "./rarity";
import { rollTraits } from "./traits";
import type { InstanceDefId, Rarity, TraitId } from "./types";

/**
 * Item level (ADR-0059): 1 to 30, kept on every weapon and garment. Damage, armor and price grow
 * 4% a level above 1 (×2.16 at 30), on top of the rarity. Mods and implants have no level, but the
 * cyberdeck has one (decision of 6.11 after stage 6). The
 * numbers are first guesses, to be tuned in stage 8.
 */
export const MIN_ITEM_LEVEL = MIN_LEVEL;
export const MAX_ITEM_LEVEL = MAX_LEVEL;
export const LEVEL_SCALE_STEP = 0.04;
/** Loot lies within this many levels of the player (ADR-0059: `clamp(source, player ± 2)`). */
export const LOOT_LEVEL_BAND = 2;
/** An enemy's loot is its level ± this. */
export const ENEMY_LOOT_SPREAD = 1;

/** A whole level within 1..30. */
export const clampItemLevel = (level: number): number => Math.min(MAX_ITEM_LEVEL, Math.max(MIN_ITEM_LEVEL, Math.round(level)));

const isDeck = (def: InstanceDefId): boolean => {
  if (!isCyberwareId(def)) return false;
  const implant: CyberwareDefinition = CYBERWARE_CATALOG[def];
  return implant.deck !== undefined;
};

/** Whether pieces of this kind have a level: weapons, garments and the cyberdeck. */
export const hasItemLevel = (def: InstanceDefId): boolean => isWeaponId(def) || isGarmentId(def) || isDeck(def);

/** The level of a piece (1 when a weapon or garment has none saved), or null for mods and implants. */
export const itemLevelOf = (item: { readonly def: InstanceDefId; readonly level?: number }): number | null =>
  hasItemLevel(item.def) ? clampItemLevel(item.level ?? MIN_ITEM_LEVEL) : null;

/** What the level does to damage, armor and price: 1 at level 1, +4% a level. */
export const levelScale = (level: number = MIN_ITEM_LEVEL): number => 1 + LEVEL_SCALE_STEP * (clampItemLevel(level) - MIN_ITEM_LEVEL);

/** Level of loot from a source of level `source` (enemy, district), kept in the player's band. */
export const lootLevel = (source: number, player: number): number => {
  const p = clampItemLevel(player);
  return clampItemLevel(Math.min(p + LOOT_LEVEL_BAND, Math.max(p - LOOT_LEVEL_BAND, source)));
};

/** Level of a piece an enemy of `enemy` drops: its level −1, 0 or +1 from one random number, in the band. */
export const enemyLootLevel = (enemy: number, player: number, r: number): number =>
  lootLevel(enemy - ENEMY_LOOT_SPREAD + Math.min(2 * ENEMY_LOOT_SPREAD, Math.floor(r * (2 * ENEMY_LOOT_SPREAD + 1))), player);

/** Tier, level and traits of a new piece. Level and traits only on weapons and garments. */
export interface ItemGrade {
  readonly rarity: Rarity;
  readonly level?: number;
  readonly traits?: readonly TraitId[];
}

/**
 * The grade of a rolled piece: the tier from `rarityRoll` at its level (or the fixed tier), and
 * the traits of an epic or legendary one from two more numbers. `floor` lifts a rolled tier below
 * it (the protection against bad luck, ADR-0059 stage 6); a fixed tier stays.
 */
export const rollGrade = (def: InstanceDefId, rarity: Rarity | "roll", level: number, rarityRoll: number, t1: number, t2: number, floor?: Rarity): ItemGrade => {
  const rolled = (at: number): Rarity => atLeast(rollRarityAt(at, rarityRoll), floor);
  if (!hasItemLevel(def)) return { rarity: rarity === "roll" ? rolled(MIN_ITEM_LEVEL) : rarity };
  const tier = rarity === "roll" ? rolled(level) : rarity;
  const traits = rollTraits(def, tier, t1, t2);
  return traits.length > 0 ? { rarity: tier, level: clampItemLevel(level), traits } : { rarity: tier, level: clampItemLevel(level) };
};
