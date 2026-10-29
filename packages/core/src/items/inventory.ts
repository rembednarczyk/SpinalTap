import type { Health } from "../combat/combat-rules";
import { AMMO_CATALOG, GARMENT_CATALOG, STACKABLE_CATALOG, type StackableDefinition, WEAPON_CATALOG, isGarmentId, isWeaponId } from "./catalog";
import type { AmmoId, ConsumableId, EquipSlot, InstanceDefId, ModSlot, Rarity, StackableId, WeaponSlot } from "./types";

/** One piece with state of its own. Where it is (bag, slot, weapon) is said by `Equipment` and `mods`. */
export interface ItemInstance {
  readonly uid: string;
  readonly def: InstanceDefId;
  readonly rarity: Rarity;
  /** Rounds in the magazine (firearms). */
  readonly loaded?: number;
  /** Mounted mods by slot, as uids of instances in the same inventory (weapons). */
  readonly mods?: Readonly<Partial<Record<ModSlot, string>>>;
  /** 0..100 (garments). */
  readonly condition?: number;
}

export interface InventoryState {
  readonly stacks: Readonly<Partial<Record<StackableId, number>>>;
  /** Every instance the player owns, in pick-up order: in the bag, equipped or mounted. */
  readonly items: readonly ItemInstance[];
  /** Story items from ink. They take no cells and cannot be dropped or sold. */
  readonly keyItems: readonly string[];
  /** Cells in the bag (24, up to 36 with backpack upgrades). */
  readonly capacity: number;
  /** Next instance number; uids are "i1", "i2", ... with no randomness and no clock. */
  readonly nextUid: number;
}

export interface Equipment {
  readonly primary: string | null;
  readonly secondary: string | null;
  readonly melee: string | null;
  readonly head: string | null;
  readonly torso: string | null;
  readonly legs: string | null;
  /** The weapon slot in hand (or holstered). */
  readonly active: WeaponSlot;
}

/** Rounds per ammo type, outside the cells. */
export type AmmoPouch = Readonly<Partial<Record<AmmoId, number>>>;

export const BASE_CAPACITY = 24;
export const MAX_CAPACITY = 36;
export const EQUIP_SLOTS: readonly EquipSlot[] = ["primary", "secondary", "melee", "head", "torso", "legs"];
export const WEAPON_SLOTS: readonly WeaponSlot[] = ["primary", "secondary", "melee"];

export const EMPTY_EQUIPMENT: Equipment = { primary: null, secondary: null, melee: null, head: null, torso: null, legs: null, active: "secondary" };
export const EMPTY_INVENTORY: InventoryState = { stacks: {}, items: [], keyItems: [], capacity: BASE_CAPACITY, nextUid: 1 };

export type InventoryFailure = "not-found" | "inventory-full" | "not-equippable" | "wrong-slot" | "already-equipped" | "empty-slot" | "in-use";

/** A fresh piece: firearms empty, garments in mint condition. */
export const newInstance = (uid: string, def: InstanceDefId, rarity: Rarity): ItemInstance => {
  if (isWeaponId(def)) return { uid, def, rarity, loaded: 0, mods: {} };
  if (isGarmentId(def)) return { uid, def, rarity, condition: 100 };
  return { uid, def, rarity };
};

/** What a new game starts with: Unity-9 loaded, jacket, cargo pants, a medkit and 48 rounds. */
export const starterKit = (): { inventory: InventoryState; equipment: Equipment; ammo: AmmoPouch } => ({
  inventory: {
    stacks: { medkit: 1 },
    items: [{ ...newInstance("i1", "unity9", "common"), loaded: 12 }, newInstance("i2", "seki_jacket", "common"), newInstance("i3", "cargo_pants", "common")],
    keyItems: [],
    capacity: BASE_CAPACITY,
    nextUid: 4,
  },
  equipment: { ...EMPTY_EQUIPMENT, secondary: "i1", torso: "i2", legs: "i3" },
  ammo: { "9mm": 48 },
});

export const findItem = (inv: InventoryState, uid: string): ItemInstance | undefined => inv.items.find((i) => i.uid === uid);

