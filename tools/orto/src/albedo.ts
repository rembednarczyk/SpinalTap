/**
 * The colours of the import's surfaces on the orthophoto (ADR-0077, G-721): for each ground surface
 * the median colour of the samples under it whose cover class is the one it should be (light paving
 * under the squares and paths, asphalt under the roads, green under the lawns), well inside it. The
 * renderer's ground palette is calibrated on these medians (`ground-plan.ts`): the hue of each
 * surface and the brightness of the paving against the lawns, not one square's.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { type Colour, type CoverName, COVER_NAMES } from "./classify.ts";
import { type CoverHeader, sampleColours } from "./cover.ts";
import { samplesIn } from "./rings.ts";
import { type Tile, isBlank } from "./tiles.ts";

/** The class a surface's samples must have to give it a colour. */
export const ALBEDO_CLASS: Readonly<Record<string, CoverName>> = {
  square: "paving",
  cobble: "paving",
  footway: "paving",
  sidewalk: "paving",
  road: "asphalt",
  grass: "green",
  basin: "paving",
};

/** How far from a sample its neighbours must lie under the same piece (samples): 1 m at 0.5 m, off the edges' lean and blur. */
export const ALBEDO_INSET = 2;

/** Brightness of an sRGB colour as the eye takes it (Rec. 709 weights on the 0–255 codes), as the curator measured T-281. */
export const luma = ([r, g, b]: Colour): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Index of the piece seen at each sample, or -1: the last of `pieces` over it, as the overlay counts them (`cellOverlay`). */
export const topPieces = (h: Pick<CoverHeader, "x0" | "z1" | "step" | "width" | "height">, pieces: readonly { readonly ring: readonly Pt[] }[], hidden?: Uint8Array): Int32Array => {
  const top = new Int32Array(h.width * h.height).fill(-1);
  pieces.forEach((g, i) => {
    for (const k of samplesIn(h, g.ring)) if (!hidden?.[k]) top[k] = i;
  });
  return top;
};

/** Whether every sample within `r` of `k` (a square) is under the same piece as `k`. */
export const wellInside = (h: Pick<CoverHeader, "width" | "height">, top: Int32Array, k: number, r = ALBEDO_INSET): boolean => {
  const [col, row] = [k % h.width, Math.floor(k / h.width)];
  if (col < r || row < r || col + r >= h.width || row + r >= h.height) return false;
  for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (top[k + dr * h.width + dc] !== top[k]) return false;
  return true;
};

/** Median of each channel. */
export const medianColour = (rgb: readonly number[]): Colour => {
  const n = Math.floor(rgb.length / 3);
  const channel = (c: number) => {
    const v = Array.from({ length: n }, (_, i) => rgb[i * 3 + c]!).sort((a, b) => a - b);
    return n ? (n % 2 ? v[(n - 1) / 2]! : (v[n / 2 - 1]! + v[n / 2]!) / 2) : 0;
  };
  return [channel(0), channel(1), channel(2)];
};

/** Colours gathered per surface: the samples' RGB with the wanted class, and the count of every class under it. */
export interface AlbedoBucket {
  readonly rgb: number[];
  readonly classes: Record<CoverName, number>;
}

export const emptyBucket = (): AlbedoBucket => ({ rgb: [], classes: Object.fromEntries(COVER_NAMES.map((n) => [n, 0])) as Record<CoverName, number> });

/**
 * Adds the samples `ks` of one flight to the surfaces' buckets: `surfaceOf` the surface seen at a
 * sample (null for none), `cls` the cover class, `rgb`/`n` the flight's summed colour and its pixel count.
 */
export const gatherAlbedo = (
  buckets: Map<string, AlbedoBucket>,
  ks: Iterable<number>,
  surfaceOf: (k: number) => string | null,
  cls: Uint8Array,
  colours: { readonly rgb: Float32Array; readonly n: Uint16Array },
): void => {
  for (const k of ks) {
    const s = surfaceOf(k);
    const want = s ? ALBEDO_CLASS[s] : undefined;
    if (!s || !want || !colours.n[k]) continue;
    let b = buckets.get(s);
    if (!b) buckets.set(s, (b = emptyBucket()));
    const name = COVER_NAMES[cls[k]!] ?? "none";
    b.classes[name]++;
    if (name !== want) continue;
    const n = colours.n[k]!;
    b.rgb.push(colours.rgb[k * 3]! / n, colours.rgb[k * 3 + 1]! / n, colours.rgb[k * 3 + 2]! / n);
  }
};

/**
 * Adds one cell's tile of a flight (`rect` the cell, `ks` its samples) to the flight's buckets, and
 * the day its sheet was photographed to `days`. A blank tile (`isBlank`, G-771) is no flight there:
 * its white is no surface's colour and its sheet no day the map was photographed (G-772).
 */
export const gatherTile = (
  buckets: Map<string, AlbedoBucket>,
  days: Set<string>,
  tile: Tile | undefined,
  ks: Iterable<number>,
  surfaceOf: (k: number) => string | null,
  cover: { readonly header: CoverHeader; readonly cls: Uint8Array },
  rect: Rect,
): void => {
  if (!tile || isBlank(tile)) return;
  if (tile.meta.sheet) days.add(tile.meta.sheet.date);
  gatherAlbedo(buckets, ks, surfaceOf, cover.cls, sampleColours(cover.header, tile, rect));
};
