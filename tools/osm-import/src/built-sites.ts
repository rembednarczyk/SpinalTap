/**
 * Building sites the map has not caught up with (G-872, T-317). OSM keeps `building=construction`
 * on a building finished since: Karmelicka 7 (`construction=commercial`) has a roof on the
 * orthophotos of 2023-09, 2024-06 and 2025-04, and the game showed bare ground where it stands.
 * An outline GUGiK LoD1 2024 matches one to one (IoU ≥ `LOD1_MIN_IOU`, as for its height) is the
 * building it was being built as (`construction=*`, else `yes`); a site LoD1 does not hold (a dig,
 * an empty plot: Zielona 5A) stays a site. The surface model does not decide: at Zielona 5A it
 * holds 12.8 m over most of the plot, so it does not tell a site from a building.
 *
 * The site's land round such a building (`landuse=construction` with the same `construction=*`,
 * the building in it: w1261814241 round Karmelicka 7) is finished with it: an ordinary plot, its
 * lawns, weeds and unpaved parking on the orthophotos, no building site for what reads the map
 * (the crowns' trees, the cover's classes, `finishedSites`).
 */
import { type Lod1Building } from "../../gugik/src/extracts.ts";
import { type Area, extractFeatures } from "./features.ts";
import { type Pt, centroid, pointInRing } from "./geometry.ts";
import { lod1Index, lod1Match } from "./lod1-heights.ts";
import { type OsmData, type Tags } from "./osm.ts";

/** `construction=*` values that are no kind of building. */
const NO_KIND = new Set(["yes", "construction"]);

/** The OSM element of an area: `w<id>`, or `r<id>` for every ring `r<id>/<k>` of a relation. */
const elementOf = (id: string): string => id.split("/")[0]!;

const without = (tags: Tags, keys: readonly string[]): Tags => Object.fromEntries(Object.entries(tags).filter(([k]) => !keys.includes(k)));

/**
 * The tags the map would have caught up with, by OSM element (`elementOf`): each building site
 * LoD1 2024 (`lod1`) shows standing the building it was built as, and the site's land round it
 * no site. None without LoD1.
 */
export const builtSiteTags = (areas: readonly Area[], lod1: readonly Lod1Building[] | undefined): ReadonlyMap<string, Tags> => {
  const out = new Map<string, Tags>();
  const sites = areas.filter((a) => a.tags.building === "construction");
  if (!sites.length || !lod1) return out;
  const index = lod1Index(lod1);
  const built = sites.filter((a) => lod1Match(index, a.ring));
  for (const a of built) {
    const kind = a.tags.construction;
    out.set(elementOf(a.id), { ...a.tags, building: kind !== undefined && !NO_KIND.has(kind) ? kind : "yes" });
  }
  for (const land of areas) {
    if (land.tags.landuse !== "construction") continue;
    if (built.some((b) => b.tags.construction === land.tags.construction && pointInRing(centroid(b.ring), land.ring))) out.set(elementOf(land.id), without(land.tags, ["landuse", "construction"]));
  }
  return out;
};

/** `areas` with the tags of `builtSiteTags`. */
export const builtSites = <A extends Area>(areas: readonly A[], lod1: readonly Lod1Building[] | undefined): A[] => {
  const tags = builtSiteTags(areas, lod1);
  return areas.map((a) => {
    const t = tags.get(elementOf(a.id));
    return t ? { ...a, tags: t } : a;
  });
};

/** The map with the tags of `builtSiteTags`: everything that reads it sees the finished buildings and their plots. */
export const withBuiltSites = (osm: OsmData, lod1: readonly Lod1Building[] | undefined): OsmData => {
  const tags = builtSiteTags(extractFeatures(osm).areas, lod1);
  if (!tags.size) return osm;
  const retag = <T extends { readonly id: number; readonly tags?: Tags }>(m: ReadonlyMap<number, T>, p: string): Map<number, T> =>
    new Map([...m].map(([id, e]) => [id, tags.has(`${p}${id}`) ? { ...e, tags: tags.get(`${p}${id}`) } : e]));
  return { nodes: osm.nodes, ways: retag(osm.ways, "w"), relations: retag(osm.relations, "r") };
};

/** The outlines of the site's land `builtSiteTags` finishes: the cover's classes there are read off every flight (`tools/orto`). */
export const finishedSites = (osm: OsmData, lod1: readonly Lod1Building[] | undefined): Pt[][] => {
  const areas = extractFeatures(osm).areas;
  const tags = builtSiteTags(areas, lod1);
  return areas.filter((a) => a.tags.landuse === "construction" && tags.has(elementOf(a.id))).map((a) => [...a.ring]);
};
