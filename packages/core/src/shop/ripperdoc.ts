import { type CharacterState } from "../character/character";
import { fitImplant, isGradedImplant, isInstalled } from "../cyberware/cyberdeck";
import type { ImplantGrade } from "../cyberware/implant-grade";
import { CYBERWARE_CATALOG, type CyberwareId } from "../cyberware/cyberware";
import { fitsCapacity } from "../cyberware/capacity";
import { type Wallet, debit } from "../economy/wallet";
import { STACKABLE_CATALOG, type StackableDefinition } from "../items/catalog";
import { MIN_ITEM_LEVEL, clampItemLevel, levelScale } from "../items/grade";
import { RARITIES, RARITY } from "../items/rarity";
import { type Equipment, type InventoryState, addStack } from "../items/inventory";
import type { StackableId } from "../items/types";
import { type ReputationTier, reputationTier } from "../reputation/reputation";
import { SHOP_RARITY_STEPS, SHOP_TOP_RARITY } from "./shops";

/**
 * Why a trade did not happen. "closed": the stall is shut at this hour; "not-sold-here": not in
 * this shop's stock (or not an implant); "not-bought-here": the trader does not buy that kind;
 * "worthless": nobody pays for it (the starter optics); "in-use": equipped, mounted or modded;
 * "over-capacity": the implant does not fit into the cyberware capacity (ADR-0033).
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
  | "empty-slot"
  | "over-capacity";

/**
 * What the counter offers (ADR-0070). "full": everything. "basic": only ammo and stacks (food,
 * medkits, bandages); weapons, clothes, mods, backpacks, repairs, implants, the capacity shard
 * (cyberware work, decision 5.11) and combat stims (decision 6.11) are refused.
 */
export type ShopStock = "full" | "basic";

/** How a shop treats the player, derived from the shop owner's faction standing. */
export interface ShopTerms {
  /** Applied to every list price (1 = list price). */
  readonly multiplier: number;
  readonly tier: ReputationTier;
  readonly stock: ShopStock;
}

const MULTIPLIER: Readonly<Record<ReputationTier, number>> = { hostile: 1.5, wary: 1.25, neutral: 1, friendly: 0.9, trusted: 0.8 };

/**
 * Traders never shut the door on reputation alone (ADR-0070): a hostile one charges half again
 * and sells only the basics, a wary one adds a surcharge, friendly and trusted give a discount.
 */
export const shopTerms = (reputation: number): ShopTerms => {
  const tier = reputationTier(reputation);
  return { multiplier: MULTIPLIER[tier], tier, stock: tier === "hostile" ? "basic" : "full" };
};

/** Whether the terms cover more than the basics: pieces, implants, repairs and backpacks. */
export const fullService = (terms: ShopTerms): boolean => terms.stock === "full";

/**
 * A stack that changes the body's cyberware (the capacity shard) is clinic work, and a combat
 * stim is no basic either (decision 6.11): a hostile counter sells neither.
 */
export const isBasicStack = (id: StackableId): boolean => {
  const def: StackableDefinition = STACKABLE_CATALOG[id];
  return def.cyberCapacity === undefined && def.combatStim !== true;
};

/** Whether the terms let this stack be sold: basics always, cyberware work only on full terms. */
export const offersStack = (id: StackableId, terms: ShopTerms): boolean => fullService(terms) || isBasicStack(id);

export const STANDARD_TERMS: ShopTerms = shopTerms(0);

/** Integer price after terms. Free stays free, anything else costs at least 1. */
export const priceWithTerms = (listPrice: number, terms: ShopTerms): number =>
  listPrice === 0 ? 0 : Math.max(1, Math.round(listPrice * terms.multiplier));

export type CyberwarePurchase =
  | {
      readonly ok: true;
      readonly wallet: Wallet;
      readonly character: CharacterState;
      readonly replaced: CyberwareId | null;
      /** The grade of the replaced implant, when it was a deck. */
      readonly replacedGrade?: ImplantGrade;
      readonly price: number;
    }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/** What Mori fits: an implant, and a deck with the tier her standing brings out and the player's level. */
export interface ImplantOffer {
  readonly grade?: ImplantGrade;
  /** Before the terms: price × tier × level for a deck (ADR-0059), the catalog price otherwise. */
  readonly listPrice: number;
}

/**
 * The clinic's offer of an implant (decision of 6.11 after ADR-0059 stage 6). A deck keeps up with
 * the player like the counter's weapons (`stockGrade`): her level, common on neutral terms, a tier
 * better for a friendly clinic, two for a trusted one, never past rare.
 */
export const implantOffer = (id: CyberwareId, tier: ReputationTier = "neutral", level: number = MIN_ITEM_LEVEL): ImplantOffer => {
  const def = CYBERWARE_CATALOG[id];
  if (!isGradedImplant(id)) return { listPrice: def.price };
  const rarity = RARITIES[Math.min(RARITIES.indexOf(SHOP_TOP_RARITY), SHOP_RARITY_STEPS[tier])]!;
  const grade: ImplantGrade = { rarity, level: clampItemLevel(level) };
  return { grade, listPrice: Math.round(def.price * RARITY[rarity].value * levelScale(grade.level)) };
};

/**
 * Buying from the ripperdoc installs immediately. The replaced implant is not refunded; the
 * simulation puts it into the bag with `stowImplant` when a cell is free (ADR-0015). An implant
 * past the cyberware capacity `capacity` is refused (ADR-0033); without it there is no limit. A
 * deck comes in the grade of `implantOffer` at the player's `level`; one of another grade may
 * replace the deck she has.
 */
export const buyCyberware = (
  wallet: Wallet,
  character: CharacterState,
  id: CyberwareId,
  terms: ShopTerms = STANDARD_TERMS,
  capacity = Infinity,
  level: number = MIN_ITEM_LEVEL,
): CyberwarePurchase => {
  if (!fullService(terms)) return { ok: false, reason: "refused" };
  const offer = implantOffer(id, terms.tier, level);
  if (isInstalled(character, id, offer.grade)) return { ok: false, reason: "already-installed" };
  if (!fitsCapacity(character.cyberware, id, capacity)) return { ok: false, reason: "over-capacity" };
  const price = priceWithTerms(offer.listPrice, terms);
  const paid = price === 0 ? { ok: true as const, wallet } : debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  const fit = fitImplant(character, id, offer.grade);
  return { ok: true, wallet: paid.wallet, character: fit.character, replaced: fit.replaced, ...(fit.replacedGrade ? { replacedGrade: fit.replacedGrade } : {}), price };
};

export type ItemPurchase =
  | { readonly ok: true; readonly wallet: Wallet; readonly inventory: InventoryState; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/** Buys one piece of a stackable item into the bag; basics sell on any terms (`offersStack`). */
export const buyItem = (
  wallet: Wallet,
  inventory: InventoryState,
  equipment: Equipment,
  id: StackableId,
  terms: ShopTerms = STANDARD_TERMS,
): ItemPurchase => {
  if (!offersStack(id, terms)) return { ok: false, reason: "refused" };
  const next = addStack(inventory, equipment, id, 1);
  if (next.added === 0) return { ok: false, reason: "inventory-full" };
  const price = priceWithTerms(STACKABLE_CATALOG[id].value, terms);
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, inventory: next.inventory, price };
};
