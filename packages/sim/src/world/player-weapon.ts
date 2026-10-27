import { type DomainState, type ItemInstance, type WeaponSlot, ammoCount, findItem, isWeaponId, setAmmo, updateItem, usesAmmo, weaponStatsOf } from "@seki/core";
import type { Combatant, Entity } from "./components";
import type { SimContext } from "./context";

/** Input slot numbers: 1 primary, 2 secondary, 3 melee. */
export const SLOT_BY_INPUT: readonly (WeaponSlot | null)[] = [null, "primary", "secondary", "melee"];

/** The weapon instance in the player's active slot, if any. */
export const activeWeaponItem = (domain: DomainState, slot: WeaponSlot = domain.equipment.active): ItemInstance | null => {
  const uid = domain.equipment[slot];
  const item = uid === null ? undefined : findItem(domain.inventory, uid);
  return item && isWeaponId(item.def) ? item : null;
};

/**
 * Refreshes the player's combatant from the domain. A different weapon showing up in hand
 * (a command equipped it into the active slot) is drawn and cancels a reload; the first sync
 * after spawning or loading only arms the player.
 */
export const syncPlayerWeapon = (domain: DomainState, c: Combatant): void => {
  const slot = domain.equipment.active;
  const item = activeWeaponItem(domain, slot);
  const uid = item?.uid ?? null;
  const stats = weaponStatsOf(domain.inventory, uid);
  if (c.uid !== undefined && c.uid !== uid) {
    c.reloading = 0;
    c.drawing = stats && !c.holstered ? stats.drawTime : 0;
  }
  c.uid = uid;
  c.slot = slot;
  c.weapon = stats?.id ?? null;
  c.stats = stats;
};

/** Rounds in the magazine: the player's from the weapon instance, an NPC's from the combatant. */
export const loadedOf = (ctx: SimContext, e: Entity): number => {
  const c = e.combatant;
  if (!c) return 0;
  if (!e.player) return c.loaded;
  return (c.uid ? findItem(ctx.state.domain.inventory, c.uid)?.loaded : undefined) ?? 0;
};

/** Rounds of the active weapon's ammo in the player's pouch; NPCs never run dry. */
export const reserveOf = (ctx: SimContext, e: Entity): number => {
  const ammo = e.combatant?.stats?.ammo;
  if (!e.player) return Infinity;
  return ammo ? ammoCount(ctx.state.domain.ammo, ammo) : 0;
};

/** Writes magazine and reserve back (domain for the player, combatant for NPCs). */
export const setRounds = (ctx: SimContext, e: Entity, loaded: number, reserve: number): void => {
  const c = e.combatant;
  if (!c) return;
  if (!e.player) {
    c.loaded = loaded;
    return;
  }
  const uid = c.uid;
  const ammo = c.stats?.ammo;
  if (!uid || !ammo) return;
  const domain = ctx.state.domain;
  ctx.state.domain = {
    ...domain,
    inventory: updateItem(domain.inventory, uid, (i) => ({ ...i, loaded })),
    ammo: setAmmo(domain.ammo, ammo, reserve),
  };
};

/** Takes the round a shot uses. Melee weapons use none. */
export const consumeRound = (ctx: SimContext, e: Entity): void => {
  const stats = e.combatant?.stats;
  if (!stats || !usesAmmo(stats)) return;
  const loaded = loadedOf(ctx, e);
  if (!e.player) {
    if (e.combatant) e.combatant.loaded = Math.max(0, loaded - 1);
    return;
  }
  const uid = e.combatant?.uid;
  if (!uid) return;
  ctx.state.domain = { ...ctx.state.domain, inventory: updateItem(ctx.state.domain.inventory, uid, (i) => ({ ...i, loaded: Math.max(0, loaded - 1) })) };
};

/**
 * May this combatant shoot now? Drawn, not drawing, cooled down, and with a round in the
 * magazine (melee needs none). Reloading blocks the shot, except that a per-round reload
 * with a round already in gives way to the trigger.
 */
export const readyToFire = (c: Combatant, loaded: number): boolean => {
  const stats = c.stats;
  if (!stats || c.holstered || c.drawing > 0 || c.cooldown > 0) return false;
  const needsRound = usesAmmo(stats);
  if (needsRound && loaded <= 0) return false;
  if (c.reloading > 0) return stats.reloadMode === "per-round" && loaded > 0;
  return true;
};
