import { type CharacterState } from "../character/character";
import { CYBERWARE_CATALOG, type CyberwareId, installCyberware } from "../cyberware/cyberware";
import { type Wallet, debit } from "../economy/wallet";
import { type Inventory, ITEM_CATALOG, type ItemId, addItem } from "../inventory/inventory";
import { type ReputationTier, reputationTier } from "../reputation/reputation";

export type PurchaseFailure = "insufficient-funds" | "already-installed" | "inventory-full" | "refused";

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

/** Buying from the ripperdoc installs immediately; the replaced implant is not refunded. */
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
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: Inventory; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

export const buyItem = (wallet: Wallet, inventory: Inventory, id: ItemId, terms: ShopTerms = STANDARD_TERMS): ItemPurchase => {
  if (!terms.open) return { ok: false, reason: "refused" };
  const next = addItem(inventory, id);
  if (!next) return { ok: false, reason: "inventory-full" };
  const price = priceWithTerms(ITEM_CATALOG[id].price, terms);
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, inventory: next, price };
};
