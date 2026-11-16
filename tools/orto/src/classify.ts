/**
 * Land cover from the orthophoto's colour (ADR-0077): green, green under crowns, light paving,
 * asphalt, shadow or unknown. Green from the excess green of RGB averaged over the flights
 * (`FLIGHTS`), shadow from their mean brightness, and a hard surface split by the current image's
 * brightness and saturation, which shows the ground under the trees (thresholds in `thresholds.ts`).
 * Green the leaf-off current image does not show is `canopy` (G-672): the two summer flights' crowns
 * lift the mean over paving under trees as well as over a lawn in their shade or still brown in April.
 * Of that, what the leaf-off image shows light and grey, as paving, is `canopyHard` (G-764): paving
 * under bare twigs, where a lawn in April is darker or browner. A leaf-off green no lawn has does
 * not make green alone (G-775): patina or a tarp the summer flights do not see green, and beige
 * setts where they show only a shade, which with one summer flight left (G-771) nothing outvotes.
 */
import { THRESHOLDS, type Thresholds } from "./thresholds.ts";

/** Palette indices of the cover raster. */
export const COVER = { none: 0, green: 1, paving: 2, asphalt: 3, shadow: 4, unknown: 5, canopy: 6, canopyHard: 7 } as const;
export type CoverClass = (typeof COVER)[keyof typeof COVER];
export const COVER_NAMES = ["none", "green", "paving", "asphalt", "shadow", "unknown", "canopy", "canopyHard"] as const;
export type CoverName = (typeof COVER_NAMES)[number];
/** Colours of the classes in the PNG: what a person opening it sees. */
export const COVER_PALETTE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [60, 160, 60],
  [220, 200, 160],
  [70, 70, 80],
  [20, 20, 60],
  [200, 60, 200],
  [30, 100, 40],
  [150, 150, 90],
];

export type Colour = readonly [r: number, g: number, b: number];

export interface ColourStats {
  /** Brightness (R + G + B) / 3. */
  readonly l: number;
  /** Excess green of the chromaticities, 2g - r - b. */
  readonly exg: number;
  /** Saturation (max - min) / max. */
  readonly s: number;
  /** Hue in degrees: 0 red, 60 yellow, 120 green, 180 cyan; 0 for a grey. */
  readonly h: number;
}

const hueOf = (r: number, g: number, b: number, max: number, d: number): number =>
  d <= 0 ? 0 : ((max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d) * 60 + 360) % 360;

export const colourStats = ([r, g, b]: Colour): ColourStats => {
  const sum = r + g + b;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  return { l: sum / 3, exg: sum > 0 ? (2 * g - r - b) / sum : 0, s: max > 0 ? d / max : 0, h: hueOf(r, g, b, max, d) };
};

const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/** The class of a sample from its mean colour in each flight, the current image first; `none` without any. */
export const classify = (flights: readonly Colour[], t: Thresholds = THRESHOLDS): CoverClass => {
  if (!flights.length) return COVER.none;
  const stats = flights.map(colourStats);
  const [now, ...summer] = stats as [ColourStats, ...ColourStats[]];
  // With one summer flight left (G-771) the leaf-off flight weighs half: no second summer flight outvotes its odd colour (G-775).
  const one = summer.length === 1 ? summer[0] : undefined;
  const l = mean(stats.map((c) => c.l));
  // Patina or a tarp the leaf-off flight alone makes green is no lawn, nor ground to tell paving's brightness by: the summer flight gives that.
  const object = !!one && now.h > t.leafOffHue && one.exg < t.greenExg && mean(stats.map((c) => c.exg)) >= t.greenExg;
  const leafOffExg = object ? Math.min(now.exg, 0) : now.exg;
  const exg = (leafOffExg + summer.reduce((s, c) => s + c.exg, 0)) / stats.length;
  if (l < t.shadowL) return COVER.shadow;
  if (exg >= t.greenExg) {
    const setts = !!one && one.l < t.summerShadeL && now.l >= t.settsL && now.h <= 60 && now.s >= t.settsS;
    if (setts || (leafOffExg < t.leafOffExg && now.l >= t.pavingL && now.s <= t.crownHardS)) return COVER.canopyHard;
    return leafOffExg >= t.leafOffExg ? COVER.green : COVER.canopy;
  }
  if (now.s > t.hardS) return COVER.unknown;
  return (object ? one!.l : now.l) >= t.pavingL ? COVER.paving : COVER.asphalt;
};
