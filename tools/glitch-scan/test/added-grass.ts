import type { AddedArea } from "../../osm-import/src/corrections.ts";
import { type Pt } from "../../osm-import/src/geometry.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { ringOverlay } from "../../orto/src/overlay.ts";
import { share } from "../../orto/src/rings.ts";

/**
 * `added-grass-off-green` (G-627): a lawn or a bed the curator added to the map (`ADDED_AREAS`) with
 * under `MIN_GREEN` of its samples green on the orthophoto cover (ADR-0077), so laid over paving or
 * asphalt. Read off the committed rasters (`data/orto`): an area off them does not count. The lawns
 * the curator laid from the orthophoto are also the classifier's truth (`tools/orto/src/truth.ts`), so
 * one laid on paving skews its tuning as well.
 *
 * `added-paving-on-green` (G-670), its mirror: an added area of paving or asphalt (`area:highway`)
 * with `MIN_GREEN` of its samples green or more, so laid over a lawn or under trees.
 */

type Finding = { readonly at: string; readonly what: string };

/** The least share of green samples (those off the photograph left out) a lawn needs. */
export const MIN_GREEN = 0.5;

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

const isGrass = (a: AddedArea): boolean => a.tags.landuse === "grass" || a.tags.landuse === "flowerbed";

const isPaving = (a: AddedArea): boolean => a.tags["area:highway"] !== undefined;

const middle = (ring: readonly Pt[]): Pt => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, z: ring.reduce((s, p) => s + p.z, 0) / ring.length });

/** The areas whose share of green on the cover `wrong` holds, as findings; an area off the rasters left out. */
const byGreen = (areas: readonly AddedArea[], covers: readonly Cover[], wrong: (green: number) => boolean): Finding[] =>
  areas.flatMap((a) => {
    const m2 = ringOverlay(covers, a.ring);
    if (!m2) return [];
    const green = share(m2, ["green"]);
    if (!wrong(green)) return [];
    const c = middle(a.ring);
    return [{ at: `${c.x.toFixed(1)},${c.z.toFixed(1)}`, what: `${a.id}: ${Math.round(green * 100)}% green on the orthophoto` }];
  });

export const addedGrassOffGreen = (areas: readonly AddedArea[], covers: readonly Cover[], known: Readonly<Record<string, string>> = GRASS_OFF_GREEN_KNOWN): Finding[] =>
  byGreen(
    areas.filter((a) => isGrass(a) && known[a.id] === undefined),
    covers,
    (green) => green < MIN_GREEN,
  );

export const addedPavingOnGreen = (areas: readonly AddedArea[], covers: readonly Cover[]): Finding[] =>
  byGreen(areas.filter(isPaving), covers, (green) => green >= MIN_GREEN);
