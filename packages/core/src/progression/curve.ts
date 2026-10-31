/**
 * The experience curve (ADR-0059): levels 1 to 30, and `round(100 × L^1.6)` XP to go from level
 * L to L + 1. Level 2 takes 100 XP, the last step (29 → 30) about 21.9 thousand and the whole
 * road to 30 about 255 thousand. Pure numbers; the test of the pace keeps them honest.
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 30;

/** XP from level `level` to the next one (0 at the cap). */
export const xpToNext = (level: number): number => (level >= MAX_LEVEL || level < MIN_LEVEL ? 0 : Math.round(100 * level ** 1.6));

/** Total XP at which each level starts: index 0 is level 1 (0 XP), index 29 is level 30. */
export const LEVEL_THRESHOLDS: readonly number[] = (() => {
  const out = [0];
  for (let level = MIN_LEVEL; level < MAX_LEVEL; level++) out.push((out[out.length - 1] ?? 0) + xpToNext(level));
  return out;
})();

/** Total XP needed to reach `level` (clamped to 1..30). */
export const xpForLevel = (level: number): number => LEVEL_THRESHOLDS[Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(level))) - 1] ?? 0;

/** The level a total of `xp` gives. */
export const levelForXp = (xp: number): number => {
  let level = MIN_LEVEL;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
};
