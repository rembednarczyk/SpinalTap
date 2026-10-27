import type { AppearanceDescriptor } from "../ports/types";
import { GARMENT_CATALOG, WEAPON_CATALOG, isGarmentId, isWeaponId } from "./catalog";
import type { EnemyType } from "./enemies";
import { type Equipment, type InventoryState, findItem } from "./inventory";
import type { GarmentLook, GarmentSlot, WeaponLook } from "./types";

const weaponLook = (inv: InventoryState, uid: string | null): WeaponLook | null => {
  const def = uid ? findItem(inv, uid)?.def : undefined;
  return def && isWeaponId(def) ? WEAPON_CATALOG[def].look : null;
};

/** What the player wears and carries, for `RenderPort.setAppearance` (ADR-0015). */
export const appearanceOf = (inv: InventoryState, eq: Equipment): AppearanceDescriptor => {
  const garments: Partial<Record<GarmentSlot, GarmentLook>> = {};
  for (const slot of ["head", "torso", "legs"] as const) {
    const uid = eq[slot];
    const def = uid ? findItem(inv, uid)?.def : undefined;
    if (def && isGarmentId(def)) garments[slot] = GARMENT_CATALOG[def].look;
  }
  return {
    weapons: { primary: weaponLook(inv, eq.primary), secondary: weaponLook(inv, eq.secondary), melee: weaponLook(inv, eq.melee), active: eq.active },
    garments,
    implants: [],
  };
};

/** An enemy type's fixed outfit and weapon, in hand. */
export const appearanceOfEnemy = (type: EnemyType): AppearanceDescriptor => {
  const look = WEAPON_CATALOG[type.weapon].look;
  const slot = WEAPON_CATALOG[type.weapon].slot;
  const garments: Partial<Record<GarmentSlot, GarmentLook>> = {};
  for (const g of type.outfit) garments[GARMENT_CATALOG[g].slot] = GARMENT_CATALOG[g].look;
  return {
    weapons: { primary: slot === "primary" ? look : null, secondary: slot === "secondary" ? look : null, melee: slot === "melee" ? look : null, active: slot },
    garments,
    implants: [],
  };
};

/** Structural equality, so the renderer is told only about real changes. */
export const sameAppearance = (a: AppearanceDescriptor | null, b: AppearanceDescriptor | null): boolean =>
  a === b || (a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b));
