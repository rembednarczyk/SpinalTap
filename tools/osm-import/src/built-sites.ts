/**
 * Building sites the map has not caught up with (G-872, T-317). OSM keeps `building=construction`
 * on a building finished since: Karmelicka 7 (`construction=commercial`) has a roof on the
 * orthophotos of 2023-09, 2024-06 and 2025-04, and the game showed bare ground where it stands.
 * An outline GUGiK LoD1 2024 matches one to one (IoU ≥ `LOD1_MIN_IOU`, as for its height) is the
 * building it was being built as (`construction=*`, else `yes`); a site LoD1 does not hold (a dig,
 * an empty plot: Zielona 5A) stays a site. The surface model does not decide: at Zielona 5A it
 * holds 12.8 m over most of the plot, so it does not tell a site from a building.
 */
import { type Area } from "./features.ts";
import { type lod1Index, lod1Match } from "./lod1-heights.ts";

/** `construction=*` values that are no kind of building. */
const NO_KIND = new Set(["yes", "construction"]);

/** `areas` with the building sites LoD1 2024 shows standing (`index`) made the buildings they were built as; without LoD1, as they are. */
export const builtSites = <A extends Area>(areas: readonly A[], index: ReturnType<typeof lod1Index> | undefined): A[] =>
  areas.map((a) => {
    if (a.tags.building !== "construction" || !index || !lod1Match(index, a.ring)) return a;
    const kind = a.tags.construction;
    return { ...a, tags: { ...a.tags, building: kind !== undefined && !NO_KIND.has(kind) ? kind : "yes" } };
  });
