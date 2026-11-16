/**
 * The furniture placed with the trees of the crowns OSM has no node for (G-797, `crown-trees.ts`):
 * the plan with the `lit` rule's passes (`placeLit`), then the crowns of the surface model with no
 * tree of that placement under them as a group after every other, and the whole placed once more.
 * The trees come last, so every piece of the plan keeps its place and the rule's trees step aside.
 */
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { treeHeight } from "../../../packages/core/src/world/trees.ts";
import { type Chm, loadChms } from "../../gugik/src/nmpt.ts";
import { type Cover, readCover } from "../../orto/src/cover.ts";
import { DISTRICTS } from "./config.ts";
import { type CrownStats, crownReach, crownTreeItem, crownTrees } from "./crown-trees.ts";
import type { Rect } from "./geometry.ts";
import type { PropsPlan } from "./props-gen.ts";
import { loadStructures } from "./props-osm.ts";
import type { Structure } from "./structures.ts";
import { type LitWay, placeLit } from "./props-lit.ts";
import type { Site } from "./props-site.ts";

/** What the crowns are read from: the districts' rectangles, the orthophoto's cover, the surface model and the map's structures. */
export interface CrownData {
  readonly rects: readonly Rect[];
  readonly covers: readonly Cover[];
  readonly chms: readonly Chm[];
  readonly structures: readonly Structure[];
}

/** The committed data of every district (`data/orto`, `data/gugik/nmpt`, `data/osm`). */
export const loadCrownData = (): CrownData => ({
  rects: DISTRICTS.map((d) => d.rect),
  covers: DISTRICTS.flatMap((d) => readCover(d.slug) ?? []),
  chms: loadChms(),
  structures: loadStructures(),
});

/**
 * The plan placed by `place` with the `lit` rule's passes and the crowns' trees, and the rule's control numbers.
 * Of each pass only the lamps or the trees are read, so only the last is finished (`PropsDraft`: its bollards strung).
 */
export const placeWithCrowns = <T extends { readonly byChunk: ReadonlyMap<string, readonly StreetPropItem[]> }>(
  plan: PropsPlan,
  place: (p: PropsPlan) => { readonly byChunk: ReadonlyMap<string, readonly StreetPropItem[]>; readonly finish: () => T },
  lit: readonly LitWay[],
  streets: readonly LitWay[],
  site: Site,
  data: CrownData,
): T & { readonly crowns: CrownStats & { readonly placed: number } } => {
  let last = plan;
  const lamped = placeLit(
    plan,
    (p) => {
      last = p;
      return place(p);
    },
    lit,
    streets,
  );
  const trees = [...lamped.byChunk.values()].flat().flatMap((i) => (i.prop === "tree" ? [{ p: { x: i.x, z: i.z }, reach: crownReach(treeHeight(i.variant)) }] : []));
  const found = crownTrees(data.rects, site, data.covers, data.chms, trees, data.structures);
  if (found.trees.length === 0) return { ...lamped.finish(), crowns: { ...found.stats, placed: 0 } };
  const out = place({ ...last, items: [...last.items, crownTreeItem(found.trees)] }).finish();
  const placed = [...out.byChunk.values()].flat().filter((i) => i.prop === "tree").length - trees.length;
  return { ...out, crowns: { ...found.stats, placed } };
};
