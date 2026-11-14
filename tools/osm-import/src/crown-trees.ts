/**
 * The trees OSM has no node for (G-797, T-292, ADR-0077 step 5), by one rule for the whole city
 * rather than lines drawn into the plan: a tree stands under each crown of the surface model that
 * the orthophoto shows as one. On a 1 m world grid over each district:
 *
 * - a cell is a crown's where at least half of its four 0.5 m samples of the orthophoto cover are
 *   crown (`canopy`, `canopyHard`, `data/orto`) and the height over the ground there (NMPT less NMT,
 *   `data/gugik/nmpt`) is between `MIN_TOP` and `NOT_A_CROWN`, `OFF_ROOF` and further from every
 *   building's outline (eaves, the rule of `tree-heights.ts`);
 * - a trunk may stand in it where `trunkGround` lets one (`crown-ground.ts`): open ground off the
 *   roads, paths, steps, decks, car parks and barriers; a crown over a street gets its trunk at the
 *   edge of it, where the crown is highest off the road;
 * - a crown's top is such a cell no other within `TOP_REACH` tops (ties to the one of least z, then
 *   least x): one per crown, not one per bump of it;
 * - the tops are taken highest first, each where no tree of the game (OSM's, the plan's rows) and no
 *   tree taken before stands within the larger of the two crowns' reach (`crownReach`: the drawn
 *   crown of a tree of that height), and where the import draws it at its measured height: a crown
 *   the walls stop from growing past its seed's size (`treeVariant`) is a tree in a yard's corner
 *   the game cannot draw, and none stands. Going over the crowns again for their cells out of every
 *   tree's reach (probe of 14.11, before the car parks and barriers kept the trunks off) took 2317
 *   trees instead of 1423 for 56 squares of `canopy-without-tree` instead of 68: a wood's crowns
 *   are wider than its trees' drawn ones, and once is enough.
 *
 * The tree's height and size are then the import's (`measureTree`, `treeVariant`): the highest
 * crown within 3 m of it, off the roofs, so the top found here sizes it. The same data give the
 * same trees.
 */
import { PLAIN_SPECIES, TREE_CROWN, TREE_TOP, plainTreeVariant } from "../../../packages/core/src/world/trees.ts";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { type Chm, chmAt } from "../../gugik/src/nmpt.ts";
import { KeepOut, trunkGround } from "./crown-ground.ts";
import type { Pt, Rect } from "./geometry.ts";
import type { PlanItem } from "./props-gen.ts";
import { fnv } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { worldToPuwg } from "./project.ts";
import { NOT_A_CROWN, OFF_ROOF, measureTree, treeVariant } from "./tree-heights.ts";

/** The lowest crown a tree is set under (m): lower is a hedge, a bush or a car. */
export const MIN_TOP = 4;
/** The grid's cell (m), the surface model's extract's. */
const CELL = 1;
/** How far a crown's top tops the rest of it (m): no other crown cell this near is higher. */
export const TOP_REACH = 2.5;
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

/** The control numbers of `pnpm osm:props`: the crown cells, the tops found, those under a tree's crown and those the walls stop. */
export interface CrownStats {
  readonly cells: number;
  readonly tops: number;
  readonly nearTree: number;
  readonly byWall: number;
}

const isCrown = (c: Cover, x: number, z: number): boolean => {
  const k = coverAt(c, x, z);
  return k === COVER.canopy || k === COVER.canopyHard;
};

/** The four samples of the cover in a cell, at its quarters. */
const QUARTERS = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [-0.25, 0.25],
  [0.25, 0.25],
] as const;

/** Whether p lies in a building's outline or within `reach` of it, on the eight ways at `reach` and half of it. */
const byRoof = (site: Site, p: Pt, reach: number): boolean => {
  if (site.surfaceAt(p) === "building") return true;
  for (let i = 0; i < 8; i++) {
    const [dx, dz] = [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)];
    for (const r of [reach, reach / 2]) if (site.surfaceAt({ x: p.x + dx * r, z: p.z + dz * r }) === "building") return true;
  }
  return false;
};

/** A district's grid: the crown's height in the cells a trunk may stand in, NaN elsewhere. */
interface CrownGrid {
  readonly rect: Rect;
  readonly cols: number;
  readonly rows: number;
  readonly h: Float32Array;
}

