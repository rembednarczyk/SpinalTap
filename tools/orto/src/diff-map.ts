/**
 * Two versions of the map against each other for the curator's review (`diff.ts`, `pnpm orto:diff`):
 * the paving each adds or removes on the orthophoto's cover classes, by surface and cell; the
 * terrain grid's points it moves, against the NMT; and the bridges' decks it changes (ends,
 * heights). Pure functions on `MapSnapshot`s and cover rasters.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { COVER, COVER_NAMES, type CoverName } from "./classify.ts";
import { type Cover, type CoverHeader } from "./cover.ts";
import { type Grid2, type MapSnapshot, type SnapChunk, type SnapDeck } from "./diff-snapshot.ts";
import { type ClassCounts, samplesIn, zeroCounts } from "./rings.ts";

/** What lies on top of a sample: a surface, `building`, or nothing (bare ground). */
export const BUILDING = "building";

const near = (r: Rect, pts: readonly Pt[], margin = 0): boolean => {
  let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) [minX, minZ, maxX, maxZ] = [Math.min(minX, p.x), Math.min(minZ, p.z), Math.max(maxX, p.x), Math.max(maxZ, p.z)];
  return maxX >= r.minX - margin && minX <= r.maxX + margin && maxZ >= r.minZ - margin && minZ <= r.maxZ + margin;
};

export const overlaps = (a: Rect, b: Rect): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

/**
 * The top of each sample of the raster in `window`: an index into `names` (0: nothing). Pieces in
 * the map's order, the last drawn over the others, a building over all, as `cellOverlay` counts them.
 */
export const topSurfaces = (h: CoverHeader, chunks: readonly SnapChunk[], window: Rect, names: string[]): Int16Array => {
  const top = new Int16Array(h.width * h.height);
  const id = (s: string) => {
    let i = names.indexOf(s);
    if (i < 0) i = names.push(s) - 1;
    return i;
  };
  for (const c of chunks) for (const g of c.ground) if (near(window, g.ring)) for (const k of samplesIn(h, g.ring)) top[k] = id(g.surface);
  const b = id(BUILDING);
  for (const c of chunks) for (const r of c.buildings) if (near(window, r)) for (const k of samplesIn(h, r)) top[k] = b;
  return top;
};

export interface SurfaceChange {
  /** m² by cover class a version adds of the surface, and removes. */
  readonly added: ClassCounts;
  readonly removed: ClassCounts;
}

export interface SurfaceDiff {
  readonly bySurface: Record<string, SurfaceChange>;
  readonly byCell: Record<string, Record<string, SurfaceChange>>;
  /** m² changed (the samples whose top differs). */
  readonly changedM2: number;
}

const change = (): SurfaceChange => ({ added: zeroCounts(), removed: zeroCounts() });
const round1 = (v: number) => Math.round(v * 10) / 10;
const rounded = (c: ClassCounts, m2: number): ClassCounts => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, round1(v * m2)])) as ClassCounts;

/**
 * The samples whose top differs between `a` and `b` in `window`, by surface and cover class (m²),
 * on the rasters `covers` (a sample counts on the first raster holding it), and by the cell of
 * `cells` holding it (`-` outside them).
 */
export const surfaceDiff = (covers: readonly Cover[], a: MapSnapshot, b: MapSnapshot, window: Rect, cells: readonly { readonly id: string; readonly rect: Rect }[]): SurfaceDiff => {
  const counts: Record<string, Record<string, SurfaceChange>> = {};
  let changed = 0;
  let m2 = 0.25;
  covers.forEach((cover, ci) => {
    const h = cover.header;
    m2 = h.step * h.step;
    const names = [""];
    const ta = topSurfaces(h, a.chunks, window, names);
    const tb = topSurfaces(h, b.chunks, window, names);
    for (let k = 0; k < ta.length; k++) {
      if (ta[k] === tb[k]) continue;
      const x = h.x0 + ((k % h.width) + 0.5) * h.step;
      const z = h.z1 - (Math.floor(k / h.width) + 0.5) * h.step;
      if (x < window.minX || x >= window.maxX || z < window.minZ || z >= window.maxZ) continue;
      if (covers.slice(0, ci).some((o) => holds(o.header, x, z))) continue;
      const cls: CoverName = COVER_NAMES[cover.cls[k] ?? COVER.none] ?? "none";
      const cell = cells.find((c) => x >= c.rect.minX && x < c.rect.maxX && z >= c.rect.minZ && z < c.rect.maxZ)?.id ?? "-";
      const per = (counts[cell] ??= {});
      if (ta[k]) (per[names[ta[k]!]!] ??= change()).removed[cls]++;
      if (tb[k]) (per[names[tb[k]!]!] ??= change()).added[cls]++;
      changed++;
    }
  });
  const bySurface: Record<string, SurfaceChange> = {};
  const byCell: Record<string, Record<string, SurfaceChange>> = {};
  for (const cell of Object.keys(counts).sort())
    for (const [s, c] of Object.entries(counts[cell]!).sort(([p], [q]) => p.localeCompare(q))) {
      (byCell[cell] ??= {})[s] = { added: rounded(c.added, m2), removed: rounded(c.removed, m2) };
      const t = (bySurface[s] ??= change());
      for (const n of COVER_NAMES) [t.added[n], t.removed[n]] = [t.added[n] + c.added[n], t.removed[n] + c.removed[n]];
    }
  for (const [s, c] of Object.entries(bySurface)) bySurface[s] = { added: rounded(c.added, m2), removed: rounded(c.removed, m2) };
  return { bySurface, byCell, changedM2: round1(changed * m2) };
};

