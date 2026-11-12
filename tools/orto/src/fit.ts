/**
 * Section 1 of the cell report: the game's footprints against LoD2 (ADR-0077). Both sets are taken
 * from the same rectangle (centroid within the cell grown by `PICK`), rasterised at 0.5 m, and their
 * IoU is measured over the cell at (0; 0), at the best shift of LoD2 within ±`RANGE` m and over each
 * half of the cell; then the buildings are paired one to one by IoU (`matchFootprints`, IoU ≥ 0.3)
 * and the pairs' centroids compared. A whole-cell shift shows as a best shift away from (0; 0) and
 * a median pair offset of metres; outlines merged or split differently only lower the IoU.
 */
import { type Pt, type Rect, centroid } from "../../osm-import/src/geometry.ts";
import { matchFootprints } from "../../gugik/src/match.ts";
import { type Grid, bestOverlap, gridOver, iouAt, rectMask, ringMask } from "./grid.ts";

export interface Keyed {
  readonly id: string;
  readonly ring: readonly Pt[];
}

/** The shifts tried (m each way), the grid (m), how far past the cell the buildings are picked (m), the pairs' least IoU. */
export const FIT = { RANGE: 8, STEP: 0.5, PICK: 30, PAIR_IOU: 0.3 } as const;

export interface FitSection {
  readonly game: number;
  readonly lod2: number;
  readonly iouZero: number;
  readonly best: { readonly dx: number; readonly dz: number; readonly iou: number };
  readonly halves: Readonly<Record<"west" | "east" | "south" | "north", number>>;
  /** m² in the cell only in the game's footprints, only in LoD2's (at (0; 0)). */
  readonly gameOnly: number;
  readonly lod2Only: number;
  readonly pairs: { readonly count: number; readonly of: number; readonly medianOffset: number; readonly medianDx: number; readonly medianDz: number };
  readonly verdict: string;
}

const median = (v: readonly number[]): number => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;

const within = (r: Rect, grow: number) => (b: Keyed) => {
  const c = centroid(b.ring);
  return c.x >= r.minX - grow && c.x < r.maxX + grow && c.z >= r.minZ - grow && c.z < r.maxZ + grow;
};

const halvesOf = (r: Rect): Record<"west" | "east" | "south" | "north", Rect> => {
  const [mx, mz] = [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  return { west: { ...r, maxX: mx }, east: { ...r, minX: mx }, south: { ...r, maxZ: mz }, north: { ...r, minZ: mz } };
};

/** The pairs of the cell's game buildings (centroid in it) with LoD2 (centroid in it grown 20 m). */
const pairsOf = (rect: Rect, game: readonly Keyed[], lod2: readonly Keyed[]): FitSection["pairs"] => {
  const g = game.filter(within(rect, 0));
  const l = lod2.filter(within(rect, 20));
  const m = matchFootprints(g, l, FIT.PAIR_IOU);
  const byId = new Map(l.map((b) => [b.id, b]));
  const off: number[] = [];
  const dxs: number[] = [];
  const dzs: number[] = [];
  for (const b of g) {
    const p = m.byA.get(b.id);
    if (!p) continue;
    const [a, c] = [centroid(b.ring), centroid(byId.get(p.b)!.ring)];
    off.push(Math.hypot(c.x - a.x, c.z - a.z));
    dxs.push(c.x - a.x);
    dzs.push(c.z - a.z);
  }
  return { count: off.length, of: g.length, medianOffset: r2(median(off)), medianDx: r2(median(dxs)), medianDz: r2(median(dzs)) };
};

const verdictOf = (s: Omit<FitSection, "verdict">): string => {
  const shift = Math.hypot(s.best.dx, s.best.dz);
  if (!s.game || !s.lod2) return "za mało budynków do porównania";
  if (shift <= FIT.STEP && (!s.pairs.count || s.pairs.medianOffset < 1))
    return `obrysy zgodne z LoD2: najlepsze IoU przy (${s.best.dx}; ${s.best.dz}), pary ${s.pairs.medianOffset} m; rozbieżności to inny podział budynków, nie przesunięcie`;
  return `możliwe przesunięcie obrysów: najlepsze IoU ${s.best.iou} przy (${s.best.dx}; ${s.best.dz}) wobec ${s.iouZero} przy (0; 0), pary ${s.pairs.medianOffset} m (dx ${s.pairs.medianDx}, dz ${s.pairs.medianDz})`;
};

export const fitSection = (rect: Rect, game: readonly Keyed[], lod2: readonly Keyed[]): FitSection => {
  const [g, l] = [game.filter(within(rect, FIT.PICK)), lod2.filter(within(rect, FIT.PICK))];
  const grid: Grid = gridOver(rect, FIT.STEP, FIT.RANGE + 4);
  const [a, b] = [ringMask(grid, g.map((x) => x.ring)), ringMask(grid, l.map((x) => x.ring))];
  const window = rectMask(grid, rect);
  const { zero, best } = bestOverlap(grid, a, b, window, FIT.RANGE);
  const halves = Object.fromEntries(Object.entries(halvesOf(rect)).map(([k, r]) => [k, r3(iouAt(grid, a, b, rectMask(grid, r), 0, 0))])) as FitSection["halves"];
  let [gameOnly, lod2Only] = [0, 0];
  for (let k = 0; k < window.length; k++) {
    if (!window[k] || a[k] === b[k]) continue;
    if (a[k]) gameOnly++;
    else lod2Only++;
  }
  const cell = Object.freeze({ game: g.filter(within(rect, 0)).length, lod2: l.filter(within(rect, 0)).length });
  const s = {
    ...cell,
    iouZero: r3(zero),
    best: { dx: best.dx, dz: best.dz, iou: r3(best.iou) },
    halves,
    gameOnly: Math.round(gameOnly * FIT.STEP * FIT.STEP),
    lod2Only: Math.round(lod2Only * FIT.STEP * FIT.STEP),
    pairs: pairsOf(rect, game, lod2),
  };
  return { ...s, verdict: verdictOf(s) };
};

export const fitText = (s: FitSection): string[] => [
  "-- obrysy wobec LoD2 (maski 0,5 m, ±8 m)",
  `budynki w komórce: gra ${s.game}, LoD2 ${s.lod2}; IoU (0; 0) ${s.iouZero}; najlepsze ${s.best.iou} przy (${s.best.dx}; ${s.best.dz})`,
  `połówki IoU: zachód ${s.halves.west}, wschód ${s.halves.east}, południe ${s.halves.south}, północ ${s.halves.north}; tylko gra ${s.gameOnly} m², tylko LoD2 ${s.lod2Only} m²`,
  `pary IoU ≥ ${FIT.PAIR_IOU}: ${s.pairs.count} z ${s.pairs.of}, mediana środków ${s.pairs.medianOffset} m (dx ${s.pairs.medianDx}, dz ${s.pairs.medianDz})`,
  `werdykt: ${s.verdict}`,
];
