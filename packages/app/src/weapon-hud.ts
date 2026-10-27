import { AMMO_CATALOG, WEAPON_CATALOG, WEAPON_SLOTS, ammoCount, findItem, isWeaponId, usesAmmo } from "@seki/core";
import type { Simulation } from "@seki/sim";
import type { WeaponSlotVm, WeaponStripVm } from "@seki/ui";

const KEYS = { primary: 1, secondary: 2, melee: 3 } as const;

const sameStrip = (a: WeaponStripVm, b: WeaponStripVm): boolean =>
  a.active === b.active &&
  a.loaded === b.loaded &&
  a.magazine === b.magazine &&
  a.reserve === b.reserve &&
  a.ammoName === b.ammoName &&
  a.reloading === b.reloading &&
  a.holstered === b.holstered &&
  a.slots.every((s, i) => s.name === b.slots[i]?.name && s.rarity === b.slots[i]?.rarity);

/**
 * Builds the HUD weapon strip from the domain (slots, rounds, pouch) and the player's combatant
 * (reload, holster). Returns the previous object while nothing changed, so the store stays put.
 */
export const createWeaponHud = () => {
  let last: WeaponStripVm | null = null;
  return (sim: Simulation): WeaponStripVm | null => {
    const p = sim.player();
    const c = p?.combatant;
    if (!p || !c) return (last = null);
    const { inventory, equipment, ammo } = sim.domain;
    const slots: WeaponSlotVm[] = WEAPON_SLOTS.map((slot) => {
      const uid = equipment[slot];
      const item = uid === null ? undefined : findItem(inventory, uid);
      const def = item && isWeaponId(item.def) ? WEAPON_CATALOG[item.def] : null;
      return { slot, key: KEYS[slot], name: def?.name ?? null, rarity: def && item ? item.rarity : null };
    });
    const stats = c.stats;
    const firearm = stats !== null && usesAmmo(stats);
    const item = c.uid ? findItem(inventory, c.uid) : undefined;
    const next: WeaponStripVm = {
      slots,
      active: equipment.active,
      loaded: firearm ? (item?.loaded ?? 0) : null,
      magazine: firearm ? stats.magazine : null,
      reserve: firearm && stats.ammo ? ammoCount(ammo, stats.ammo) : null,
      ammoName: firearm && stats.ammo ? AMMO_CATALOG[stats.ammo].name : null,
      reloading: c.reloading > 0,
      holstered: c.holstered,
    };
    if (last && sameStrip(last, next)) return last;
    last = next;
    return next;
  };
};
