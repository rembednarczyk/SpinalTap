/**
 * The trees OSM has no node for (G-797, T-292, ADR-0077 step 5), by one rule for the whole city
 * rather than lines drawn into the plan: a tree stands under each crown of the surface model that
 * the orthophoto shows as one. The grid, its crown cells, tops and trunks are `crown-grid.ts`'s:
 * the surface is NMPT less NMT 4 to 35 m over the ground, off the roofs, the map's structures
 * (buildings, building sites, markets: G-815) and the game's cleared set pieces; a top tops the
 * surface within 2 m with crown on the orthophoto round it; the trunk stands at the top or at the
 * highest crown cell within the crown's reach where a trunk may (`crown-ground.ts`: open ground
 * off the roads, paths, steps, car parks, barriers and decks).
 *
 * The tops are taken highest first, each where no tree of the game (OSM's, the plan's rows) and no
 * tree taken before stands within the larger of the two crowns' reach (`crownReach`: the drawn
 * crown of a tree of that height); where it is not an eave's (a roof's plateau joined to a
 * building's outline) with too little crown on the orthophoto (`onEave`, `crownShare`); and where
 * the import draws it at its measured height with its crown clear of the walls, however narrow
 * they make it (`treeVariant`, G-814): one too near them even for the narrowest crown is a tree in
 * a yard's corner the game cannot draw, and none stands. Going over the crowns again for their cells out of every tree's reach (probe of 14.11) took 2317
 * trees instead of 1423 for 56 squares of `canopy-without-tree` instead of 68: once is enough.
 *
 * The tree's height and size are then the import's (`measureTree`, `treeVariant`): the highest
 * crown within 3 m of it, off the roofs. The same data give the same trees.
 */
import { PLAIN_SPECIES, TREE_CROWN, TREE_TOP } from "../../../packages/core/src/world/trees.ts";
import type { Cover } from "../../orto/src/cover.ts";
import type { Chm } from "../../gugik/src/nmpt.ts";
import { KeepOut } from "./crown-ground.ts";
import { type CrownContext, EAVE_SHARE, centreOf, crownGrid, crownShare, onEave, topsOf, trunkOf } from "./crown-grid.ts";
import type { Pt, Rect } from "./geometry.ts";
import type { PlanItem } from "./props-gen.ts";
import { fnv } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { type Structure, StructureIndex } from "./structures.ts";
import { NOT_A_CROWN, crownClear, measureTree, treeVariant } from "./tree-heights.ts";

export { MIN_TOP, TOP_REACH } from "./crown-grid.ts";

/** The id of the rule's group in the plan. */
export const CROWN_GROUP = "rule.crown-trees";

/** The drawn crown's reach per metre of the tree's height: the mean of the species a tree with no species in OSM takes. */
const REACH_PER_M = TREE_CROWN.slice(0, PLAIN_SPECIES).reduce((s, r, i) => s + r / TREE_TOP[i]!, 0) / PLAIN_SPECIES;

/** How far the drawn crown of a tree `height` metres tall reaches from its trunk (m), 2 m at the least. */
export const crownReach = (height: number): number => Math.max(2, Math.round(REACH_PER_M * height * 10) / 10);

/** A tree the rule stands: where, and the crown's top over the ground there. */
export interface CrownTree {
  readonly p: Pt;
  readonly top: number;
}

/** A tree of the game the rule keeps off: where, and how far its drawn crown reaches. */
export interface GameTree {
  readonly p: Pt;
  readonly reach: number;
}

/** The control numbers of `pnpm osm:props`: the crown cells and tops, and the tops turned down by reason. */
export interface CrownStats {
  readonly cells: number;
  readonly tops: number;
  /** Under the crown of a tree of the game or one taken before. */
  readonly nearTree: number;
  /** No cell a trunk may stand in under it. */
  readonly noGround: number;
  /** An eave's plateau with too little crown on the orthophoto. */
  readonly eave: number;
  /** A crown too near the walls to stand at its height even at its narrowest. */
  readonly byWall: number;
}

