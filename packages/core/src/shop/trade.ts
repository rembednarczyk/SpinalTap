import { type CharacterState } from "../character/character";
import { CYBERWARE_CATALOG, type CyberwareId, type CyberwareSlot, installCyberware, isCyberwareId, uninstallCyberware } from "../cyberware/cyberware";
import { type Wallet, credit, debit } from "../economy/wallet";
import { conditionFactor } from "../items/armor";
import { WEAPON_CATALOG, isGarmentId, isWeaponId, itemSummary } from "../items/catalog";
import {
  type AmmoPouch,
  BASE_CAPACITY,
  type Equipment,
  type InventoryState,
  type ItemInstance,
  addAmmo,
  addInstance,
  addStack,
  findItem,
  removeInstance,
  removeStack,
  stackCount,
  updateItem,
} from "../items/inventory";
import { RARITY } from "../items/rarity";
import type { ItemDefId, ItemRef, Rarity } from "../items/types";
import type { ReputationTier } from "../reputation/reputation";
import { type PurchaseFailure, type ShopTerms, STANDARD_TERMS, priceWithTerms } from "./ripperdoc";
import { SHOPS, type ShopId, type ShopItemId, stockEntry, stockListPrice } from "./shops";

/**
 * Selling, repairs, the backpack and implants from the bag (plan §6, ADR-0015). Pure functions
 * with `{ ok }` results like the rest of the shop: the UI quotes with the same functions the
 * simulation charges with.
 */

/** Small headroom so a product like 700 × 1.6 × 0.25 never floors to one eddie less. */
const EPS = 1e-9;

/** Share of the value a trader pays for a used piece. */
export const SELL_RATE = 0.25;
/** Share of the value a full repair of a worn-out garment costs. */
export const REPAIR_RATE = 0.3;
/** Eddies one "Części broni" takes off a repair. */
export const PART_DISCOUNT = 25;
/** Share of the value doktor Mori charges for fitting an implant brought in the bag. */
export const INSTALL_RATE = 0.25;
/** Cells each backpack upgrade adds, and what the two upgrades cost, in order. */
export const BACKPACK_STEP = 6;
export const BACKPACK_PRICES: readonly number[] = [600, 1200];

const SELL_FACTOR: Readonly<Record<ReputationTier, number>> = { hostile: 0, wary: 0.75, neutral: 1, friendly: 1.1, trusted: 1.2 };

/** What standing with the trader does to a sale: a wary one pays less, a regular more. */
export const sellFactor = (tier: ReputationTier): number => SELL_FACTOR[tier];

/** A piece as the trader sees it: kind, tier and wear. */
export interface Appraisal {
  readonly def: ItemDefId;
  readonly rarity?: Rarity;
  /** Garments only. */
  readonly condition?: number;
}

/** List value of one piece times its rarity (stacks are common). */
export const itemValue = (item: Appraisal): number => itemSummary(item.def).value * RARITY[item.rarity ?? "common"].value;

/**
 * What the trader pays for one piece: a quarter of the value, scaled by standing and, for
 * garments, by condition. Junk is meant to be sold and fetches its full value.
 */
export const sellPrice = (item: Appraisal, terms: ShopTerms = STANDARD_TERMS): number => {
  const factor = sellFactor(terms.tier);
  if (itemSummary(item.def).category === "junk") return Math.floor(itemValue(item) * factor + EPS);
  const wear = item.condition === undefined ? 1 : conditionFactor(item.condition);
  return Math.floor(itemValue(item) * SELL_RATE * factor * wear + EPS);
};

/** Whether this trader buys this kind of item at all. */
export const shopBuys = (shop: ShopId, def: ItemDefId): boolean => SHOPS[shop].buys.includes(itemSummary(def).category);

export interface TradeState {
  readonly wallet: Wallet;
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly ammo: AmmoPouch;
}

export type TradeFailure = PurchaseFailure;

export type SaleResult =
  | (TradeState & { readonly ok: true; readonly defId: ItemDefId; readonly qty: number; readonly price: number })
  | { readonly ok: false; readonly reason: TradeFailure };

/**
 * Sells `qty` of a stack, or one loose piece. Equipped, mounted and modded pieces are refused
 * ("in-use"); rounds still in a sold gun go back to the pouch first.
 */
