import type { AddedArea } from "../../osm-import/src/corrections.ts";
import { type Pt } from "../../osm-import/src/geometry.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { ringCounts } from "../../orto/src/overlay.ts";
import { share } from "../../orto/src/rings.ts";

/**
 * `added-grass-off-green` (G-627): a lawn or a bed the curator added to the map (`ADDED_AREAS`) with
 * under `MIN_GREEN` of its samples green on the orthophoto cover (ADR-0077), so laid over paving or
 * asphalt. Read off the committed rasters (`data/orto`): an area off them does not count. The lawns
 * the curator laid from the orthophoto are also the classifier's truth (`tools/orto/src/truth.ts`), so
 * one laid on paving skews its tuning as well.
 *
 * `added-paving-on-green` (G-670), its mirror: an added area of paving or asphalt (`area:highway`)
 * with `MIN_GREEN` of its samples green or more, so laid over a lawn. Green under crowns counts
 * only with `MIN_LEAF_OFF_GREEN` of the samples green on the leaf-off flight as well (G-672): paving
 * under trees is green on the summer flights alone, a lawn shows on the leaf-off one too.
 */

type Finding = { readonly at: string; readonly what: string };

/** The least share of green samples (those off the photograph left out) a lawn needs. */
export const MIN_GREEN = 0.5;

/**
 * The least share of samples green on the leaf-off flight (class `green`, not `canopy`) paving on
 * green needs (G-672). Measured 12.11.2026: paving under the crowns by Ruska and Zana 2-8%; of the
 * map's 272 lawns the summer flights see green, 83% at 15% or more (88% at 10%, 82% at 20%), the
 * rest under trees all along.
 */
export const MIN_LEAF_OFF_GREEN = 0.15;

const GREEN = ["green", "canopy"] as const;

/**
 * The added lawns off the orthophoto's green on purpose or by the classifier's fault, by id, with the
 * entry of `docs/topografia.md` and why (G-670), so the count holds only lawns still to look at.
 */
export const GRASS_OFF_GREEN_KNOWN: Readonly<Record<string, string>> = {
  "T-241/trawnik-zachod": "T-241: Plac T0's lawn on the car park, laid to the investor's plan (ADR-0074) on purpose",
  "T-241/trawnik-wschod": "T-241: Plac T0's lawn on the car park, laid to the investor's plan (ADR-0074) on purpose",
  "T-241/trawnik-bajkowskiego": "T-241: Plac T0's lawn on the car park, laid to the investor's plan (ADR-0074) on purpose",
  "T-243/ck-zachod-trawnik": "T-243: the Centrum Kultury's roof lies some 3 m west on the orthophoto, over the lawn: the classifier's fault",
  "T-245/rabata-kolegium-poludnie": "T-245: the bed lies in the shadow of the Collegium's wall: the classifier's fault",
};

/** The added paving green on the orthophoto by the classifier's fault, by id, with the entry of `docs/topografia.md` and why (G-670). */
export const PAVING_ON_GREEN_KNOWN: Readonly<Record<string, string>> = {};

const isGrass = (a: AddedArea): boolean => a.tags.landuse === "grass" || a.tags.landuse === "flowerbed";

const isPaving = (a: AddedArea): boolean => a.tags["area:highway"] !== undefined;

const middle = (ring: readonly Pt[]): Pt => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, z: ring.reduce((s, p) => s + p.z, 0) / ring.length });

/** The areas whose share of green on the cover `wrong` holds, as findings; an area off the rasters left out. */
const byGreen = (areas: readonly AddedArea[], covers: readonly Cover[], wrong: (green: number, leafOff: number) => boolean): Finding[] =>
  areas.flatMap((a) => {
    // Shares of whole samples: m² rounded a class would tip an area at exactly half once green is split in two.
    const n = ringCounts(covers, a.ring);
    if (!n) return [];
    const green = share(n, GREEN);
    if (!wrong(green, share(n, ["green"]))) return [];
    const c = middle(a.ring);
    return [{ at: `${c.x.toFixed(1)},${c.z.toFixed(1)}`, what: `${a.id}: ${Math.round(green * 100)}% green on the orthophoto` }];
  });

export const addedGrassOffGreen = (areas: readonly AddedArea[], covers: readonly Cover[], known: Readonly<Record<string, string>> = GRASS_OFF_GREEN_KNOWN): Finding[] =>
  byGreen(
    areas.filter((a) => isGrass(a) && known[a.id] === undefined),
    covers,
    (green) => green < MIN_GREEN,
  );

export const addedPavingOnGreen = (areas: readonly AddedArea[], covers: readonly Cover[], known: Readonly<Record<string, string>> = PAVING_ON_GREEN_KNOWN): Finding[] =>
  byGreen(
    areas.filter((a) => isPaving(a) && known[a.id] === undefined),
    covers,
    (green, leafOff) => green >= MIN_GREEN && leafOff >= MIN_LEAF_OFF_GREEN,
  );
