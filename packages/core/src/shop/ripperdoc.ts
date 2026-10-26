import { type CharacterState } from "../character/character";
import { CYBERWARE_CATALOG, type CyberwareId, installCyberware } from "../cyberware/cyberware";
import { type Wallet, debit } from "../economy/wallet";
import { type Inventory, ITEM_CATALOG, type ItemId, addItem } from "../inventory/inventory";

export type PurchaseFailure = "insufficient-funds" | "already-installed" | "inventory-full";

export type CyberwarePurchase =
  | { readonly ok: true; readonly wallet: Wallet; readonly character: CharacterState; readonly replaced: CyberwareId | null; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/** Buying from the ripperdoc installs immediately; the replaced implant is not refunded. */
export const buyCyberware = (wallet: Wallet, character: CharacterState, id: CyberwareId): CyberwarePurchase => {
  const def = CYBERWARE_CATALOG[id];
  if (character.cyberware[def.slot] === id) return { ok: false, reason: "already-installed" };
  const paid = def.price === 0 ? { ok: true as const, wallet } : debit(wallet, def.price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  const { loadout, replaced } = installCyberware(character.cyberware, id);
  return { ok: true, wallet: paid.wallet, character: { ...character, cyberware: loadout }, replaced, price: def.price };
};

export type ItemPurchase =
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: Inventory; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

export const buyItem = (wallet: Wallet, inventory: Inventory, id: ItemId): ItemPurchase => {
  const next = addItem(inventory, id);
  if (!next) return { ok: false, reason: "inventory-full" };
  const price = ITEM_CATALOG[id].price;
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, inventory: next, price };
};
