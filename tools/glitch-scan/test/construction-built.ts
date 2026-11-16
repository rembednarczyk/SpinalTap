/**
 * `osm-construction-built` (G-872, T-317): an outline OSM tags `building=construction` that GUGiK
 * LoD1 2024 covers for at least `BUILT_COVER` of its area, with no solid in the game. The map has
 * not caught up with a finished building (Karmelicka 7: a roof on the orthophotos of 2023-09,
 * 2024-06 and 2025-04), and the game showed bare ground. A site LoD1 does not cover (a dig, an
 * empty plot: Zielona 5A) is no finding. The surface model is not read: at Zielona 5A it holds
 * 12.8 m over most of the plot, so it does not tell a site from a building.
 */
import { type Lod1Building, loadLod1, tilesOf } from "../../gugik/src/extracts.ts";
import { BoxIndex, coveredShare, footprint } from "../../gugik/src/overlap.ts";
import { type Pt, centroid, pointInRing, ringBounds } from "../../osm-import/src/geometry.ts";
import { worldRing } from "../../osm-import/src/lod1-heights.ts";
import { type Tags } from "../../osm-import/src/osm.ts";

/** The least share of an outline LoD1 2024 covers for it to stand built. */
export const BUILT_COVER = 0.5;

type Finding = { readonly at: string; readonly what: string };

/** Each `building=construction` outline of `areas` LoD1 covers for `BUILT_COVER` that has no solid in the game (`inGame` by id). */
export const constructionBuilt = (
  areas: readonly { readonly id: string; readonly tags: Tags; readonly ring: readonly Pt[] }[],
  lod1: readonly Lod1Building[],
  inGame: ReadonlySet<string>,
): Finding[] => {
  const index = new BoxIndex(lod1.filter((b) => b.ring.length >= 3).map((b) => footprint(b.ring)));
  return areas.flatMap((a) => {
    if (a.tags.building !== "construction" || inGame.has(a.id)) return [];
    const f = footprint(a.ring);
    const share = coveredShare(f, index.near(f.box));
    if (share < BUILT_COVER) return [];
    const c = centroid(a.ring);
    return [{ at: `${c.x.toFixed(0)},${c.z.toFixed(0)}`, what: `${a.id} building=construction ${(share * 100).toFixed(0)}% under LoD1 2024, no solid in the game` }];
  });
};

/** The LoD1 buildings of the tiles under the `building=construction` outlines of `areas`, 50 m round them (a tile holds a building by its centroid). */
export const lod1UnderSites = (areas: readonly { readonly tags: Tags; readonly ring: readonly Pt[] }[]): Lod1Building[] => {
  const tiles = areas.filter((a) => a.tags.building === "construction").flatMap((a) => {
    const b = ringBounds(a.ring);
    return tilesOf({ minX: b.minX - 50, minZ: b.minZ - 50, maxX: b.maxX + 50, maxZ: b.maxZ + 50 });
  });
  return loadLod1([...new Set(tiles)].sort());
};

/**
 * `construction-landuse-built` (G-872): a building site's land (a structure of kind `construction`
 * the import keeps, `loadStructures`) with a building of the game in it that OSM still tags
 * `building=construction` (`lifted`): the building stands finished, its plot is no building site
 * (the crowns' trees, the cover's classes). The building's own outline aside.
 */
export const siteLandBuilt = (
  structures: readonly { readonly id: string; readonly kind: string; readonly ring: readonly Pt[] }[],
  buildings: readonly { readonly id: string; readonly x: number; readonly z: number; readonly outline: readonly number[] }[],
  lifted: ReadonlySet<string>,
): Finding[] =>
  structures.flatMap((s) => {
    if (s.kind !== "construction") return [];
    const inside = buildings.filter((b) => lifted.has(b.id) && b.id !== s.id && pointInRing(centroid(worldRing(b)), s.ring));
    return inside.map((b) => ({ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${s.id} building site round ${b.id}, which stands finished` }));
  });
