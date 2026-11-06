import { isWeaponId } from "./catalog";
import type { AmmoId, ItemDefId, WeaponId } from "./types";

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
  | "ammo-556";

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

/**
 * The icon of an item, or null: the explicit stand-in for kinds without icons yet (garments,
 * implants, mods, consumables, junk; ADR-0073 stage 2), which keep their text.
 */
export const itemIcon = (id: ItemDefId): ItemIconKey | null => (isWeaponId(id) ? WEAPON_ICONS[id] : null);

export const ammoIcon = (id: AmmoId): ItemIconKey => AMMO_ICONS[id];
