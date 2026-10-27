import {
  CYBERWARE_CATALOG,
  type EquipSlot,
  GARMENT_CATALOG,
  type InstanceDefId,
  type ItemCategory,
  type ItemDefId,
  MOD_CATALOG,
  type ModSlot,
  STACKABLE_CATALOG,
  type StatKey,
  WEAPON_CATALOG,
  type WeaponClass,
  isGarmentId,
  isModId,
  isStackableId,
  isWeaponId,
  itemSummary,
} from "@seki/core";

/** Polish labels and number formats of the character menu. Numbers come from core. */

export const SLOT_LABEL: Readonly<Record<EquipSlot, string>> = {
  primary: "Główna",
  secondary: "Boczna",
  melee: "Wręcz",
  head: "Głowa",
  torso: "Tors",
  legs: "Nogi",
};

/** "slot główny" and the like, for "(slot główny pusty)". */
export const SLOT_NOUN: Readonly<Record<EquipSlot, string>> = {
  primary: "slot główny",
  secondary: "slot boczny",
  melee: "slot do walki wręcz",
  head: "slot głowy",
  torso: "slot torsu",
  legs: "slot nóg",
};

export const MOD_SLOT_LABEL: Readonly<Record<ModSlot, string>> = { muzzle: "Lufa", sight: "Celownik", magazine: "Magazynek" };

const CLASS_LABEL: Readonly<Record<WeaponClass, string>> = {
  pistol: "Pistolet",
  revolver: "Rewolwer",
  smg: "Pistolet maszynowy",
  shotgun: "Strzelba",
  rifle: "Karabinek",
  baton: "Pałka",
  blade: "Ostrze",
};

/** Short names that fit a 52 px cell. */
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
export const kindLabel = (def: ItemDefId): string => {
  if (isStackableId(def)) return STACKABLE_CATALOG[def].category === "consumable" ? "Do użycia" : "Drobiazg na sprzedaż";
  if (isWeaponId(def)) return `${CLASS_LABEL[WEAPON_CATALOG[def].class]} · ${SLOT_LABEL[WEAPON_CATALOG[def].slot].toLowerCase()}`;
  if (isGarmentId(def)) return `Odzież · ${SLOT_LABEL[GARMENT_CATALOG[def].slot].toLowerCase()}`;
  if (isModId(def)) return `Modyfikacja broni · ${MOD_SLOT_LABEL[MOD_CATALOG[def].slot].toLowerCase()}`;
  return "Wszczep do montażu w klinice";
};

export type GridFilter = "all" | "weapon" | "garment" | "consumable" | "other";

export const FILTERS: readonly (readonly [GridFilter, string])[] = [
  ["all", "Wszystko"],
  ["weapon", "Broń"],
  ["garment", "Odzież"],
  ["consumable", "Zużywalne"],
  ["other", "Inne"],
];

export const categoryOf = (def: ItemDefId): ItemCategory => itemSummary(def).category;

export const matchesFilter = (def: ItemDefId, filter: GridFilter): boolean => {
  if (filter === "all") return true;
  const c = categoryOf(def);
  if (filter === "other") return c !== "weapon" && c !== "garment" && c !== "consumable";
  return c === filter;
};

/** Sort order of categories in the grid. */
export const CATEGORY_ORDER: readonly ItemCategory[] = ["weapon", "garment", "mod", "consumable", "cyberware", "ammo", "junk"];

export const STAT_LABEL: Readonly<Record<StatKey, string>> = {
  damage: "Obrażenia",
  rate: "Na minutę",
  magazine: "Magazynek",
  reload: "Przeładowanie",
  spread: "Rozrzut",
  range: "Zasięg",
  "armor-head": "Pancerz głowy",
  "armor-torso": "Pancerz torsu",
  "armor-arm": "Pancerz rąk",
  "armor-leg": "Pancerz nóg",
  speed: "Szybkość",
  heal: "Leczy",
};

const num = (n: number, digits = 1): string => n.toLocaleString("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** A stat with its unit, e.g. "1,4 s", "25 m", "3,2°". */
export const formatStat = (key: StatKey, value: number): string => {
  switch (key) {
    case "rate":
    case "magazine":
      return num(Math.round(value), 0);
    case "reload":
      return `${num(value)} s`;
    case "spread":
      return `${num(value)}°`;
    case "range":
      return `${num(value, 0)} m`;
    case "speed":
      return `${value > 0 ? "+" : ""}${num(value)} m/s`;
    case "heal":
      return `${num(value, 0)} HP`;
    default:
      return num(value);
  }
};

/** Difference with its sign, in the stat's own format. */
export const formatDelta = (key: StatKey, delta: number): string => {
  const text = formatStat(key, Math.abs(delta)).replace(/^\+/, "");
  return `${delta > 0 ? "+" : "-"}${text}`;
};

export const isEquippable = (def: InstanceDefId): boolean => isWeaponId(def) || isGarmentId(def);
