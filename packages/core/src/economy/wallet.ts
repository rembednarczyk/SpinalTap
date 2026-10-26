/** Eddies (eurodollars), the street currency. Integer amounts only. */
export interface Wallet {
  readonly eddies: number;
}

export type TransactionResult =
  | { readonly ok: true; readonly wallet: Wallet }
  | { readonly ok: false; readonly reason: "insufficient-funds" | "invalid-amount" };

const validAmount = (amount: number): boolean => Number.isInteger(amount) && amount > 0;

export const createWallet = (eddies = 0): Wallet => ({ eddies });

export const credit = (wallet: Wallet, amount: number): TransactionResult =>
  validAmount(amount) ? { ok: true, wallet: { eddies: wallet.eddies + amount } } : { ok: false, reason: "invalid-amount" };

export const debit = (wallet: Wallet, amount: number): TransactionResult => {
  if (!validAmount(amount)) return { ok: false, reason: "invalid-amount" };
  if (wallet.eddies < amount) return { ok: false, reason: "insufficient-funds" };
  return { ok: true, wallet: { eddies: wallet.eddies - amount } };
};

/** A fixer contract payout, adjusted by the player's standing with the fixer. */
export const contractPayout = (base: number, fixerReputation: number): number =>
  Math.round(base * (1 + Math.max(-0.5, Math.min(0.5, fixerReputation / 200))));
