import { type HitZone, ZONE_MULTIPLIERS } from "../combat/combat-rules";
import type { SpreadProfile } from "../combat/spread";
import { MOD_CATALOG, WEAPON_CATALOG, type WeaponDefinition, isModId, isWeaponId } from "./catalog";
import { type Equipment, type InventoryState, findItem, freeCells, isPlaced, updateItem } from "./inventory";
import { RARITY } from "./rarity";
import type { AmmoId, ModId, ModSlot, Rarity, WeaponId, WeaponLook, WeaponSlot } from "./types";

/**
 * A weapon as it fires: the definition with rarity and mods applied. The sim shoots with it
 * and the UI compares with it, so the menu shows the numbers the game uses.
 */
export interface WeaponStats {
  readonly id: WeaponId;
  readonly name: string;
  readonly slot: WeaponSlot;
  readonly damage: number;
  readonly pellets: number;
  readonly interval: number;
  readonly magazine: number;
  readonly reload: number;
  readonly reloadMode: "magazine" | "per-round";
  readonly ammo: AmmoId | null;
  readonly spread: SpreadProfile;
  readonly range: number;
  readonly drawTime: number;
  readonly alertRadius: number;
  /** Damage multiplier per hit zone (ADR-0016 by default). */
  readonly zones: Readonly<Record<HitZone, number>>;
  readonly look: WeaponLook;
}

/** Pellets of a shotgun hitting the head are less of a jackpot than a single bullet. */
const ZONES_BY_WEAPON: Partial<Record<WeaponId, Readonly<Record<HitZone, number>>>> = {
  raijin12: { head: 1.25, torso: 1, arm: 0.65, leg: 0.7 },
};

const base = (def: WeaponDefinition): WeaponStats => ({
  id: def.id,
  name: def.name,
  slot: def.slot,
  damage: def.damage,
  pellets: def.pellets,
  interval: def.interval,
  magazine: def.magazine,
  reload: def.reload,
  reloadMode: def.reloadMode,
  ammo: def.ammo,
  spread: def.spread,
  range: def.range,
  drawTime: def.drawTime,
  alertRadius: def.alertRadius,
  zones: ZONES_BY_WEAPON[def.id] ?? ZONE_MULTIPLIERS,
  look: def.look,
});

/** Stats of a player's weapon with its rarity and mounted mods. Pure, shared by sim and UI. */
export const effectiveWeapon = (id: WeaponId, rarity: Rarity, mods: readonly ModId[] = []): WeaponStats => {
  const def: WeaponDefinition = WEAPON_CATALOG[id];
  const tier = RARITY[rarity];
  let damage = def.damage * tier.damage;
  let spread = def.spread.base * tier.spread;
  let magazine = def.magazine;
  let reload = def.reload;
  let alertRadius = def.alertRadius;
  for (const m of mods) {
    const e = MOD_CATALOG[m].effect;
    if ("damage" in e) damage *= e.damage;
    if ("spread" in e) spread *= e.spread;
    if ("magazine" in e) {
      magazine = def.reloadMode === "per-round" ? magazine + e.perRoundBonus : Math.floor(magazine * e.magazine);
      reload *= e.reload;
    }
    if ("alertRadius" in e) alertRadius = Math.min(alertRadius, e.alertRadius);
  }
  return { ...base(def), damage, magazine, reload, alertRadius, spread: { ...def.spread, base: spread } };
};

/**
 * How an NPC fires the weapon: its `npc` profile (today's ganger balance) or, without one, the
 * plain common weapon. NPCs have endless reserve, but the magazine and the reload still count.
 */
export const npcWeapon = (id: WeaponId): WeaponStats => {
  const def: WeaponDefinition = WEAPON_CATALOG[id];
  const stats = base(def);
  return def.npc ? { ...stats, damage: def.npc.damage, interval: def.npc.interval, range: def.npc.range, spread: def.npc.spread } : stats;
};

/** Mods mounted on a weapon instance, as catalog ids. */
export const mountedMods = (inv: InventoryState, uid: string): ModId[] => {
  const ids: ModId[] = [];
  for (const modUid of Object.values(findItem(inv, uid)?.mods ?? {})) {
    const def = findItem(inv, modUid)?.def;
    if (isModId(def)) ids.push(def);
  }
  return ids;
};

