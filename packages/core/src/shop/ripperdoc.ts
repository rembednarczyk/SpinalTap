import { type CharacterState } from "../character/character";
import { CYBERWARE_CATALOG, type CyberwareId, installCyberware } from "../cyberware/cyberware";
import { type Wallet, debit } from "../economy/wallet";
import { STACKABLE_CATALOG } from "../items/catalog";
import { type Equipment, type InventoryState, addStack } from "../items/inventory";
import type { StackableId } from "../items/types";
import { type ReputationTier, reputationTier } from "../reputation/reputation";

/**
 * Why a trade did not happen. "closed": the stall is shut at this hour; "not-sold-here": not in
 * this shop's stock (or not an implant); "not-bought-here": the trader does not buy that kind;
 * "worthless": nobody pays for it (the starter optics); "in-use": equipped, mounted or modded.
 */
export type PurchaseFailure =
  | "insufficient-funds"
  | "already-installed"
  | "inventory-full"
  | "refused"
  | "closed"
  | "not-found"
  | "in-use"
  | "not-sold-here"
  | "not-bought-here"
  | "worthless"
  | "not-damaged"
  | "max-capacity"
  | "empty-slot";

/** How a shop treats the player, derived from the shop owner's faction standing. */
export interface ShopTerms {
  /** False when the owner refuses to serve the player at all. */
  readonly open: boolean;
  /** Applied to every list price (1 = list price). */
  readonly multiplier: number;
  readonly tier: ReputationTier;
}

const MULTIPLIER: Readonly<Record<ReputationTier, number>> = { hostile: 1, wary: 1.25, neutral: 1, friendly: 0.9, trusted: 0.8 };

/** Hostile: no service. Wary: surcharge. Friendly and trusted: regulars' discount. */
export const shopTerms = (reputation: number): ShopTerms => {
  const tier = reputationTier(reputation);
  return { open: tier !== "hostile", multiplier: MULTIPLIER[tier], tier };
};

export const STANDARD_TERMS: ShopTerms = shopTerms(0);

/** Integer price after terms. Free stays free, anything else costs at least 1. */
export const priceWithTerms = (listPrice: number, terms: ShopTerms): number =>
  listPrice === 0 ? 0 : Math.max(1, Math.round(listPrice * terms.multiplier));

export type CyberwarePurchase =
  | { readonly ok: true; readonly wallet: Wallet; readonly character: CharacterState; readonly replaced: CyberwareId | null; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/**
 * Buying from the ripperdoc installs immediately. The replaced implant is not refunded; the
 * simulation puts it into the bag with `stowImplant` when a cell is free (ADR-0015).
 */
export const buyCyberware = (wallet: Wallet, character: CharacterState, id: CyberwareId, terms: ShopTerms = STANDARD_TERMS): CyberwarePurchase => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const def = CYBERWARE_CATALOG[id];
  if (character.cyberware[def.slot] === id) return { ok: false, reason: "already-installed" };
  const price = priceWithTerms(def.price, terms);
  const paid = price === 0 ? { ok: true as const, wallet } : debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  const { loadout, replaced } = installCyberware(character.cyberware, id);
  return { ok: true, wallet: paid.wallet, character: { ...character, cyberware: loadout }, replaced, price };
};

export type ItemPurchase =
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: InventoryState; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/** Buys one piece of a stackable item into the bag. */
export const buyItem = (
  wallet: Wallet,
  inventory: InventoryState,
  equipment: Equipment,
  id: StackableId,
  terms: ShopTerms = STANDARD_TERMS,
): ItemPurchase => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const next = addStack(inventory, equipment, id, 1);
  if (next.added === 0) return { ok: false, reason: "inventory-full" };
  const price = priceWithTerms(STACKABLE_CATALOG[id].value, terms);
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, inventory: next.inventory, price };
};