const centreOf = (g: CrownGrid, i: number): Pt => ({ x: g.rect.minX + (i % g.cols) * CELL + CELL / 2, z: g.rect.minZ + Math.floor(i / g.cols) * CELL + CELL / 2 });

/** The cells of `rect` a trunk may stand in under a crown (`isCrown` on half the samples, height in range, off the roofs). */
const crownGrid = (rect: Rect, site: Site, keep: KeepOut, covers: readonly Cover[], chms: readonly Chm[]): CrownGrid => {
  const cols = Math.round((rect.maxX - rect.minX) / CELL);
  const rows = Math.round((rect.maxZ - rect.minZ) / CELL);
  const g: CrownGrid = { rect, cols, rows, h: new Float32Array(cols * rows).fill(Number.NaN) };
  for (let i = 0; i < cols * rows; i++) {
    const p = centreOf(g, i);
    const cover = coverFor(covers, p);
    if (!cover || QUARTERS.filter(([dx, dz]) => isCrown(cover, p.x + dx, p.z + dz)).length < 2) continue;
    const q = worldToPuwg(p);
    const h = chmAt(chms, q.e, q.n);
    if (!(h >= MIN_TOP && h <= NOT_A_CROWN) || byRoof(site, p, OFF_ROOF) || !trunkGround(site, keep, p)) continue;
    g.h[i] = h;
  }
  return g;
};

/** The tops of a grid's crowns: cells no other crown cell within `TOP_REACH` tops (ties to the earlier). */
const topsOf = (g: CrownGrid): number[] => {
  const out: number[] = [];
  const r = Math.ceil(TOP_REACH / CELL);
  for (let i = 0; i < g.h.length; i++) {
    const h = g.h[i]!;
    if (Number.isNaN(h)) continue;
    const [c, row] = [i % g.cols, Math.floor(i / g.cols)];
    let top = true;
    for (let dr = -r; dr <= r && top; dr++) {
      for (let dc = -r; dc <= r && top; dc++) {
        const [cc, rr] = [c + dc, row + dr];
        if ((dc === 0 && dr === 0) || cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows || (dc * dc + dr * dr) * CELL * CELL > TOP_REACH * TOP_REACH) continue;
        const j = rr * g.cols + cc;
        const o = g.h[j]!;
        if (o > h || (o === h && j < i)) top = false;
      }
    }
    if (top) out.push(i);
  }
  return out;
};

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

/**
 * The trees of the crowns over `rects` with none of the game's `trees` (placed before) under them,
 * highest first, then by place, and the control numbers.
 */
export const crownTrees = (rects: readonly Rect[], site: Site, covers: readonly Cover[], chms: readonly Chm[], trees: readonly GameTree[]): { trees: CrownTree[]; stats: CrownStats } => {
  const keep = new KeepOut(site);
  const grids = rects.map((r) => crownGrid(r, site, keep, covers, chms));
  const tops = grids.flatMap((g) => topsOf(g).map((i) => ({ p: centreOf(g, i), top: g.h[i]! })));
  tops.sort((a, b) => b.top - a.top || a.p.z - b.p.z || a.p.x - b.p.x);
  const near = new TreeGrid();
  for (const t of trees) near.add(t);
  const out: CrownTree[] = [];
  let byWall = 0;
  for (const t of tops) {
    const reach = crownReach(t.top);
    if (near.near(t.p, reach)) continue;
    if (!drawnMeasured(site, t.p, chms)) {
      byWall++;
      continue;
    }
    out.push(t);
    near.add({ p: t.p, reach });
  }
  const cells = grids.reduce((n, g) => n + g.h.filter((h) => !Number.isNaN(h)).length, 0);
  return { trees: out, stats: { cells, tops: tops.length, nearTree: tops.length - out.length - byWall, byWall } };
};

/** The key of the rule's tree at p, which seeds its species and size in `props-gen`. */
export const crownKey = (p: Pt): string => `chm@${p.x},${p.z}`;

/** Whether the import draws the rule's tree at p at its measured height, as `props-gen` sizes it (`measureTree`, `treeVariant`). */
const drawnMeasured = (site: Site, p: Pt, chms: readonly Chm[]): boolean => {
  const h = measureTree(site, p, undefined, chms);
  if (h === null) return false;
  const v = treeVariant(site, p, fnv(crownKey(p)) & 0xffff, undefined, h.height);
  return plainTreeVariant(v) !== v;
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
