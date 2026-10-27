import type { Rarity } from "./types";

export interface RarityTier {
  /** Label shown next to the frame colour (never colour alone). */
  readonly label: string;
  /** Weapon damage multiplier. */
  readonly damage: number;
  /** Weapon base spread multiplier. */
  readonly spread: number;
  /** Extra armor on a garment's main zone. */
  readonly armor: number;
  /** Value multiplier (shop price, sale). */
  readonly value: number;
}

/** Fixed per tier, so a saved item needs only its tier. Unique items carry their own numbers. */
export const RARITY: Readonly<Record<Rarity, RarityTier>> = {
  common: { label: "zwykły", damage: 1, spread: 1, armor: 0, value: 1 },
  uncommon: { label: "niezwykły", damage: 1.08, spread: 0.92, armor: 1, value: 1.6 },
  rare: { label: "rzadki", damage: 1.16, spread: 0.85, armor: 2, value: 2.6 },
  unique: { label: "unikat", damage: 1, spread: 1, armor: 0, value: 1 },
};

export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "unique"];

export const isRarity = (v: unknown): v is Rarity => typeof v === "string" && (RARITIES as readonly string[]).includes(v);

/** Rarest of the given tiers, or null for none. */
export const bestRarity = (tiers: readonly Rarity[]): Rarity | null =>
  tiers.reduce<Rarity | null>((best, r) => (best === null || RARITIES.indexOf(r) > RARITIES.indexOf(best) ? r : best), null);