export const stackCount = (inv: InventoryState, id: StackableId): number => inv.stacks[id] ?? 0;

/** Equipped or mounted on a weapon: such a piece takes no bag cell. */
export const isPlaced = (inv: InventoryState, eq: Equipment, uid: string): boolean =>
  EQUIP_SLOTS.some((s) => eq[s] === uid) || inv.items.some((i) => i.mods !== undefined && Object.values(i.mods).includes(uid));

/** Bag cells in use: one per loose instance, one per started stack of each id. */
export const usedCells = (inv: InventoryState, eq: Equipment): number => {
  let cells = 0;
  for (const i of inv.items) if (!isPlaced(inv, eq, i.uid)) cells += 1;
  for (const [id, n] of Object.entries(inv.stacks) as [StackableId, number][]) cells += Math.ceil(n / STACKABLE_CATALOG[id].stack);
  return cells;
};

export const freeCells = (inv: InventoryState, eq: Equipment): number => Math.max(0, inv.capacity - usedCells(inv, eq));

/** How many more of a stackable fit: the rest of the last started cell plus whole free cells. */
export const stackRoom = (inv: InventoryState, eq: Equipment, id: StackableId): number => {
  const limit = STACKABLE_CATALOG[id].stack;
  const rest = stackCount(inv, id) % limit;
  return (rest === 0 ? 0 : limit - rest) + freeCells(inv, eq) * limit;
};

/** Adds as many as fit; `added` may be less than `qty` (0 when the bag is full). */
export const addStack = (inv: InventoryState, eq: Equipment, id: StackableId, qty: number): { inventory: InventoryState; added: number } => {
  const added = Math.max(0, Math.min(Math.floor(qty), stackRoom(inv, eq, id)));
  if (added === 0) return { inventory: inv, added };
  return { inventory: { ...inv, stacks: { ...inv.stacks, [id]: stackCount(inv, id) + added } }, added };
};

/** Removes `qty` of a stack; null when there are fewer. The id disappears at zero. */
export const removeStack = (inv: InventoryState, id: StackableId, qty: number): InventoryState | null => {
  const have = stackCount(inv, id);
  if (qty <= 0 || have < qty) return null;
  const stacks: Partial<Record<StackableId, number>> = { ...inv.stacks };
  if (have === qty) delete stacks[id];
  else stacks[id] = have - qty;
  return { ...inv, stacks };
};

export type AddInstanceResult =
  | { readonly ok: true; readonly inventory: InventoryState; readonly item: ItemInstance }
  | { readonly ok: false; readonly reason: "inventory-full" };

/** Adds a new piece (with the next uid) into a free cell. `patch` sets e.g. rounds already loaded. */
export const addInstance = (
  inv: InventoryState,
  eq: Equipment,
  def: InstanceDefId,
  rarity: Rarity,
  patch: Partial<Pick<ItemInstance, "loaded" | "condition">> = {},
): AddInstanceResult => {
  if (freeCells(inv, eq) < 1) return { ok: false, reason: "inventory-full" };
  const item = { ...newInstance(`i${inv.nextUid}`, def, rarity), ...patch };
  return { ok: true, item, inventory: { ...inv, items: [...inv.items, item], nextUid: inv.nextUid + 1 } };
};

export type RemoveInstanceResult =
  | { readonly ok: true; readonly inventory: InventoryState; readonly item: ItemInstance }
  | { readonly ok: false; readonly reason: "not-found" | "in-use" };

/** Takes a loose piece out of the bag. Equipped, mounted and modded pieces are refused ("in-use"). */
export const removeInstance = (inv: InventoryState, eq: Equipment, uid: string): RemoveInstanceResult => {
  const item = findItem(inv, uid);
  if (!item) return { ok: false, reason: "not-found" };
  if (isPlaced(inv, eq, uid) || Object.keys(item.mods ?? {}).length > 0) return { ok: false, reason: "in-use" };
  return { ok: true, item, inventory: { ...inv, items: inv.items.filter((i) => i.uid !== uid) } };
};

