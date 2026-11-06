import { MAX_LEVEL, xpForLevel, xpToNext } from "@seki/core";

/** Where the character stands on the way to the next level (ADR-0059): what the XP bar draws. */
export interface XpProgress {
  /** XP earned since the current level began. */
  readonly into: number;
  /** XP from the current level to the next; 0 at the top level. */
  readonly span: number;
  /** 0..1 of the way; 1 at the top level. */
  readonly share: number;
  readonly top: boolean;
}

/** The bar's numbers for `xp` in total at `level`, from the core curve the simulation levels with. */
export const xpProgress = (level: number, xp: number): XpProgress => {
  const span = xpToNext(level);
  if (level >= MAX_LEVEL || span <= 0) return { into: 0, span: 0, share: 1, top: true };
  const into = Math.max(0, Math.min(span, xp - xpForLevel(level)));
  return { into, span, share: into / span, top: false };
};
