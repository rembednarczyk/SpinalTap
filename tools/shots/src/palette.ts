/**
 * The 60-30-10 rule of light colour (`docs/zasady-lokacji.md` §13, the user's rule of 22.11) measured
 * on a shot: every pixel is one of three groups by its HSV value and saturation (pure functions on RGB).
 * - the neutral base (about 60%): dark or dim, value under `LIT`; the shadows and the dimmed ambient;
 * - the motivated light (about 30%): lit by a source, value from `LIT`, not saturated enough to be an accent;
 * - the neon accents (about 10%): saturated and bright, saturation from `NEON_S` and value from `NEON_V`.
 * Pattern: the 60-30-10 proportion of interior design, read here on light rather than paint; the bands
 * of `PALETTE_BANDS` give each group its room around the ideal, as the rule is a proportion, not a quota.
 */
import type { Frame } from "./metrics.ts";

/** A pixel with HSV value at least this (0..1) is lit. */
export const LIT = 0.3;
/** A lit pixel with saturation and value at least these is a neon accent. */
export const NEON_S = 0.55;
export const NEON_V = 0.5;

/** What the rule allows of each group, % of the frame. */
export const PALETTE_BANDS = {
  base: [50, 75],
  motivated: [18, 42],
  accent: [3, 15],
} as const;

export type PaletteGroup = keyof typeof PALETTE_BANDS;

export interface PaletteSplit {
  /** % of the frame in each group; they add up to 100 (rounded). */
  readonly base: number;
  readonly motivated: number;
  readonly accent: number;
}

/** The group of one pixel (0..255 a channel). */
export const groupOf = (r: number, g: number, b: number): PaletteGroup => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  if (v < LIT) return "base";
  return s >= NEON_S && v >= NEON_V ? "accent" : "motivated";
};

const round = (x: number): number => Number(x.toFixed(1));

/** The split of a whole frame. */
export const paletteSplit = (f: Frame): PaletteSplit => {
  const n = f.width * f.height;
  const count = { base: 0, motivated: 0, accent: 0 };
  for (let i = 0; i < n; i++) {
    const p = i * 3;
    count[groupOf(f.rgb[p]!, f.rgb[p + 1]!, f.rgb[p + 2]!)]++;
  }
  const pct = (k: number) => (n === 0 ? 0 : round((100 * k) / n));
  return { base: pct(count.base), motivated: pct(count.motivated), accent: pct(count.accent) };
};

/** The groups out of their band, with which way: an empty list keeps the rule. */
export const paletteFaults = (s: PaletteSplit): readonly string[] =>
  (Object.keys(PALETTE_BANDS) as PaletteGroup[]).flatMap((k) => {
    const [lo, hi] = PALETTE_BANDS[k];
    if (s[k] < lo) return [`${k} ${s[k]}% < ${lo}%`];
    if (s[k] > hi) return [`${k} ${s[k]}% > ${hi}%`];
    return [];
  });