/** Replaces one instance (same uid) with an updated copy. */
export const updateItem = (inv: InventoryState, uid: string, update: (item: ItemInstance) => ItemInstance): InventoryState => ({
  ...inv,
  items: inv.items.map((i) => (i.uid === uid ? update(i) : i)),
});

/** The slot a piece goes to, or null when it cannot be equipped. */
export const slotFor = (def: InstanceDefId): EquipSlot | null => {
  if (isWeaponId(def)) return WEAPON_CATALOG[def].slot;
  if (isGarmentId(def)) return GARMENT_CATALOG[def].slot;
  return null;
};

export type EquipResult =
  | { readonly ok: true; readonly equipment: Equipment; readonly slot: EquipSlot; readonly replaced: string | null }
  | { readonly ok: false; readonly reason: InventoryFailure };

/**
 * Puts a bag piece into its slot. The piece that was there goes back to the bag, into the
 * cell the new one leaves, so equipping never needs room.
 */
export const equip = (inv: InventoryState, eq: Equipment, uid: string, slot?: EquipSlot): EquipResult => {
  const item = findItem(inv, uid);
  if (!item) return { ok: false, reason: "not-found" };
  const target = slotFor(item.def);
  if (target === null) return { ok: false, reason: "not-equippable" };
  if (slot !== undefined && slot !== target) return { ok: false, reason: "wrong-slot" };
  if (isPlaced(inv, eq, uid)) return { ok: false, reason: "already-equipped" };
  return { ok: true, slot: target, replaced: eq[target], equipment: { ...eq, [target]: uid } };
};

export type UnequipResult =
  | { readonly ok: true; readonly equipment: Equipment; readonly uid: string }
  | { readonly ok: false; readonly reason: "empty-slot" | "inventory-full" };

/** Moves the piece in `slot` to the bag; needs a free cell. The active weapon slot stays selected. */
export const unequip = (inv: InventoryState, eq: Equipment, slot: EquipSlot): UnequipResult => {
  const uid = eq[slot];
  if (uid === null) return { ok: false, reason: "empty-slot" };
  if (freeCells(inv, eq) < 1) return { ok: false, reason: "inventory-full" };
  return { ok: true, uid, equipment: { ...eq, [slot]: null } };
};

export type UseResult =
  | { readonly ok: true; readonly inventory: InventoryState; readonly health: Health; readonly healed: number }
  | { readonly ok: false; readonly reason: "none" | "full-health" };

/**
 * Is the consumable only worth using when hurt? Medical kit and plain food are; anything that
 * starts a buff or grows the cyberware capacity (ADR-0033) is used at full health too.
 */
export const needsWounds = (id: ConsumableId): boolean => {
  const def: StackableDefinition = STACKABLE_CATALOG[id];
  return def.buff === undefined && def.cyberCapacity === undefined;
};

/** Uses one consumable. At full health it is kept, unless it does more than heal (`needsWounds`). */
export const useConsumable = (inv: InventoryState, id: ConsumableId, health: Health): UseResult => {
  const inventory = removeStack(inv, id, 1);
  if (!inventory) return { ok: false, reason: "none" };
  if (health.current >= health.max && needsWounds(id)) return { ok: false, reason: "full-health" };
  const current = Math.min(health.max, health.current + STACKABLE_CATALOG[id].heal);
  return { ok: true, inventory, health: { ...health, current }, healed: current - health.current };
};

export const ammoCount = (pouch: AmmoPouch, id: AmmoId): number => pouch[id] ?? 0;

/** Adds rounds up to the pouch limit; the rest stays wherever it came from. */
export const addAmmo = (pouch: AmmoPouch, id: AmmoId, qty: number): { ammo: AmmoPouch; added: number } => {
  const added = Math.max(0, Math.min(Math.floor(qty), AMMO_CATALOG[id].limit - ammoCount(pouch, id)));
  return { ammo: added === 0 ? pouch : { ...pouch, [id]: ammoCount(pouch, id) + added }, added };
};

/** Sets the count of one ammo type (reloads); never below zero. */
export const setAmmo = (pouch: AmmoPouch, id: AmmoId, qty: number): AmmoPouch => ({ ...pouch, [id]: Math.max(0, qty) });
