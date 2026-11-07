import { levelScale } from "../items/grade";
import { MAX_LEVEL, MIN_LEVEL } from "./curve";

/**
 * District bands and enemy levels (ADR-0059, stage 5). Each district has a band of difficulty
 * (the bands themselves are sim content); an enemy is of the player's level kept within its
 * district's band, an elite and a boss one level above that. Inside the band the city keeps up
 * with the player, outside it stays weaker or stronger. The numbers are first guesses, to be
 * tuned in stage 8.
 */
export interface LevelBand {
  readonly min: number;
  readonly max: number;
}

/** How an enemy ranks among its own: the rank adds levels on top of the band. */
export type EnemyRank = "regular" | "elite" | "boss";

/** Levels a rank adds to the band's level (ADR-0059: ±1 for an elite and a boss). */
export const RANK_LEVEL_BONUS: Readonly<Record<EnemyRank, number>> = { regular: 0, elite: 1, boss: 1 };

const clampLevel = (level: number): number => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));

/** The player's level kept within `band`; with no band (outside every district) the player's own. */
export const bandLevel = (player: number, band: LevelBand | null): number => {
  const p = clampLevel(player);
  return band ? clampLevel(Math.min(band.max, Math.max(band.min, p))) : p;
};

/** An enemy's level: the band's level for the player, plus what its rank adds, within 1..30. */
export const enemyLevel = (player: number, band: LevelBand | null, rank: EnemyRank = "regular"): number =>
  clampLevel(bandLevel(player, band) + RANK_LEVEL_BONUS[rank]);

/**
 * What an enemy's level does to its health and damage: the same as an item's level does to its
 * damage and armor (ADR-0059), +4% a level above 1, so 1 at level 1 and ×2.16 at 30.
 */
export const enemyScale = (level: number): number => levelScale(level);

/**
 * Share of a kill's XP by the enemy's level against the player's (ADR-0059): 5 levels weaker
 * gives 10%, even 100%, 5 levels stronger 150%, linear in between and flat beyond.
 */
export const KILL_XP_WEAKER = 0.1;
export const KILL_XP_STRONGER = 1.5;
export const KILL_XP_SPAN = 5;

export const killXpShare = (enemy: number, player: number): number => {
  const diff = Math.max(-KILL_XP_SPAN, Math.min(KILL_XP_SPAN, clampLevel(enemy) - clampLevel(player)));
  return diff < 0 ? 1 + ((1 - KILL_XP_WEAKER) * diff) / KILL_XP_SPAN : 1 + ((KILL_XP_STRONGER - 1) * diff) / KILL_XP_SPAN;
};
