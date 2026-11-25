/**
 * The crowns' grid of a district for the rule of the crowns' trees (G-797, G-815, `crown-trees.ts`):
 * on a 1 m world grid, the crown cells, the cells a trunk may stand in, the crowns' tops and the
 * tests a top passes before a tree stands under it.
 *
 * - The surface's cells: the height over the ground (NMPT less NMT) `MIN_TOP` to `NOT_A_CROWN`,
 *   `OFF_ROOF` or further from every building of the game, out of the map's structures
 *   (`structures.ts`: OSM buildings, building sites, markets, canopies) and the rectangles the game
 *   clears for its set pieces (`CROWN_CLEARED`: W-3, the car wash). Nearer the walls the
 *   surface model is the roof: the OSM outline is often 1 to 3 m inside it, and the model takes
 *   the highest of four 0.5 m cells.
 * - A crown cell: a surface's cell at least half of whose four 0.5 m samples of the orthophoto
 *   cover are crown (`canopy`, `canopyHard`).
 * - A top: a surface's cell no other within `TOP_REACH` tops, crown or not, with crown on the
 *   orthophoto round it (`TOP_SHARE` within `TOP_CONFIRM`): a crown's top is often in its shadow's
 *   class, and the green edge of a shed or a lean-to OSM lacks, beside its higher roof, is no top.
 *   Probe of 15.11: a top among the cells a trunk may stand in alone, as before, cut a crown by a
 *   path into pieces with a top each, so trees stood in rows along the paths' edges; within
 *   2.5 m 562 trees and 118 squares of `canopy-without-tree`, within 2 m 684 and 98, within 1.5 m
 *   833 and 90 with roofs again among them.
 * - The trunk: the top where a trunk may stand there (`trunkGround`), else the highest such crown
 *   cell within the crown's reach (a crown over a street gets its trunk at the kerb).
 * - An eave: a top the surface model joins to a building's outline within `EAVE_REACH` without
 *   falling a metre under it on the way (a roof's plateau, a lean-to OSM lacks); it stands a tree
 *   only where the orthophoto shows crown over `EAVE_SHARE` of its reach (a tree over a wall, not
 *   a green copper roof, moss or a creeper on a shed).
 */
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { type Chm, chmAt } from "../../gugik/src/nmpt.ts";
import { type KeepOut, trunkGround } from "./crown-ground.ts";
import { type Pt, type Rect, inRect } from "./geometry.ts";
import type { Site } from "./props-site.ts";
import { geoToPuwg, worldToGeo, worldToPuwg } from "./project.ts";
import type { StructureIndex } from "./structures.ts";
import { NOT_A_CROWN, OFF_ROOF, byRoof } from "./tree-heights.ts";

/** The lowest crown a tree is set under (m): lower is a hedge, a bush or a car. */
export const MIN_TOP = 4;
/** The grid's cell (m), the surface model's extract's. */
const CELL = 1;
/** How far a crown's top tops the rest of it (m). */
export const TOP_REACH = 2;
/** How far round a top the orthophoto confirms the crown (m), and the share of crown it needs. */
export const TOP_CONFIRM = 1.5;
export const TOP_SHARE = 0.3;
/** How far from a top an eave's plateau reaches a building's outline (m), and the fall that ends it (m). */
export const EAVE_REACH = 3.5;
const EAVE_FALL = 1;
/** The share of crown on the orthophoto within its reach an eave's top needs. */
export const EAVE_SHARE = 0.6;
/** W-3's rectangles of `CLEARED_BUILDINGS` (ADR-0082): its zone in bands 2 m in from its fence, its quay, tower, pier, basin, pipeline's corridor and the strip's one building. */
const W3_CLEARED: readonly Rect[] = [
  { minX: 2488, maxX: 2490, minZ: 413.8, maxZ: 446 },
  { minX: 2490, maxX: 2492.5, minZ: 411.7, maxZ: 446 },
  { minX: 2492.5, maxX: 2495, minZ: 409.6, maxZ: 452 },
  { minX: 2495, maxX: 2497.5, minZ: 407.4, maxZ: 452 },
  { minX: 2497.5, maxX: 2500, minZ: 405.8, maxZ: 452 },
  { minX: 2500, maxX: 2502.5, minZ: 403.7, maxZ: 452 },
  { minX: 2502.5, maxX: 2505, minZ: 401.9, maxZ: 452 },
  { minX: 2505, maxX: 2507.5, minZ: 400.2, maxZ: 452 },
  { minX: 2507.5, maxX: 2510, minZ: 398.5, maxZ: 452 },
  { minX: 2510, maxX: 2512.5, minZ: 396.8, maxZ: 452 },
  { minX: 2512.5, maxX: 2515, minZ: 395.1, maxZ: 452 },
  { minX: 2515, maxX: 2606, minZ: 392.8, maxZ: 452 },
  { minX: 2480, maxX: 2487.5, minZ: 418.5, maxZ: 440 },
  { minX: 2486, maxX: 2496, minZ: 436, maxZ: 446 },
  { minX: 2466, maxX: 2477, minZ: 426, maxZ: 438 },
  { minX: 2508, maxX: 2592, minZ: 452, maxZ: 478 },
  { minX: 2440, maxX: 2486, minZ: 441, maxZ: 445 },
  { minX: 2586, maxX: 2606, minZ: 380, maxZ: 395 },
];
/**
 * Crown cells this far round W-3's rectangles count as cut away (review round 2): the game's 2 m
 * clearance and the fence's 1.5 m. A crown the fence cuts then tops where it did on main, a few
 * metres out, not just outside the fence, where the game would take its tree away again.
 */
