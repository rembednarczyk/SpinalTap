/**
 * The crowns' grid of a district for the rule of the crowns' trees (G-797, G-815, `crown-trees.ts`):
 * on a 1 m world grid, the crown cells, the cells a trunk may stand in, the crowns' tops and the
 * tests a top passes before a tree stands under it.
 *
 * - A crown cell: at least half of its four 0.5 m samples of the orthophoto cover are crown
 *   (`canopy`, `canopyHard`), the height over the ground (NMPT less NMT) is `MIN_TOP` to
 *   `NOT_A_CROWN`, it lies `OFF_ROOF` or further from every building of the game, and out of the
 *   map's structures (`structures.ts`: OSM buildings, building sites, markets, canopies) and the
 *   rectangles the game clears for its set pieces (`CROWN_CLEARED`: the docks, the car wash).
 * - A crown cell a trunk may stand in (`trunkGround`) is kept; a top is such a cell no other within
 *   `TOP_REACH` tops (ties to the earlier).
 */
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { type Chm, chmAt } from "../../gugik/src/nmpt.ts";
import { type KeepOut, trunkGround } from "./crown-ground.ts";
import { type Pt, type Rect, inRect } from "./geometry.ts";
import type { Site } from "./props-site.ts";
import { worldToPuwg } from "./project.ts";
import type { StructureIndex } from "./structures.ts";
import { NOT_A_CROWN, OFF_ROOF } from "./tree-heights.ts";

/** The lowest crown a tree is set under (m): lower is a hedge, a bush or a car. */
export const MIN_TOP = 4;
/** The grid's cell (m), the surface model's extract's. */
const CELL = 1;
/** How far a crown's top tops the rest of it (m). */
export const TOP_REACH = 2.5;
/**
 * The rectangles the game clears of the map's furniture for its set pieces (`CLEARED_BUILDINGS` of
 * `packages/sim/src/content/lublin/sites.ts`: the docks, their basin, the car wash; the test holds
 * them equal): no tree of the rule stands there to be taken away again.
 */
export const CROWN_CLEARED: readonly Rect[] = [
  { minX: 2520, maxX: 2594, minZ: 390, maxZ: 450 },
  { minX: 2520, maxX: 2594, minZ: 452, maxZ: 500 },
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
  /** The crown's height in its cells, NaN elsewhere. */
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

/** The height over the ground at p (m), NaN without data. */
export const chmOf = (chms: readonly Chm[], p: Pt): number => {
  const q = worldToPuwg(p);
  return chmAt(chms, q.e, q.n);
};

/** Whether p lies in a building's outline or within `reach` of it, on the eight ways at `reach` and half of it. */
const byRoof = (site: Site, p: Pt, reach: number): boolean => {
  if (site.surfaceAt(p) === "building") return true;
  for (let i = 0; i < 8; i++) {
    const [dx, dz] = [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)];
    for (const r of [reach, reach / 2]) if (site.surfaceAt({ x: p.x + dx * r, z: p.z + dz * r }) === "building") return true;
  }
  return false;
};

export const centreOf = (g: CrownGrid, i: number): Pt => ({ x: g.rect.minX + (i % g.cols) * CELL + CELL / 2, z: g.rect.minZ + Math.floor(i / g.cols) * CELL + CELL / 2 });

/** The crown cells of `rect` a trunk may stand in. */
export const crownGrid = (rect: Rect, ctx: CrownContext): CrownGrid => {
  const cols = Math.round((rect.maxX - rect.minX) / CELL);
  const rows = Math.round((rect.maxZ - rect.minZ) / CELL);
  const g: CrownGrid = { rect, cols, rows, h: new Float32Array(cols * rows).fill(Number.NaN), stand: new Uint8Array(cols * rows) };
  for (let i = 0; i < cols * rows; i++) {
    const p = centreOf(g, i);
    const cover = coverFor(ctx.covers, p);
    if (!cover || QUARTERS.filter(([dx, dz]) => isCrown(cover, p.x + dx, p.z + dz)).length < 2) continue;
    const h = chmOf(ctx.chms, p);
    if (!(h >= MIN_TOP && h <= NOT_A_CROWN) || CROWN_CLEARED.some((r) => inRect(p, r)) || ctx.structures.at(p) || byRoof(ctx.site, p, OFF_ROOF)) continue;
    if (!trunkGround(ctx.site, ctx.keep, p)) continue;
    g.h[i] = h;
    g.stand[i] = 1;
  }
  return g;
};

/** The cells within `reach` of cell i, by offsets, in index order. */
const around = (g: CrownGrid, i: number, reach: number): number[] => {
  const r = Math.ceil(reach / CELL);
  const [c, row] = [i % g.cols, Math.floor(i / g.cols)];
  const out: number[] = [];
  for (let dr = -r; dr <= r; dr++)
    for (let dc = -r; dc <= r; dc++) {
      const [cc, rr] = [c + dc, row + dr];
      if ((dc === 0 && dr === 0) || cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows || (dc * dc + dr * dr) * CELL * CELL > reach * reach) continue;
      out.push(rr * g.cols + cc);
    }
  return out;
};

/** The crowns' tops of a grid: crown cells no other crown cell within `TOP_REACH` tops (ties to the earlier). */
export const topsOf = (g: CrownGrid): number[] => {
  const out: number[] = [];
  for (let i = 0; i < g.h.length; i++) {
    const h = g.h[i]!;
    if (Number.isNaN(h)) continue;
    if (!around(g, i, TOP_REACH).some((j) => g.h[j]! > h || (g.h[j]! === h && j < i))) out.push(i);
  }
  return out;
};
