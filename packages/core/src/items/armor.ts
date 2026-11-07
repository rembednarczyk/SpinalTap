import type { DerivedStats, StatModifiers } from "../character/stats";
import { type DefenderProfile, HIT_ZONES, type HitZone } from "../combat/combat-rules";
import { GARMENT_CATALOG, type GarmentDefinition, isGarmentId } from "./catalog";
import { type Equipment, type InventoryState, findItem, updateItem } from "./inventory";
import { levelScale } from "./grade";
import { RARITY } from "./rarity";
import { traitEffects } from "./traits";
import type { GarmentId, GarmentSlot, Rarity, TraitId } from "./types";

/** Zones each garment slot covers. Arms have no slot of their own: the torso piece has sleeves. */
export const GARMENT_COVERAGE: Readonly<Record<GarmentSlot, readonly HitZone[]>> = {
  head: ["head"],
  torso: ["torso", "arm"],
  legs: ["leg"],
};

/** The zone that gets the rarity bonus. */
const MAIN_ZONE: Readonly<Record<GarmentSlot, HitZone>> = { head: "head", torso: "torso", legs: "leg" };

export const GARMENT_SLOTS: readonly GarmentSlot[] = ["head", "torso", "legs"];

/** Flat reduction makes stacked armor brutal against weak guns, so a zone tops out here. */
export const ZONE_ARMOR_CAP = 8;
/** Condition a garment loses on every hit to a zone it covers. */
export const WEAR_PER_HIT = 2;

/** Worn-out clothes still protect, at half strength. */
export const conditionFactor = (condition: number): number => 0.5 + (0.5 * Math.max(0, Math.min(100, condition))) / 100;

/** A garment as it protects: definition, tier, level and traits (ADR-0059), condition. */
export interface WornGarment {
  readonly def: GarmentId;
  readonly rarity: Rarity;
  readonly condition: number;
  /** 1 when absent. */
  readonly level?: number;
  readonly traits?: readonly TraitId[];
}

/**
 * Armor one garment adds to `zone`: its own, the rarity bonus on the main zone and the traits'
 * on every zone it covers, times the level (+4% a level, ADR-0059) and the condition.
 */
export const garmentArmor = (g: WornGarment, zone: HitZone): number => {
  const def: GarmentDefinition = GARMENT_CATALOG[g.def];
  const own = def.armor[zone] ?? 0;
  if (own === 0) return 0;
  const bonus = MAIN_ZONE[def.slot] === zone ? RARITY[g.rarity].armor : 0;
  const traits = traitEffects(g.traits).reduce((sum, t) => sum + (t.armor ?? 0), 0);
  return (own + bonus + traits) * levelScale(g.level) * conditionFactor(g.condition);
};

/** The stats zone armor reads; `garmentArmor` (Tech, ADR-0059) only the player has. */
export type ArmorStats = Pick<DerivedStats, "armor" | "headArmor"> & { readonly garmentArmor?: number };

/**
 * Armor on one zone: the global value from implants and memories (everywhere, it is under the
 * skin), head plating on the head, plus the clothes lying on that zone, and the Tech bonus once
 * when any of them protects it; capped.
 */
export const zoneArmor = (stats: ArmorStats, worn: readonly WornGarment[], zone: HitZone): number => {
  let total = stats.armor + (zone === "head" ? stats.headArmor : 0);
  let clothed = false;
  for (const g of worn) {
    const a = garmentArmor(g, zone);
    total += a;
    if (a > 0) clothed = true;
  }
  if (clothed) total += stats.garmentArmor ?? 0;
  return Math.min(ZONE_ARMOR_CAP, total);
};

/** Defender profile with every zone resolved, for `resolveAttack`. */
export const defenseOf = (stats: ArmorStats, worn: readonly WornGarment[]): DefenderProfile => {
  const perZone: Partial<Record<HitZone, number>> = {};
  for (const z of HIT_ZONES) perZone[z] = zoneArmor(stats, worn, z);
  return { armor: 0, zoneArmor: perZone };
};

/** A garment instance as it protects. */
export const wornOf = (
  def: GarmentId,
  item: { readonly rarity: Rarity; readonly condition?: number; readonly level?: number; readonly traits?: readonly TraitId[] },
): WornGarment => ({
  def,
  rarity: item.rarity,
  condition: item.condition ?? 100,
  ...(item.level === undefined ? {} : { level: item.level }),
  ...(item.traits === undefined ? {} : { traits: item.traits }),
});

/** Garments the player wears, head to legs. */
export const wornGarments = (inv: InventoryState, eq: Equipment): WornGarment[] => {
  const worn: WornGarment[] = [];
  for (const slot of GARMENT_SLOTS) {
    const uid = eq[slot];
    const item = uid === null ? undefined : findItem(inv, uid);
    if (item && isGarmentId(item.def)) worn.push(wornOf(item.def, item));
  }
  return worn;
};

/** Stat modifiers of worn garments (a ballistic vest slows you down, a lightweight trait speeds you up). */
export const garmentModifiers = (worn: readonly WornGarment[]): StatModifiers[] => {
  const mods: StatModifiers[] = [];
  for (const g of worn) {
    const def: GarmentDefinition = GARMENT_CATALOG[g.def];
    if (def.modifiers) mods.push(def.modifiers);
    for (const t of traitEffects(g.traits)) if (t.moveSpeed !== undefined) mods.push({ moveSpeed: t.moveSpeed });
  }
  return mods;
};

/**
 * A hit on `zone` wears the worn pieces covering it by `wear` (WEAR_PER_HIT), times their traits'
 * wear (a durable one half). Returns the same object when nothing changed.
 */
export const wearGarments = (inv: InventoryState, eq: Equipment, zone: HitZone, wear = WEAR_PER_HIT): InventoryState => {
  let next = inv;
  for (const slot of GARMENT_SLOTS) {
    const uid = eq[slot];
    if (uid === null || !GARMENT_COVERAGE[slot].includes(zone)) continue;
    const item = findItem(next, uid);
    if (!item || item.condition === undefined || item.condition <= 0) continue;
    const scale = traitEffects(item.traits).reduce((k, t) => k * (t.wear ?? 1), 1);
    const condition = Math.max(0, item.condition - wear * scale);
    next = updateItem(next, uid, (i) => ({ ...i, condition }));
  }
  return next;
};

/** Fixed outfit of an NPC type, in mint condition and with no implants. */
export const outfitDefense = (outfit: readonly GarmentId[]): DefenderProfile =>
  defenseOf(
    { armor: 0, headArmor: 0 },
    outfit.map((def) => ({ def, rarity: "common", condition: 100 })),
  );
