/**
 * Land cover from the orthophoto's colour (ADR-0077): green, green under crowns, light paving,
 * asphalt, shadow or unknown. Green from the excess green of RGB averaged over the flights
 * (`FLIGHTS`), shadow from their mean brightness, and a hard surface split by the current image's
 * brightness and saturation, which shows the ground under the trees (thresholds in `thresholds.ts`).
 * Green the leaf-off current image does not show is `canopy` (G-672): the two summer flights' crowns
 * lift the mean over paving under trees as well as over a lawn in their shade or still brown in April.
 */
import { THRESHOLDS, type Thresholds } from "./thresholds.ts";

/** Palette indices of the cover raster. */
export const COVER = { none: 0, green: 1, paving: 2, asphalt: 3, shadow: 4, unknown: 5, canopy: 6 } as const;
export type CoverClass = (typeof COVER)[keyof typeof COVER];
export const COVER_NAMES = ["none", "green", "paving", "asphalt", "shadow", "unknown", "canopy"] as const;
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
];

export type Colour = readonly [r: number, g: number, b: number];

export interface ColourStats {
  /** Brightness (R + G + B) / 3. */
  readonly l: number;
  /** Excess green of the chromaticities, 2g - r - b. */
  readonly exg: number;
  /** Saturation (max - min) / max. */
  readonly s: number;
}

export const colourStats = ([r, g, b]: Colour): ColourStats => {
  const sum = r + g + b;
  const max = Math.max(r, g, b);
  return { l: sum / 3, exg: sum > 0 ? (2 * g - r - b) / sum : 0, s: max > 0 ? (max - Math.min(r, g, b)) / max : 0 };
};

/** The class of a sample from its mean colour in each flight, the current image first; `none` without any. */
export const classify = (flights: readonly Colour[], t: Thresholds = THRESHOLDS): CoverClass => {
  if (!flights.length) return COVER.none;
  const stats = flights.map(colourStats);
  const l = stats.reduce((s, c) => s + c.l, 0) / stats.length;
  const exg = stats.reduce((s, c) => s + c.exg, 0) / stats.length;
  if (l < t.shadowL) return COVER.shadow;
  const now = stats[0]!;
  if (exg >= t.greenExg) return now.exg >= t.leafOffExg ? COVER.green : COVER.canopy;
  if (now.s > t.hardS) return COVER.unknown;
  return now.l >= t.pavingL ? COVER.paving : COVER.asphalt;
};