/** Effective stats of a weapon in the inventory, or null when `uid` is not a weapon. */
export const weaponStatsOf = (inv: InventoryState, uid: string | null): WeaponStats | null => {
  const item = uid === null ? undefined : findItem(inv, uid);
  if (!item || !isWeaponId(item.def)) return null;
  return effectiveWeapon(item.def, item.rarity, mountedMods(inv, item.uid));
};

/** Holstering takes half the draw. */
export const holsterTime = (stats: WeaponStats): number => stats.drawTime / 2;

/** Melee weapons never load or reload. */
export const usesAmmo = (stats: WeaponStats): boolean => stats.ammo !== null && stats.magazine > 0;

export interface ReloadPlan {
  /** Seconds until the rounds are in. */
  readonly duration: number;
  readonly loaded: number;
  readonly reserve: number;
}

/**
 * One reload step, or null when there is nothing to do (melee, full, no reserve). A magazine
 * reload puts the rounds of the old magazine back first, so a tactical reload costs nothing;
 * a per-round reload adds one round and repeats.
 */
export const reloadPlan = (stats: WeaponStats, loaded: number, reserve: number): ReloadPlan | null => {
  if (!usesAmmo(stats) || loaded >= stats.magazine || reserve <= 0) return null;
  if (stats.reloadMode === "per-round") return { duration: stats.reload, loaded: loaded + 1, reserve: reserve - 1 };
  const total = loaded + reserve;
  const next = Math.min(stats.magazine, total);
  return { duration: stats.reload, loaded: next, reserve: total - next };
};

export type ModFailure = "not-found" | "incompatible" | "in-use" | "inventory-full" | "empty-slot";

export type InstallModResult =
  | { readonly ok: true; readonly inventory: InventoryState; readonly slot: ModSlot; readonly replaced: string | null }
  | { readonly ok: false; readonly reason: ModFailure };

/** Mounts a bag mod on a weapon. A mod already in that slot goes back to the bag, into the freed cell. */
export const installMod = (inv: InventoryState, eq: Equipment, weaponUid: string, modUid: string): InstallModResult => {
  const weapon = findItem(inv, weaponUid);
  const mod = findItem(inv, modUid);
  if (!weapon || !mod) return { ok: false, reason: "not-found" };
  if (!isWeaponId(weapon.def) || !isModId(mod.def)) return { ok: false, reason: "incompatible" };
  const slot = MOD_CATALOG[mod.def].slot;
  if (!(WEAPON_CATALOG[weapon.def].modSlots as readonly ModSlot[]).includes(slot)) return { ok: false, reason: "incompatible" };
  if (isPlaced(inv, eq, modUid)) return { ok: false, reason: "in-use" };
  const replaced = weapon.mods?.[slot] ?? null;
  return { ok: true, slot, replaced, inventory: updateItem(inv, weaponUid, (w) => ({ ...w, mods: { ...w.mods, [slot]: modUid } })) };
};

export type RemoveModResult =
  | { readonly ok: true; readonly inventory: InventoryState; readonly modUid: string; readonly excess: number }
  | { readonly ok: false; readonly reason: ModFailure };

/**
 * Takes a mod off into a free cell. Rounds above the smaller magazine come out as `excess`
 * (for the pouch).
 */
export const removeMod = (inv: InventoryState, eq: Equipment, weaponUid: string, slot: ModSlot): RemoveModResult => {
  const weapon = findItem(inv, weaponUid);
  if (!weapon) return { ok: false, reason: "not-found" };
  if (!isWeaponId(weapon.def)) return { ok: false, reason: "incompatible" };
  const def = weapon.def;
  const modUid = weapon.mods?.[slot];
  if (modUid === undefined) return { ok: false, reason: "empty-slot" };
  if (freeCells(inv, eq) < 1) return { ok: false, reason: "inventory-full" };
  const mods: Partial<Record<ModSlot, string>> = { ...weapon.mods };
  delete mods[slot];
  let inventory = updateItem(inv, weaponUid, (w) => ({ ...w, mods }));
  const magazine = effectiveWeapon(def, weapon.rarity, mountedMods(inventory, weaponUid)).magazine;
  const loaded = weapon.loaded ?? 0;
  const excess = Math.max(0, loaded - magazine);
  if (excess > 0) inventory = updateItem(inventory, weaponUid, (w) => ({ ...w, loaded: magazine }));
  return { ok: true, inventory, modUid, excess };
};