const holds = (h: CoverHeader, x: number, z: number): boolean => x >= h.x0 && x < h.x0 + h.width * h.step && z <= h.z1 && z > h.z1 - h.height * h.step;

/** Height of a grid at (x, z), bilinear and clamped at its edge (as `terrainHeightAt` in core). */
export const heightAt = (g: Grid2, x: number, z: number): number => {
  const fx = Math.min(Math.max((x - g.originX) / g.cell, 0), g.cols - 1);
  const fz = Math.min(Math.max((z - g.originZ) / g.cell, 0), g.rows - 1);
  const c0 = Math.min(Math.floor(fx), Math.max(0, g.cols - 2));
  const r0 = Math.min(Math.floor(fz), Math.max(0, g.rows - 2));
  const [c1, r1] = [Math.min(c0 + 1, g.cols - 1), Math.min(r0 + 1, g.rows - 1)];
  const [tx, tz] = [fx - c0, fz - r0];
  const h = (r: number, c: number) => g.heights[r * g.cols + c] ?? 0;
  return (h(r0, c0) * (1 - tx) + h(r0, c1) * tx) * (1 - tz) + (h(r1, c0) * (1 - tx) + h(r1, c1) * tx) * tz;
};

/** A height change smaller than this is the rounding (m). */
export const MOVE_EPS = 0.005;

export interface MovedPoint {
  readonly chunk: string;
  readonly x: number;
  readonly z: number;
  readonly before: number;
  readonly after: number;
  readonly nmt: number;
}

export interface TerrainStats {
  readonly points: number;
  /** The area the moved points stand for: a grid cell each (m²). */
  readonly m2: number;
  readonly maxAbs: number;
  readonly medianAbs: number;
  readonly maxUp: number;
  readonly maxDown: number;
  /** |height − NMT| over the moved points, before and after: median and max. */
  readonly offNmtBefore: { readonly median: number; readonly max: number };
  readonly offNmtAfter: { readonly median: number; readonly max: number };
}