export const W3_CROWN_OFF = 3.5;
const grownBy = (r: Rect, d: number): Rect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d });

/**
 * The rectangles the game clears of the map's furniture for its set pieces (`CLEARED_BUILDINGS` of
 * `packages/sim/src/content/lublin/sites.ts`; the test holds them equal): no tree of the rule stands
 * there to be taken away again. W-3's grown by `W3_CROWN_OFF`.
 */
export const CROWN_CLEARED: readonly Rect[] = [...W3_CLEARED.map((r) => grownBy(r, W3_CROWN_OFF)),
  { minX: 389, maxX: 417, minZ: -44, maxZ: -20 },
];

/** What the grid reads. */
export interface CrownContext {
  readonly site: Site;
  readonly keep: KeepOut;
  readonly structures: StructureIndex;
  readonly covers: readonly Cover[];
  readonly chms: readonly Chm[];
}

export interface CrownGrid {
  readonly rect: Rect;
  readonly cols: number;
  readonly rows: number;
  /** The height over the ground of the cells `OFF_ROOF` off the buildings, out of the structures and the cleared rectangles, `MIN_TOP` to `NOT_A_CROWN`; NaN elsewhere. */
  readonly raw: Float32Array;
  /** The crown's height in its cells (those of `raw` the orthophoto shows as crown), NaN elsewhere. */
  readonly h: Float32Array;
  /** 1 where a trunk may stand in a crown cell. */
  readonly stand: Uint8Array;
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

/**
 * How tall the surface model stands at all four quarters of a cell for a crown the orthophoto's
 * cover misses (m): a tree the leaf-off flight shows as the paving or lawn under its bare twigs and
 * the summer flights do not mark (T-354, Plac Katedralny's lawn: NMPT 7-22 m over asphalt, paving
 * and green). Out of the map's structures and off the roofs, a thing 8 m tall and a metre across is
 * a crown: a lamp's post is thinner than a quarter of a cell, a mast's top is caught by the walls' rules.
 */
export const TALL_CROWN = 8;
const tallAllRound = (chms: readonly Chm[], p: Pt): boolean => QUARTERS.every(([dx, dz]) => chmOf(chms, { x: p.x + dx, z: p.z + dz }) >= TALL_CROWN);

/** The height over the ground at p (m), NaN without data. */
export const chmOf = (chms: readonly Chm[], p: Pt): number => {
  const q = worldToPuwg(p);
  return chmAt(chms, q.e, q.n);
};

export const centreOf = (g: CrownGrid, i: number): Pt => ({ x: g.rect.minX + (i % g.cols) * CELL + CELL / 2, z: g.rect.minZ + Math.floor(i / g.cols) * CELL + CELL / 2 });

/** The crown cells of `rect` and where a trunk may stand in them. */
export const crownGrid = (rect: Rect, ctx: CrownContext): CrownGrid => {
  const cols = Math.round((rect.maxX - rect.minX) / CELL);
  const rows = Math.round((rect.maxZ - rect.minZ) / CELL);
  const g: CrownGrid = { rect, cols, rows, raw: new Float32Array(cols * rows).fill(Number.NaN), h: new Float32Array(cols * rows).fill(Number.NaN), stand: new Uint8Array(cols * rows) };
  // `chmOf` by the cells' latitudes and longitudes, each once: a row's latitude is its z's, a column's longitude its x's.
  const lats = Array.from({ length: rows }, (_, r) => worldToGeo(centreOf(g, r * cols)).lat);
  const lons = Array.from({ length: cols }, (_, c) => worldToGeo(centreOf(g, c)).lon);
  for (let i = 0; i < cols * rows; i++) {
    const p = centreOf(g, i);
    const q = geoToPuwg(lats[Math.floor(i / cols)]!, lons[i % cols]!);
    const h = chmAt(ctx.chms, q.e, q.n);
    if (!(h >= MIN_TOP && h <= NOT_A_CROWN) || CROWN_CLEARED.some((r) => inRect(p, r)) || ctx.structures.at(p) || byRoof(ctx.site, p, OFF_ROOF)) continue;
    g.raw[i] = h;
    const cover = coverFor(ctx.covers, p);
    const onCover = cover !== undefined && QUARTERS.filter(([dx, dz]) => isCrown(cover, p.x + dx, p.z + dz)).length >= 2;
    if (!onCover && !tallAllRound(ctx.chms, p)) continue;
    g.h[i] = h;
    if (trunkGround(ctx.site, ctx.keep, p)) g.stand[i] = 1;
  }
  return g;
};

/** The offsets (columns, rows) within `reach` of a cell but itself, in index order: once a reach. */
const OFFSETS = new Map<number, readonly (readonly [number, number])[]>();
const offsetsOf = (reach: number): readonly (readonly [number, number])[] => {
  let out = OFFSETS.get(reach);
  if (out) return out;
  const r = Math.ceil(reach / CELL);
  const list: [number, number][] = [];
  for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (!(dc === 0 && dr === 0) && (dc * dc + dr * dr) * CELL * CELL <= reach * reach) list.push([dc, dr]);
  OFFSETS.set(reach, (out = list));
  return out;
};

/** The cells within `reach` of cell i, by offsets, in index order. */
const around = (g: CrownGrid, i: number, reach: number): number[] => {
  const [c, row] = [i % g.cols, Math.floor(i / g.cols)];
  const out: number[] = [];
  for (const [dc, dr] of offsetsOf(reach)) {
    const [cc, rr] = [c + dc, row + dr];
    if (cc >= 0 && rr >= 0 && cc < g.cols && rr < g.rows) out.push(rr * g.cols + cc);
  }
  return out;
};

/**
 * The crowns' tops of a grid: cells of `raw` no other within `TOP_REACH` tops (ties to the earlier),
 * the orthophoto showing crown over `TOP_SHARE` of the ground within `TOP_CONFIRM` of them: the top
 * of a crown is often in its shadow's class, and a shed's green edge beside its higher roof is no top.
 */
/** The share of the cells within `reach` of i, and i, that are crown cells of the grid. */
const gridShare = (g: CrownGrid, i: number, reach: number): number => {
  const cells = [i, ...around(g, i, reach)];
  return cells.filter((j) => !Number.isNaN(g.h[j]!)).length / cells.length;
};

export const topsOf = (g: CrownGrid, ctx: CrownContext): number[] => {
  const out: number[] = [];
  for (let i = 0; i < g.raw.length; i++) {
    const h = g.raw[i]!;
    if (Number.isNaN(h)) continue;
    if (around(g, i, TOP_REACH).some((j) => g.raw[j]! > h || (g.raw[j]! === h && j < i))) continue;
    // Confirmed by the orthophoto's crown round it, or by the crown cells of the grid (the tall ones the leaf-off cover misses, T-354).
    if (crownShare(ctx.covers, centreOf(g, i), TOP_CONFIRM) >= TOP_SHARE || gridShare(g, i, TOP_CONFIRM) >= TOP_SHARE) out.push(i);
  }
  return out;
};

/** The cell a trunk stands in under the top i: the top, else the highest crown cell a trunk may stand in within `reach` (ties to the earlier); null with none. */
export const trunkOf = (g: CrownGrid, i: number, reach: number): number | null => {
  if (g.stand[i]) return i;
  let best: number | null = null;
  for (const j of around(g, i, reach)) if (g.stand[j] && (best === null || g.h[j]! > g.h[best]!)) best = j;
  return best;
};

/** Whether the surface model joins the top at p, `top` m high, to a building's outline within `EAVE_REACH` without falling `EAVE_FALL` under it. */
export const onEave = (ctx: CrownContext, p: Pt, top: number): boolean => {
  for (let a = 0; a < 16; a++) {
    const [ux, uz] = [Math.cos((a * Math.PI) / 8), Math.sin((a * Math.PI) / 8)];
    for (let d = 0.5; d <= EAVE_REACH; d += 0.5) {
      const q = { x: p.x + ux * d, z: p.z + uz * d };
      if (!(chmOf(ctx.chms, q) >= top - EAVE_FALL)) break;
      if (ctx.site.surfaceAt(q) === "building") return true;
    }
  }
  return false;
};

/** The share of the orthophoto's 0.5 m samples within `reach` of p that are crown. */
export const crownShare = (covers: readonly Cover[], p: Pt, reach: number): number => {
  let [n, k] = [0, 0];
  for (let dz = -reach; dz <= reach; dz += 0.5)
    for (let dx = -reach; dx <= reach; dx += 0.5) {
      if (dx * dx + dz * dz > reach * reach) continue;
      n++;
      const q = { x: p.x + dx, z: p.z + dz };
      const c = coverFor(covers, q);
      if (c && isCrown(c, q.x, q.z)) k++;
    }
  return n ? k / n : 0;
};
