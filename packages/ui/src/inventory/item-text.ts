import {
  CYBERWARE_CATALOG,
  type EquipSlot,
  GARMENT_CATALOG,
  type InstanceDefId,
  type ItemCategory,
  type ItemDefId,
  type Locale,
  MOD_CATALOG,
  type ModSlot,
  type Rarity,
  STACKABLE_CATALOG,
  type StatKey,
  WEAPON_CATALOG,
  isGarmentId,
  isModId,
  isStackableId,
  isWeaponId,
  itemSummary,
} from "@seki/core";
import { formatNumber } from "../i18n/number";
import type { Translate } from "../i18n/t";

/** Labels and number formats of the character menu, in the player's language. Numbers come from core. */

export const slotLabel = (t: Translate, slot: EquipSlot): string => t(`inventory.slot.${slot}`);

/** "primary slot" and the like, for "(primary slot empty)". */
export const slotNoun = (t: Translate, slot: EquipSlot): string => t(`inventory.slotNoun.${slot}`);

export const modSlotLabel = (t: Translate, slot: ModSlot): string => t(`inventory.modSlot.${slot}`);

/** Rarity as the panels write it. */
export const rarityLabel = (t: Translate, rarity: Rarity): string => t(`inventory.rarity.${rarity}`);

/** Short names that fit a 52 px cell; item names, so they wait for stage 3 of ADR-0056 with the catalog. */
const SHORT: Readonly<Partial<Record<ItemDefId, string>>> = {
  unity9: "U-9",
  oni44: ".44",
  hebi_smg: "SMG",
  raijin12: "R-12",
  tessen_ar5: "AR-5",
  baton: "Pałka",
  shirasaya: "Ostrze",
  seki_jacket: "Kurtka",
  cargo_pants: "Cargo",
  tactical_visor: "Wizjer",
  moto_helmet: "Kask",
  hebi_jacket: "Hebi",
  ballistic_vest: "Kamiz.",
  kevlar_pants: "Kevlar",
  suppressor: "Tłumik",
  holo_sight: "Holo",
  extended_mag: "Mag+",
  medkit: "Apteczka",
  bandage: "Opatr.",
  scrap: "Złom",
  weapon_parts: "Części",
  datachip: "Chip",
};

export const itemName = (def: ItemDefId): string => itemSummary(def).name;

export const shortName = (def: ItemDefId): string => SHORT[def] ?? itemName(def).slice(0, 6);

export const description = (def: ItemDefId): string => {
  if (isStackableId(def)) return STACKABLE_CATALOG[def].description;
  if (isWeaponId(def)) return WEAPON_CATALOG[def].description;
  if (isGarmentId(def)) return GARMENT_CATALOG[def].description;
  if (isModId(def)) return MOD_CATALOG[def].description;
  return CYBERWARE_CATALOG[def].description;
};

/** Line under the name: what kind of thing it is. */
export const kindLabel = (t: Translate, def: ItemDefId): string => {
  if (isStackableId(def)) return t(STACKABLE_CATALOG[def].category === "consumable" ? "inventory.kind.consumable" : "inventory.kind.junk");
  if (isWeaponId(def)) return `${t(`inventory.class.${WEAPON_CATALOG[def].class}`)} · ${slotLabel(t, WEAPON_CATALOG[def].slot).toLowerCase()}`;
  if (isGarmentId(def)) return t("inventory.kind.garment", { slot: slotLabel(t, GARMENT_CATALOG[def].slot).toLowerCase() });
  if (isModId(def)) return t("inventory.kind.mod", { slot: modSlotLabel(t, MOD_CATALOG[def].slot).toLowerCase() });
  return t("inventory.kind.cyberware");
};

export type GridFilter = "all" | "weapon" | "garment" | "consumable" | "other";

export const FILTERS: readonly GridFilter[] = ["all", "weapon", "garment", "consumable", "other"];

export const categoryOf = (def: ItemDefId): ItemCategory => itemSummary(def).category;

export const matchesFilter = (def: ItemDefId, filter: GridFilter): boolean => {
  if (filter === "all") return true;
  const c = categoryOf(def);
  if (filter === "other") return c !== "weapon" && c !== "garment" && c !== "consumable";
  return c === filter;
};

/** Sort order of categories in the grid. */
export const CATEGORY_ORDER: readonly ItemCategory[] = ["weapon", "garment", "mod", "consumable", "cyberware", "ammo", "junk"];

export const statLabel = (t: Translate, key: StatKey): string => t(`inventory.stat.${key}`);

const num = (locale: Locale, n: number, digits = 1): string => formatNumber(locale, n, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** A stat with its unit, e.g. "1,4 s", "25 m", "3,2°" in Polish, "1.4 s" in English. */
export const formatStat = (locale: Locale, key: StatKey, value: number): string => {
  switch (key) {
    case "rate":
    case "magazine":
      return num(locale, Math.round(value), 0);
    case "reload":
      return `${num(locale, value)} s`;
    case "spread":
      return `${num(locale, value)}°`;
    case "range":
      return `${num(locale, value, 0)} m`;
    case "speed":
      return `${value > 0 ? "+" : ""}${num(locale, value)} m/s`;
    case "heal":
      return `${num(locale, value, 0)} HP`;
    default:
      return num(locale, value);
  }
};

/** Difference with its sign, in the stat's own format. */
export const formatDelta = (locale: Locale, key: StatKey, delta: number): string => {
  const text = formatStat(locale, key, Math.abs(delta)).replace(/^\+/, "");
  return `${delta > 0 ? "+" : "-"}${text}`;
};

export const isEquippable = (def: InstanceDefId): boolean => isWeaponId(def) || isGarmentId(def);
