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

/** Why Mori refuses a respec ("refused": basic terms, "empty-slot": nothing was spent). */
export type RespecFailure = Extract<PurchaseFailure, "refused" | "empty-slot" | "insufficient-funds">;

export type RespecResult =
  | { readonly ok: true; readonly wallet: Wallet; readonly progression: ProgressionState; readonly price: number }
  | { readonly ok: false; readonly reason: RespecFailure };

/**
 * Doktor Mori's respec (ADR-0059): cyberware work, so refused on basic terms like the implants.
 * "empty-slot": nothing was spent. Implants that no longer fit the pool once Tech and Overclock
 * are gone stay in (stage 3b): the pool shows the excess until she takes some out, and a new
 * implant does not go in over it.
 */
export const buyRespec = (wallet: Wallet, state: ProgressionState, terms: ShopTerms): RespecResult => {
  if (!fullService(terms)) return { ok: false, reason: "refused" };
  if (!canRespec(state)) return { ok: false, reason: "empty-slot" };
  const price = respecPrice(state.level, terms);
  const paid = debit(wallet, price);
  if (!paid.ok) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: paid.wallet, progression: resetProgression(state), price };
};

/** Why the respec would be refused now, or null when it goes through: the same checks, for the counter's own message. */
export const respecRefusal = (wallet: Wallet, state: ProgressionState, terms: ShopTerms): RespecFailure | null => {
  const r = buyRespec(wallet, state, terms);
  return r.ok ? null : r.reason;
};