export const sell = (state: TradeState, shop: ShopId, ref: ItemRef, qty: number, terms: ShopTerms = STANDARD_TERMS): SaleResult => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const { inventory, equipment } = state;
  if ("stack" in ref) {
    const n = Math.floor(qty);
    if (!shopBuys(shop, ref.stack)) return { ok: false, reason: "not-bought-here" };
    const unit = sellPrice({ def: ref.stack }, terms);
    if (unit === 0) return { ok: false, reason: "worthless" };
    const next = n >= 1 && stackCount(inventory, ref.stack) >= n ? removeStack(inventory, ref.stack, n) : null;
    if (!next) return { ok: false, reason: "not-found" };
    return { ...paid(state, unit * n), ok: true, inventory: next, defId: ref.stack, qty: n, price: unit * n };
  }
  const item = findItem(inventory, ref.uid);
  if (!item) return { ok: false, reason: "not-found" };
  if (!shopBuys(shop, item.def)) return { ok: false, reason: "not-bought-here" };
  const price = sellPrice(item, terms);
  if (price === 0) return { ok: false, reason: "worthless" };
  const removed = removeInstance(inventory, equipment, ref.uid);
  if (!removed.ok) return { ok: false, reason: removed.reason };
  const ammoId = isWeaponId(item.def) ? WEAPON_CATALOG[item.def].ammo : null;
  const ammo = ammoId && (item.loaded ?? 0) > 0 ? addAmmo(state.ammo, ammoId, item.loaded ?? 0).ammo : state.ammo;
  return { ...paid(state, price), ok: true, inventory: removed.inventory, ammo, defId: item.def, qty: 1, price };
};

const paid = (state: TradeState, price: number): TradeState => {
  const r = credit(state.wallet, price);
  return { ...state, wallet: r.ok ? r.wallet : state.wallet };
};

export interface RepairQuote {
  /** Price before parts. */
  readonly base: number;
  /** Parts that will be used (never more than needed or owned). */
  readonly parts: number;
  /** Eddies to pay after parts. */
  readonly price: number;
}

/** Full repair of a garment: 30% of its value for the missing condition, minus 25 €$ a part. */
export const repairQuote = (item: Appraisal, useParts: number, partsOwned: number): RepairQuote => {
  const missing = (100 - Math.max(0, Math.min(100, item.condition ?? 100))) / 100;
  const base = Math.ceil(itemValue(item) * REPAIR_RATE * missing - EPS);
  const parts = Math.max(0, Math.min(Math.floor(useParts), partsOwned, Math.ceil(base / PART_DISCOUNT)));
  return { base, parts, price: Math.max(0, base - parts * PART_DISCOUNT) };
};

export type RepairResult =
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: InventoryState; readonly price: number; readonly parts: number }
  | { readonly ok: false; readonly reason: TradeFailure };

/** Mends a garment (worn or in the bag) back to 100. */
export const repair = (wallet: Wallet, inventory: InventoryState, uid: string, useParts = 0, terms: ShopTerms = STANDARD_TERMS): RepairResult => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const item = findItem(inventory, uid);
  if (!item) return { ok: false, reason: "not-found" };
  if (!isGarmentId(item.def) || (item.condition ?? 100) >= 100) return { ok: false, reason: "not-damaged" };
  const quote = repairQuote(item, useParts, stackCount(inventory, "weapon_parts"));
  const pay = quote.price === 0 ? { ok: true as const, wallet } : debit(wallet, quote.price);
  if (!pay.ok) return { ok: false, reason: "insufficient-funds" };
  const withoutParts = quote.parts > 0 ? (removeStack(inventory, "weapon_parts", quote.parts) ?? inventory) : inventory;
  return { ok: true, wallet: pay.wallet, inventory: updateItem(withoutParts, uid, (i) => ({ ...i, condition: 100 })), price: quote.price, parts: quote.parts };
};

/** Price of the next backpack upgrade, or null once the bag is as big as it gets. */
export const backpackPrice = (inventory: Pick<InventoryState, "capacity">): number | null =>
  BACKPACK_PRICES[Math.floor((inventory.capacity - BASE_CAPACITY) / BACKPACK_STEP)] ?? null;

export type BackpackResult =
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: InventoryState; readonly price: number }
  | { readonly ok: false; readonly reason: TradeFailure };

/** +6 cells, twice: 600 €$, then 1200 €$ (24 → 30 → 36). */
export const upgradeBackpack = (wallet: Wallet, inventory: InventoryState, terms: ShopTerms = STANDARD_TERMS): BackpackResult => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const price = backpackPrice(inventory);
  if (price === null) return { ok: false, reason: "max-capacity" };
  const pay = debit(wallet, price);
  if (!pay.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: pay.wallet, inventory: { ...inventory, capacity: inventory.capacity + BACKPACK_STEP }, price };
};

export type StockPurchase =
  | (TradeState & { readonly ok: true; readonly price: number; readonly added: ItemInstance | null; readonly qty: number })
  | { readonly ok: false; readonly reason: TradeFailure };

/**
 * Buys one entry of a shop's stock: a piece into a free cell, one of a stack, or a whole box of
 * rounds into the pouch (refused when the box does not fit, so nobody pays for lost rounds).
 */
