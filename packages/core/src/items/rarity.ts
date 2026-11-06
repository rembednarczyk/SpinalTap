import type { Rarity } from "./types";

export interface RarityTier {
  /** Catalog key of the label shown next to the frame colour (never colour alone), ADR-0056. */
  readonly label: string;
  /** Weapon damage multiplier. */
  readonly damage: number;
  /** Weapon base spread multiplier. */
  readonly spread: number;
  /** Extra armor on a garment's main zone. */
  readonly armor: number;
  /** Value multiplier (shop price, sale). */
  readonly value: number;
  /** Traits a piece of this tier rolls (ADR-0059): none below epic. */
  readonly traits: number;
}

/**
 * Fixed per tier, so a saved item needs only its tier, level and traits. Unique items carry their
 * own numbers. Epic and legendary (ADR-0059) are first guesses, to be tuned in stage 8.
 */
export const RARITY: Readonly<Record<Rarity, RarityTier>> = {
  common: { label: "inventory.rarity.common", damage: 1, spread: 1, armor: 0, value: 1, traits: 0 },
  uncommon: { label: "inventory.rarity.uncommon", damage: 1.08, spread: 0.92, armor: 1, value: 1.6, traits: 0 },
  rare: { label: "inventory.rarity.rare", damage: 1.16, spread: 0.85, armor: 2, value: 2.6, traits: 0 },
  epic: { label: "inventory.rarity.epic", damage: 1.24, spread: 0.8, armor: 3, value: 4, traits: 1 },
  legendary: { label: "inventory.rarity.legendary", damage: 1.32, spread: 0.75, armor: 4, value: 6, traits: 2 },
  unique: { label: "inventory.rarity.unique", damage: 1, spread: 1, armor: 0, value: 1, traits: 0 },
};

/** Least to most rare; unique stands apart, last. */
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "unique"];

/** The tiers a roll can give, in the order of `RARITY_WEIGHTS`. */
export const ROLLED_RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/**
 * Weights of the rolled tiers at a few item levels (ADR-0059), linear in between. Level 1 keeps
 * the 75 / 20 / 5 of before; epic shows from level 2 on, legendary from 11 on. Every row sums to
 * 100. First guesses, to be tuned by the balance test of stage 8.
 */
export const RARITY_WEIGHTS: readonly { readonly level: number; readonly weights: readonly number[] }[] = [
  { level: 1, weights: [75, 20, 5, 0, 0] },
  { level: 10, weights: [60, 26, 10, 4, 0] },
  { level: 20, weights: [45, 30, 15, 8, 2] },
  { level: 30, weights: [32, 32, 19, 12, 5] },
];

/** Weights of common .. legendary at an item level (clamped to 1..30). */
export const rarityWeights = (level: number): readonly number[] => {
  const rows = RARITY_WEIGHTS;
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  if (level <= first.level) return first.weights;
  if (level >= last.level) return last.weights;
  const hi = rows.findIndex((row) => row.level >= level);
  const a = rows[hi - 1]!;
  const b = rows[hi]!;
  const t = (level - a.level) / (b.level - a.level);
  return a.weights.map((w, i) => w + (b.weights[i]! - w) * t);
};

/** The tier one random number gives at an item level: `r < cumulative / total`, as before at level 1. */
export const rollRarityAt = (level: number, r: number): Rarity => {
  const weights = rarityWeights(level);
  const total = weights.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  for (let i = 0; i < ROLLED_RARITIES.length; i++) {
    cumulative += weights[i]!;
    if (r < cumulative / total) return ROLLED_RARITIES[i]!;
  }
  return "legendary";
};

export const isRarity = (v: unknown): v is Rarity => typeof v === "string" && (RARITIES as readonly string[]).includes(v);

/** Rarest of the given tiers, or null for none. */
export const bestRarity = (tiers: readonly Rarity[]): Rarity | null =>
  tiers.reduce<Rarity | null>((best, r) => (best === null || RARITIES.indexOf(r) > RARITIES.indexOf(best) ? r : best), null);
