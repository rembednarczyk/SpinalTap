import type { CyberwareId } from "../cyberware/cyberware";

/**
 * Item vocabulary shared by the contracts (events, commands, render port) and the item
 * catalogs (ADR-0015). Ids are spelled out here so the contracts do not depend on the
 * catalog contents; every catalog is checked against them with `satisfies`.
 */

/** Fixed multipliers instead of random affixes, so a save stores only the tier. */
export type Rarity = "common" | "uncommon" | "rare" | "unique";

export type ItemCategory = "weapon" | "ammo" | "consumable" | "garment" | "cyberware" | "mod" | "junk";

export type WeaponId = "unity9" | "oni44" | "hebi_smg" | "raijin12" | "tessen_ar5" | "kagero_dmr" | "baton" | "shirasaya";
export type AmmoId = "9mm" | "44" | "12g" | "556";
/** Street food (ADR-0026) heals too, but only from the bag: quick use takes medical kit only. */
export type ConsumableId = "medkit" | "bandage" | "ramen" | "yakitori";
export type JunkId = "scrap" | "weapon_parts" | "datachip";
export type GarmentId =
  | "seki_jacket"
  | "cargo_pants"
  | "tactical_visor"
  | "moto_helmet"
  | "hebi_jacket"
  | "ballistic_vest"
  | "kevlar_pants"
  | "tessen_vest"
  | "tessen_helmet";
export type ModId = "suppressor" | "holo_sight" | "extended_mag";

/** Items without state of their own: counted per id. */
export type StackableId = ConsumableId | JunkId;
/** Items with state (magazine, mods, condition, rarity): one record per piece, with a uid. */
export type InstanceDefId = WeaponId | GarmentId | ModId | CyberwareId;
export type ItemDefId = InstanceDefId | StackableId;

export type WeaponSlot = "primary" | "secondary" | "melee";
export type GarmentSlot = "head" | "torso" | "legs";
export type EquipSlot = WeaponSlot | GarmentSlot;
export type ModSlot = "muzzle" | "sight" | "magazine";

/** A piece in the inventory: an instance by uid or a stack by id. */
export type ItemRef = { readonly uid: string } | { readonly stack: StackableId };

/** What the renderer draws for a weapon, in hand or stowed. */
export type WeaponLook = "pistol" | "revolver" | "smg" | "shotgun" | "rifle" | "baton" | "blade";

/** Colour slot of the procedural rig that a garment recolours. */
export type PaletteKey = "jacket-seki" | "jacket-hebi" | "jacket-tessen" | "cargo" | "kevlar" | "vest";
export type AttachPoint = "head" | "eyes" | "chest" | "back" | "hipR" | "hipL" | "thighL" | "handR";
export type GarmentMeshId = "visor" | "helmet" | "vest-plate";

export interface GarmentLook {
  readonly tint?: PaletteKey;
  readonly attachments?: readonly { readonly point: AttachPoint; readonly mesh: GarmentMeshId }[];
}

/** One line of a loot container. Eddies go to the wallet, ammo to the pouch, the rest to the inventory. */
export type LootLine =
  | { readonly kind: "eddies"; readonly qty: number }
  | { readonly kind: "ammo"; readonly ammo: AmmoId; readonly qty: number }
  | { readonly kind: "stack"; readonly item: StackableId; readonly qty: number }
  | { readonly kind: "item"; readonly item: InstanceDefId; readonly rarity: Rarity; readonly qty: 1 };