export interface TerrainDiff {
  readonly total: TerrainStats;
  readonly byChunk: Record<string, TerrainStats>;
  /** NMT points the import itself moved (a new terrain import), by chunk. */
  readonly nmtMoved: Record<string, number>;
  readonly onlyBefore: readonly string[];
  readonly onlyAfter: readonly string[];
  /** The points moved most, up to 10. */
  readonly largest: readonly MovedPoint[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const median = (v: readonly number[]): number => {
  if (!v.length) return 0;
  const s = [...v].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const terrainStats = (moved: readonly MovedPoint[], cellArea: number): TerrainStats => {
  const d = moved.map((p) => p.after - p.before);
  const off = (pick: (p: MovedPoint) => number) => {
    const v = moved.map((p) => Math.abs(pick(p) - p.nmt));
    return { median: r3(median(v)), max: r3(v.length ? Math.max(...v) : 0) };
  };
  return {
    points: moved.length,
    m2: round1(cellArea),
    maxAbs: r3(d.length ? Math.max(...d.map(Math.abs)) : 0),
    medianAbs: r3(median(d.map(Math.abs))),
    maxUp: r3(Math.max(0, ...d)),
    maxDown: r3(Math.max(0, ...d.map((v) => -v))),
    offNmtBefore: off((p) => p.before),
    offNmtAfter: off((p) => p.after),
  };
};

const inRect = (r: Rect, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/**
 * The game's terrain points `b` moves against `a` in `window`: every point of b's shaped grid
 * against a's grid there (the same grid point by point, else a's surface under it), and the NMT
 * (b's import grid) under it.
 */
export const terrainDiff = (a: MapSnapshot, b: MapSnapshot, window: Rect): TerrainDiff => {
  const byId = new Map(a.chunks.map((c) => [c.id, c]));
  const byChunk: Record<string, TerrainStats> = {};
  const nmtMoved: Record<string, number> = {};
  const all: MovedPoint[] = [];
  let area = 0;
  for (const cb of b.chunks) {
    const ca = byId.get(cb.id);
    if (!ca || !overlaps(cb.bounds, window)) continue;
    const moved: MovedPoint[] = [];
    let nmt = 0;
    const g = cb.shaped;
    for (let r = 0; r < g.rows; r++)
      for (let c = 0; c < g.cols; c++) {
        const [x, z] = [g.originX + c * g.cell, g.originZ + r * g.cell];
        if (!inRect(window, x, z)) continue;
        const after = g.heights[r * g.cols + c] ?? 0;
        const before = heightAt(ca.shaped, x, z);
        const ground = heightAt(cb.nmt, x, z);
        if (Math.abs(heightAt(ca.nmt, x, z) - ground) > MOVE_EPS) nmt++;
        if (Math.abs(after - before) > MOVE_EPS) moved.push({ chunk: cb.id, x: r3(x), z: r3(z), before: r3(before), after: r3(after), nmt: r3(ground) });
      }
    if (nmt) nmtMoved[cb.id] = nmt;
    if (!moved.length) continue;
    byChunk[cb.id] = terrainStats(moved, moved.length * g.cell * g.cell);
    area += moved.length * g.cell * g.cell;
    all.push(...moved);
  }
  const ids = (s: MapSnapshot) => new Set(s.chunks.filter((c) => overlaps(c.bounds, window)).map((c) => c.id));
  const [ia, ib] = [ids(a), ids(b)];
  const largest = [...all].sort((p, q) => Math.abs(q.after - q.before) - Math.abs(p.after - p.before)).slice(0, 10);
  return { total: terrainStats(all, area), byChunk, nmtMoved, onlyBefore: [...ia].filter((i) => !ib.has(i)), onlyAfter: [...ib].filter((i) => !ia.has(i)), largest };
};

export interface DeckChange {
  readonly flight: boolean;
  readonly before: SnapDeck;
  readonly after: SnapDeck;
  /** How far each end moved (m) and the heights' change at them (m). */
  readonly moveA: number;
  readonly moveB: number;
  readonly dya: number;
  readonly dyb: number;
  readonly dArea: number;
}

export interface DeckDiff {
  readonly changed: readonly DeckChange[];
  readonly added: readonly SnapDeck[];
  readonly removed: readonly SnapDeck[];
  readonly unchanged: number;
}

/** Two decks are one piece when their outlines' boxes overlap by at least this IoU. */
export const DECK_MATCH = 0.3;

const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.z - q.z);
const boxArea = (r: Rect) => Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxZ - r.minZ);
export const boxIou = (p: Rect, q: Rect): number => {
  const inter = boxArea({ minX: Math.max(p.minX, q.minX), minZ: Math.max(p.minZ, q.minZ), maxX: Math.min(p.maxX, q.maxX), maxZ: Math.min(p.maxZ, q.maxZ) });
  const union = boxArea(p) + boxArea(q) - inter;
  return union > 0 ? inter / union : 0;
};

/** The deck `d` read with its ends in the order of `like` (a deck may swap them). */
const aligned = (d: SnapDeck, like: SnapDeck): SnapDeck =>
  Math.max(dist(d.a, like.a), dist(d.b, like.b)) <= Math.max(dist(d.b, like.a), dist(d.a, like.b)) ? d : { ...d, a: d.b, b: d.a, ya: d.yb, yb: d.ya };

/**
 * The decks of `b` against `a` in `window`: a piece matched by its outline (the boxes' IoU, the
 * best first, a bridge's axis may move while its pieces stay), then its axis' ends and heights compared.
 */
export const deckDiff = (a: MapSnapshot, b: MapSnapshot, window: Rect): DeckDiff => {
  const da = a.decks.filter((d) => overlaps(d.box, window));
  const db = b.decks.filter((d) => overlaps(d.box, window));
  const pairs: { i: number; j: number; d: number }[] = [];
  da.forEach((p, i) =>
    db.forEach((q, j) => {
      if (p.flight !== q.flight) return;
      const d = 1 - boxIou(p.box, q.box);
      if (d <= 1 - DECK_MATCH) pairs.push({ i, j, d });
    }),
  );
  pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
  const [usedA, usedB] = [new Set<number>(), new Set<number>()];
  const changed: DeckChange[] = [];
  let unchanged = 0;
  for (const { i, j } of pairs) {
    if (usedA.has(i) || usedB.has(j)) continue;
    usedA.add(i);
    usedB.add(j);
    const before = da[i]!;
    const after = aligned(db[j]!, before);
    const c = { flight: before.flight, before, after, moveA: r3(dist(before.a, after.a)), moveB: r3(dist(before.b, after.b)), dya: r3(after.ya - before.ya), dyb: r3(after.yb - before.yb), dArea: round1(after.area - before.area) };
    if (Math.max(c.moveA, c.moveB, Math.abs(c.dya), Math.abs(c.dyb)) > MOVE_EPS || Math.abs(c.dArea) >= 0.1) changed.push(c);
    else unchanged++;
  }
  return { changed, added: db.filter((_, j) => !usedB.has(j)), removed: da.filter((_, i) => !usedA.has(i)), unchanged };
};
