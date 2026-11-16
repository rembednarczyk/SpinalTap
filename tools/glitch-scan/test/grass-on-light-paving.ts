import { existsSync } from "node:fs";
import { type Colour, colourStats } from "../../orto/src/classify.ts";
import { CELLS, FLIGHTS } from "../../orto/src/config.ts";
import { type CoverHeader, type Sampled, emptyCover, sampleColours, smoothColours } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { samplesIn } from "../../orto/src/rings.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { loadTile, tileFiles, usableTiles } from "../../orto/src/tiles.ts";
import type { ChunkFills } from "./fill-on-green";

/**
 * `grass-on-light-paving` (G-775): a 0.5 m sample of a lawn the import's bare ground rule laid
 * where the orthophoto's flights show paving, not a lawn: the leaf-off flight (2025-04) green only
 * by a colour no lawn has, which the summer flights do not take for green. Read off the cached
 * tiles (ADR-0077: they stay outside the repository), with the classifier's sampling, so the check
 * runs where they are. Its own limits, not the classifier's: a change of the classifier is
 * checked against the photograph, not against itself.
 */

type Finding = { readonly at: string; readonly what: string };

/** Hue (degrees) past which a colour is on the cyan side: patina, a painted roof, a tarp, a shade. */
const CYAN_HUE = 150;
/** Beige setts: light (L), red at least green, saturated. */
const SETTS_L = 150;
const SETTS_S = 0.15;
/** The summer flights this dark show a shade or a crown: no lawn to see. */
const SUMMER_DARK_L = 75;

export const hueOf = ([r, g, b]: Colour): number => {
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d;
  return (h * 60 + 360) % 360;
};

/** What the flights (the leaf-off one first) show where a lawn is green only on the leaf-off one by a colour no lawn has, or nothing. */
export const pavedLook = (flights: readonly Colour[]): "patina" | "setts" | undefined => {
  if (flights.length < 2) return undefined;
  const [now, ...summer] = flights.map(colourStats);
  const summerExg = summer.reduce((s, c) => s + c.exg, 0) / summer.length;
  const summerL = summer.reduce((s, c) => s + c.l, 0) / summer.length;
  if (now!.exg < THRESHOLDS.greenExg) return undefined;
  const [r, g] = flights[0]!;
  if (hueOf(flights[0]!) > CYAN_HUE && summerExg < THRESHOLDS.greenExg) return "patina";
  if (now!.l >= SETTS_L && r >= g && now!.s >= SETTS_S && summerL < SUMMER_DARK_L) return "setts";
  return undefined;
};

/** The flights' colours of a sample, the leaf-off one first, from the cells' cached tiles. */
const coloursOf = (cache: string) => {
  const sampled = new Map<string, Sampled[] | undefined>();
  return (h: CoverHeader, k: number): Colour[] | undefined => {
    const [x, z] = [h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step];
    const cell = CELLS.find((c) => x >= c.rect.minX && x < c.rect.maxX && z >= c.rect.minZ && z < c.rect.maxZ);
    if (!cell || cell.slug !== h.district) return undefined;
    if (!sampled.has(cell.id)) {
      const tiles = usableTiles(FLIGHTS.map((f) => loadTile(cache, f.id, cell)).filter((t) => t !== undefined));
      sampled.set(cell.id, tiles.length > 1 ? tiles.map((t) => smoothColours(h, sampleColours(h, t, cell.rect), cell.rect, THRESHOLDS.smooth)) : undefined);
    }
    const s = sampled.get(cell.id);
    if (!s || s.some(({ n }) => !n[k])) return undefined;
    return s.map(({ rgb, n }) => [rgb[k * 3]! / n[k]!, rgb[k * 3 + 1]! / n[k]!, rgb[k * 3 + 2]! / n[k]!] as const);
  };
};

/** Has the cache the leaf-off flight's tiles? */
export const hasTiles = (cache: string): boolean => CELLS.some((c) => existsSync(tileFiles(cache, FLIGHTS[0]!.id, c.id).png));

/** The samples of the lawns the rule laid that `pavedLook` takes for paving, one finding each. */
export const grassOnLightPaving = (chunks: readonly ChunkFills[], cache: string): Finding[] => {
  const headers = MAP_REGIONS.map((r) => emptyCover(r.slug, r.rect, THRESHOLDS).header);
  const colours = coloursOf(cache);
  const out: Finding[] = [];
  for (const c of chunks)
    for (const f of c.fills) {
      if (f.surface !== "grass") continue;
      const ring = Array.from({ length: f.outline.length >> 1 }, (_, k) => ({ x: f.outline[2 * k]!, z: f.outline[2 * k + 1]! }));
      for (const h of headers)
        for (const k of samplesIn(h, ring)) {
          const flights = colours(h, k);
          const look = flights && pavedLook(flights);
          if (!look) continue;
          const [x, z] = [h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step];
          out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${c.id}: lawn on ${look} ${x.toFixed(2)},${z.toFixed(2)}` });
        }
    }
  return out;
};
