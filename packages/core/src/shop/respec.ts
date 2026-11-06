import { type Wallet, debit } from "../economy/wallet";
import { type ProgressionState, pointsSpent, resetProgression, respecListPrice } from "../progression/progression";
import { type PurchaseFailure, type ShopTerms, fullService, priceWithTerms } from "./ripperdoc";

/** What a respec at Mori's costs on these terms: the level's list price after the standing (ADR-0059, ADR-0070). */
export const respecPrice = (level: number, terms: ShopTerms): number => priceWithTerms(respecListPrice(level), terms);

/** Is there anything for a respec to give back? */
export const canRespec = (state: ProgressionState): boolean => {
  const spent = pointsSpent(state);
  return spent.attribute + spent.perk > 0;
};

export type RespecResult =
  | { readonly ok: true; readonly wallet: Wallet; readonly progression: ProgressionState; readonly price: number }
  | { readonly ok: false; readonly reason: PurchaseFailure };

/**
 * Doktor Mori's respec (ADR-0059): cyberware work, so refused on basic terms like the implants.
 * `implantsFit` says whether the implants fit the pool once Tech and the perks are gone; if not,
 * the player takes some out first (free at the same counter). "empty-slot": nothing was spent.
 */
export const buyRespec = (wallet: Wallet, state: ProgressionState, terms: ShopTerms, implantsFit: (after: ProgressionState) => boolean): RespecResult => {
  if (!fullService(terms)) return { ok: false, reason: "refused" };
  if (!canRespec(state)) return { ok: false, reason: "empty-slot" };
  const progression = resetProgression(state);
  if (!implantsFit(progression)) return { ok: false, reason: "over-capacity" };
  const price = respecPrice(state.level, terms);
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, progression, price };
};
