import { MEMORIAL } from "./alchemia/plaza";
import { MAP_CHUNKS } from "./lublin/sites";

/**
 * The places of remembrance the city's neon keeps off (ADR-0074 §6): the memorial stone of Plac
 * Ofiar Getta on T2 and the map's stumbling stones (`memorial=stolperstein`, which the import keeps
 * as the tag of their points). No sign, venue board, hologram or advert nearer than `MEMORIAL_CLEAR`
 * across the plan; the glitch scan's `memorial-neon-clear` measures it from the OSM data itself.
 */

/** No glowing sign nearer a place of remembrance than this, across the plan (m). */
export const MEMORIAL_CLEAR = 20;

/** The tag the import gives the point of a stumbling stone (`poiKind` of `tools/osm-import`). */
export const STOLPERSTEIN_TAG = "memorial=stolperstein";

/** A place of remembrance: its box on the plan (a stumbling stone's is its point). */
export interface RemembrancePlace {
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** How far (x, z) lies off the place's box across the plan (m), 0 inside it. */
export const remembranceOff = (p: { readonly x: number; readonly z: number }, r: RemembrancePlace): number =>
  Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.z0 - p.z, 0, p.z - r.z1));

export const REMEMBRANCE_PLACES: readonly RemembrancePlace[] = [
  { name: "the memorial of Plac Ofiar Getta", x0: MEMORIAL.x0, x1: MEMORIAL.x1, z0: MEMORIAL.z0, z1: MEMORIAL.z1 },
  ...MAP_CHUNKS.flatMap((c) => c.pois.filter((p) => p.tag === STOLPERSTEIN_TAG).map((p) => ({ name: `the stumbling stone ${p.name}`, x0: p.x, x1: p.x, z0: p.z, z1: p.z }))),
];