export const buyStock = (state: TradeState, shop: ShopId, itemId: ShopItemId, terms: ShopTerms = STANDARD_TERMS): StockPurchase => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const entry = stockEntry(shop, itemId);
  if (!entry) return { ok: false, reason: "not-sold-here" };
  const price = priceWithTerms(stockListPrice(entry), terms);
  let next: TradeState;
  let added: ItemInstance | null = null;
  let qty = 1;
  if (entry.kind === "ammo") {
    const r = addAmmo(state.ammo, entry.item, entry.qty);
    if (r.added < entry.qty) return { ok: false, reason: "inventory-full" };
    next = { ...state, ammo: r.ammo };
    qty = entry.qty;
  } else if (entry.kind === "stack") {
    const r = addStack(state.inventory, state.equipment, entry.item, 1);
    if (r.added === 0) return { ok: false, reason: "inventory-full" };
    next = { ...state, inventory: r.inventory };
  } else {
    const r = addInstance(state.inventory, state.equipment, entry.item, entry.rarity);
    if (!r.ok) return { ok: false, reason: "inventory-full" };
    next = { ...state, inventory: r.inventory };
    added = r.item;
  }
  const pay = debit(state.wallet, price);
  if (!pay.ok) return { ok: false, reason: "insufficient-funds" };
  return { ...next, ok: true, wallet: pay.wallet, price, added, qty };
};

// ---- implants as items (E11) ----

/** Doktor Mori's fee for fitting an implant from the bag: a quarter of its value, after terms. */
export const installFee = (item: { readonly def: CyberwareId; readonly rarity?: Rarity }, terms: ShopTerms = STANDARD_TERMS): number =>
  priceWithTerms(Math.round(CYBERWARE_CATALOG[item.def].price * RARITY[item.rarity ?? "common"].value * INSTALL_RATE), terms);

/** Puts a removed implant into the bag when a cell is free; null when it does not fit (it is lost). */
export const stowImplant = (inventory: InventoryState, equipment: Equipment, id: CyberwareId): { inventory: InventoryState; item: ItemInstance | null } => {
  const r = addInstance(inventory, equipment, id, "common");
  return r.ok ? { inventory: r.inventory, item: r.item } : { inventory, item: null };
};

export type ImplantFitting =
  | {
      readonly ok: true;
      readonly wallet: Wallet;
      readonly character: CharacterState;
      readonly inventory: InventoryState;
      readonly cyberwareId: CyberwareId;
      readonly fee: number;
      readonly replaced: CyberwareId | null;
      /** The replaced implant, back in the bag (always fits: the fitted one freed its cell). */
      readonly returned: ItemInstance | null;
    }
  | { readonly ok: false; readonly reason: TradeFailure };

/** Fits an implant from the bag; the one it replaces goes back into the bag. */
export const installCyberwareItem = (
  wallet: Wallet,
  character: CharacterState,
  inventory: InventoryState,
  equipment: Equipment,
  uid: string,
  terms: ShopTerms = STANDARD_TERMS,
): ImplantFitting => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const item = findItem(inventory, uid);
  if (!item) return { ok: false, reason: "not-found" };
  const id = item.def;
  if (!isCyberwareId(id)) return { ok: false, reason: "not-sold-here" };
  if (character.cyberware[CYBERWARE_CATALOG[id].slot] === id) return { ok: false, reason: "already-installed" };
  const fee = installFee({ def: id, rarity: item.rarity }, terms);
  const pay = fee === 0 ? { ok: true as const, wallet } : debit(wallet, fee);
  if (!pay.ok) return { ok: false, reason: "insufficient-funds" };
  const removed = removeInstance(inventory, equipment, uid);
  if (!removed.ok) return { ok: false, reason: removed.reason };
  const { loadout, replaced } = installCyberware(character.cyberware, id);
  const stowed = replaced ? stowImplant(removed.inventory, equipment, replaced) : { inventory: removed.inventory, item: null };
  return { ok: true, wallet: pay.wallet, character: { ...character, cyberware: loadout }, inventory: stowed.inventory, cyberwareId: id, fee, replaced, returned: stowed.item };
};

export type ImplantRemoval =
  | { readonly ok: true; readonly character: CharacterState; readonly inventory: InventoryState; readonly cyberwareId: CyberwareId; readonly item: ItemInstance }
  | { readonly ok: false; readonly reason: TradeFailure };

/** Takes an implant out, free of charge, into the bag. Needs a free cell. */
export const removeCyberware = (character: CharacterState, inventory: InventoryState, equipment: Equipment, slot: CyberwareSlot): ImplantRemoval => {
  const id = character.cyberware[slot];
  if (id === undefined) return { ok: false, reason: "empty-slot" };
  const stowed = stowImplant(inventory, equipment, id);
  if (!stowed.item) return { ok: false, reason: "inventory-full" };
  return { ok: true, character: { ...character, cyberware: uninstallCyberware(character.cyberware, slot) }, inventory: stowed.inventory, cyberwareId: id, item: stowed.item };
};
