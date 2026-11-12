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
 */

type Finding = { readonly at: string; readonly what: string };

/** The least share of green samples (those off the photograph left out) a lawn needs. */
export const MIN_GREEN = 0.5;

const isGrass = (a: AddedArea): boolean => a.tags.landuse === "grass" || a.tags.landuse === "flowerbed";

const middle = (ring: readonly Pt[]): Pt => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, z: ring.reduce((s, p) => s + p.z, 0) / ring.length });

export const addedGrassOffGreen = (areas: readonly AddedArea[], covers: readonly Cover[]): Finding[] =>
  areas.filter(isGrass).flatMap((a) => {
    const m2 = ringOverlay(covers, a.ring);
    if (!m2) return [];
    const green = share(m2, ["green"]);
    if (green >= MIN_GREEN) return [];
    const c = middle(a.ring);
    return [{ at: `${c.x.toFixed(1)},${c.z.toFixed(1)}`, what: `${a.id}: ${Math.round(green * 100)}% green on the orthophoto` }];
  });