/** Trees by a grid, for the within-reach queries. */
class TreeGrid {
  private readonly bins = new Map<string, GameTree[]>();
  private readonly cell = 2 * crownReach(NOT_A_CROWN);
  add(t: GameTree): void {
    const k = `${Math.floor(t.p.x / this.cell)},${Math.floor(t.p.z / this.cell)}`;
    const list = this.bins.get(k);
    if (list) list.push(t);
    else this.bins.set(k, [t]);
  }
  /** Whether a tree stands within the larger of `reach` and its own crown's of p. */
  near(p: Pt, reach: number): boolean {
    const [gx, gz] = [Math.floor(p.x / this.cell), Math.floor(p.z / this.cell)];
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) for (const q of this.bins.get(`${gx + i},${gz + j}`) ?? []) if (Math.hypot(q.p.x - p.x, q.p.z - p.z) < Math.max(reach, q.reach)) return true;
    return false;
  }
}

/** The key of the rule's tree at p, which seeds its species and size in `props-gen`. */
export const crownKey = (p: Pt): string => `chm@${p.x},${p.z}`;

/** Whether the import draws the rule's tree at p at its measured height with its crown clear of the walls, as `props-gen` sizes it (`measureTree`, `treeVariant`). */
const drawnMeasured = (site: Site, p: Pt, chms: readonly Chm[]): boolean => {
  const h = measureTree(site, p, undefined, chms);
  if (h === null) return false;
  return crownClear(site, p, treeVariant(site, p, fnv(crownKey(p)) & 0xffff, undefined, h.height));
};

/**
 * The trees of the crowns over `rects` with none of the game's `trees` (placed before) under them,
 * out of the map's `structures`, highest first, then by place, and the control numbers.
 */
export const crownTrees = (
  rects: readonly Rect[],
  site: Site,
  covers: readonly Cover[],
  chms: readonly Chm[],
  trees: readonly GameTree[],
  structures: readonly Structure[] = [],
): { trees: CrownTree[]; stats: CrownStats } => {
  const ctx: CrownContext = { site, keep: new KeepOut(site), structures: new StructureIndex(structures), covers, chms };
  const grids = rects.map((r) => crownGrid(r, ctx));
  const tops = grids.flatMap((g) => topsOf(g, ctx).map((i) => ({ g, i, p: centreOf(g, i), top: g.raw[i]! })));
  tops.sort((a, b) => b.top - a.top || a.p.z - b.p.z || a.p.x - b.p.x);
  const near = new TreeGrid();
  for (const t of trees) near.add(t);
  const out: CrownTree[] = [];
  const stats = { cells: grids.reduce((n, g) => n + g.h.filter((h) => !Number.isNaN(h)).length, 0), tops: tops.length, nearTree: 0, noGround: 0, eave: 0, byWall: 0 };
  for (const t of tops) {
    const reach = crownReach(t.top);
    const at = trunkOf(t.g, t.i, reach);
    if (at === null) {
      stats.noGround++;
      continue;
    }
    const p = centreOf(t.g, at);
    if (near.near(p, reach)) stats.nearTree++;
    else if (onEave(ctx, t.p, t.top) && crownShare(covers, t.p, reach) < EAVE_SHARE) stats.eave++;
    else if (!drawnMeasured(site, p, chms)) stats.byWall++;
    else {
      out.push({ p, top: t.top });
      near.add({ p, reach });
    }
  }
  return { trees: out, stats };
};

/** The rule's trees as a group of the plan, after its own: keyed by place, so a tree keeps its seed when others come or go. */
export const crownTreeItem = (trees: readonly CrownTree[]): PlanItem => ({
  id: CROWN_GROUP,
  kind: "tree",
  points: trees.map((t) => [t.p.x, t.p.z] as const),
  osm: trees.map((t) => crownKey(t.p)),
  count: trees.length,
  note: "Crowns of NMPT less NMT the orthophoto shows, with no tree of OSM or the plan under them (crown-trees.ts, G-797).",
});
