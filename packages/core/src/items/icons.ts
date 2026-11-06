import { type CyberwareId, isCyberwareId } from "../cyberware/cyberware";
import { isGarmentId, isModId, isWeaponId } from "./catalog";
import type { AmmoId, GarmentId, ItemDefId, ModId, StackableId, WeaponId } from "./types";

/**
 * Icon keys of items (ADR-0073). `core` names the icon; the UI draws it, so no file or drawing
 * lives here. A key of its own rather than `WeaponLook`: the icon may tell apart more than the
 * model does (the Kagero DMR has the rifle's model and an icon with a scope).
 */
export type ItemIconKey =
  | "pistol"
  | "revolver"
  | "smg"
  | "shotgun"
  | "rifle"
  | "dmr"
  | "baton"
  | "blade"
  | "ammo-9mm"
  | "ammo-44"
  | "ammo-12g"
  | "ammo-556"
  // Stage 2: garments, mods and junk drawn here; implants and consumables after game-icons.net (CC BY 3.0).
  | "jacket"
  | "pants"
  | "helmet"
  | "visor"
  | "vest"
  | "overalls"
  | "suppressor"
  | "holo-sight"
  | "magazine"
  | "scrap"
  | "weapon-parts"
  | "datachip"
  | "optics"
  | "subdermal"
  | "synapse"
  | "overclock"
  | "grip"
  | "tendons"
  | "reflex"
  | "medkit"
  | "bandage"
  | "ramen"
  | "skewer"
  | "coffee"
  | "stim"
  | "shard";

export const WEAPON_ICONS: Readonly<Record<WeaponId, ItemIconKey>> = {
  unity9: "pistol",
  oni44: "revolver",
  hebi_smg: "smg",
  raijin12: "shotgun",
  tessen_ar5: "rifle",
  kagero_dmr: "dmr",
  baton: "baton",
  shirasaya: "blade",
};

export const AMMO_ICONS: Readonly<Record<AmmoId, ItemIconKey>> = {
  "9mm": "ammo-9mm",
  "44": "ammo-44",
  "12g": "ammo-12g",
  "556": "ammo-556",
};

/** Garments by what they are, not by faction: the colour of the rarity tells the pieces apart. */
export const GARMENT_ICONS: Readonly<Record<GarmentId, ItemIconKey>> = {
  seki_jacket: "jacket",
  hebi_jacket: "jacket",
  tessen_uniform: "jacket",
  cargo_pants: "pants",
  kevlar_pants: "pants",
  tactical_visor: "visor",
  moto_helmet: "helmet",
  tessen_helmet: "helmet",
  ballistic_vest: "vest",
  tessen_vest: "vest",
  tessen_overalls: "overalls",
};

export const MOD_ICONS: Readonly<Record<ModId, ItemIconKey>> = {
  suppressor: "suppressor",
  holo_sight: "holo-sight",
  extended_mag: "magazine",
};

export const CYBERWARE_ICONS: Readonly<Record<CyberwareId, ItemIconKey>> = {
  hitomi_optics_mk1: "optics",
  subdermal_weave: "subdermal",
  synapse_booster: "synapse",
  kairos_overclock: "overclock",
  steady_grip: "grip",
  kitsune_tendons: "tendons",
  tsubame_reflex: "reflex",
};

export const STACKABLE_ICONS: Readonly<Record<StackableId, ItemIconKey>> = {
  medkit: "medkit",
  bandage: "bandage",
  ramen: "ramen",
  yakitori: "skewer",
  synth_coffee: "coffee",
  steady_stim: "stim",
  capacity_shard: "shard",
  scrap: "scrap",
  weapon_parts: "weapon-parts",
  datachip: "datachip",
};

/**
 * The icon of an item (ADR-0073 stage 2): every kind has one, so a new item of any catalog needs
 * its key here (the tables are `Record`s, so the compiler asks for it).
 */
export const itemIcon = (id: ItemDefId): ItemIconKey => {
  if (isWeaponId(id)) return WEAPON_ICONS[id];
  if (isGarmentId(id)) return GARMENT_ICONS[id];
  if (isModId(id)) return MOD_ICONS[id];
  if (isCyberwareId(id)) return CYBERWARE_ICONS[id];
  return STACKABLE_ICONS[id];
};

export const ammoIcon = (id: AmmoId): ItemIconKey => AMMO_ICONS[id];
