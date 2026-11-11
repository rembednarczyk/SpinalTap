/**
 * The numbers of the GUGiK report (ADR-0077) for one set of game buildings against the GUGiK
 * extracts: matching both ways, heights against LoD1, roofs against LoD2, BDOT10k barrier lines
 * against the OSM ones. Pure functions; `report.ts` feeds them a cell at a time.
 *
 * Heights: LoD1 2024 `measuredHeight` is a prism's height that lies between the eaves and the
 * ridge (over the city's 31 358 buildings with both sets: median 1.0 m over the LoD2 eaves and
 * 1.0 m under the LoD2 ridge), so the game's comparable height is the middle of its roof,
 * `height + roof / 2` (or of its highest lifted part: a gate's tower); the eaves (`height`) and the top (`height + roof`) are given as well.
 */
import { clipLineToRect, lineLength, pointAlong, type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { ROOF_TYPES } from "./citygml.ts";
import { type BdotLine, type Lod1Building, type Lod2Building } from "./extracts.ts";
import { type GameBuilding, type OsmBarrier } from "./game.ts";
import { footprintIndex, type Matching } from "./match.ts";
import { coveredShare, distToLine, footprint } from "./overlap.ts";

/** Covered at least this much by the other side: present there, but split differently. */
export const COVERED = 0.5;
/** A height difference worth a look, metres. */
export const BIG_DIFF = 3;
/** The buffer around OSM barrier lines, metres, and the share of a BDOT10k line inside it for a counterpart. */
export const BARRIER_BUFFER = 2;
export const BARRIER_SHARE = 0.5;

const quantile = (xs: readonly number[], p: number): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = p * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round((s[lo]! + (s[hi]! - s[lo]!) * (i - lo)) * 10) / 10;
};

export interface Side {
  readonly total: number;
  readonly matched: number;
  /** Unmatched but covered ≥ 50 % by the other side's buildings (split or drawn differently). */
  readonly unmatchedCovered: number;
  /** Unmatched and mostly not covered: missing on the other side. */
  readonly unmatchedMissing: number;
}

const side = (xs: readonly { id: string; ring: readonly Pt[] }[], matched: ReadonlyMap<string, unknown>, others: readonly { id: string; ring: readonly Pt[] }[]): Side & { missing: string[] } => {
  const index = footprintIndex(others);
  let covered = 0;
  const missing: string[] = [];
  for (const x of xs) {
    if (matched.has(x.id)) continue;
    const f = footprint(x.ring);
    if (coveredShare(f, index.near(f.box)) >= COVERED) covered++;
    else missing.push(x.id);
  }
  return { total: xs.length, matched: xs.filter((x) => matched.has(x.id)).length, unmatchedCovered: covered, unmatchedMissing: missing.length, missing };
};

/** Game buildings against LoD1, both ways (`lod1` already cut to the same cell). */
export const buildingSides = (game: readonly GameBuilding[], lod1: readonly Lod1Building[], m: Matching) => ({
  game: side(game, m.byA, lod1),
  lod1: side(lod1, m.byB, game),
});

export interface HeightRow {
  readonly id: string;
  readonly cell: string;
  readonly name?: string;
  readonly address?: string;
  readonly game: number;
  readonly lod1: number;
  readonly diff: number;
  readonly iou: number;
  readonly source: string;
}

/** Game middle-of-roof height (its parts' included) minus LoD1 `measuredHeight` for every matched building. */
export const heightRows = (game: readonly GameBuilding[], lod1: ReadonlyMap<string, Lod1Building>, m: Matching, label: (b: GameBuilding) => { name?: string; address?: string }): HeightRow[] =>
  game.flatMap((b) => {
    const p = m.byA.get(b.id);
    const r = p && lod1.get(p.b);
    if (!p || !r) return [];
    const g = Math.max(b.height + b.roof / 2, b.partsMid ?? 0);
    return [{ id: b.id, cell: b.cell, ...label(b), game: Math.round(g * 10) / 10, lod1: r.height, diff: Math.round((g - r.height) * 10) / 10, iou: Math.round(p.iou * 100) / 100, source: b.source }];
  });

export const heightStats = (rows: readonly HeightRow[], game: readonly GameBuilding[], lod1: ReadonlyMap<string, Lod1Building>, m: Matching) => {
  const d = rows.map((r) => r.diff);
  const abs = d.map(Math.abs);
  const eaves = game.flatMap((b) => {
    const p = m.byA.get(b.id);
    const r = p && lod1.get(p.b);
    return r ? [b.height - r.height] : [];
  });
  const top = game.flatMap((b) => {
    const p = m.byA.get(b.id);
    const r = p && lod1.get(p.b);
    return r ? [b.height + b.roof - r.height] : [];
  });
  const bySource: Record<string, { n: number; median: number | null; over3: number }> = {};
  for (const s of new Set(rows.map((r) => r.source))) {
    const ds = rows.filter((r) => r.source === s).map((r) => r.diff);
    bySource[s] = { n: ds.length, median: quantile(ds, 0.5), over3: ds.filter((v) => Math.abs(v) > BIG_DIFF).length };
  }
  return {
    n: d.length,
    median: quantile(d, 0.5),
    p10: quantile(d, 0.1),
    p90: quantile(d, 0.9),
    absP90: quantile(abs, 0.9),
    over3: abs.filter((v) => v > BIG_DIFF).length,
    medianEavesMinusLod1: quantile(eaves, 0.5),
    medianTopMinusLod1: quantile(top, 0.5),
    bySource,
  };
};

const shapeOf = (code: number | undefined) => (code === undefined ? "none" : (ROOF_TYPES[code] ?? String(code)));

/** Roofs: OSM `roof:shape` in the game against the LoD2 roof type of the matched building. */
export const roofStats = (game: readonly GameBuilding[], lod2: ReadonlyMap<string, Lod2Building>, m2: Matching) => {
  const lod2Types: Record<string, number> = {};
  const wouldGet: Record<string, number> = {};
  const agree: Record<string, number> = {};
  let withShape = 0;
  let matched = 0;
  let newShape = 0;
  let same = 0;
  let both = 0;
  for (const b of game) {
    if (b.roofShape) withShape++;
    const p = m2.byA.get(b.id);
    const r = p && lod2.get(p.b);
    if (!r) continue;
    matched++;
    const t = shapeOf(r.roofType);
    lod2Types[t] = (lod2Types[t] ?? 0) + 1;
    const usable = t !== "combination" && t !== "none";
    if (!b.roofShape && usable) {
      newShape++;
      wouldGet[t] = (wouldGet[t] ?? 0) + 1;
    }
    if (b.roofShape && usable) {
      both++;
      if (b.roofShape === t) same++;
      const k = `${b.roofShape}→${t}`;
      agree[k] = (agree[k] ?? 0) + 1;
    }
  }
  return { game: game.length, withRoofShape: withShape, matchedLod2: matched, lod2Types, wouldGetShape: newShape, wouldGetTypes: wouldGet, bothKnown: both, sameShape: same, osmToLod2: agree };
};

const clipped = (line: readonly Pt[], r: Rect) => clipLineToRect(line, r).filter((l) => l.length >= 2);

/** Barriers: BDOT10k lines and OSM `barrier=*` ways inside `r`, lengths and BDOT lines without an OSM counterpart. */
export const barrierStats = (bdot: readonly BdotLine[], osm: readonly OsmBarrier[], r: Rect) => {
  const bdotLength: Record<string, number> = {};
  const osmLength: Record<string, number> = {};
  const osmLines = osm.flatMap((o) => clipped(o.line, { minX: r.minX - 5, minZ: r.minZ - 5, maxX: r.maxX + 5, maxZ: r.maxZ + 5 }).map((l) => ({ kind: o.kind, l })));
  for (const o of osm)
    for (const l of clipped(o.line, r)) osmLength[o.kind] = Math.round((osmLength[o.kind] ?? 0) + lineLength(l));
  const without: { id: string; kind: string; length: number; share: number }[] = [];
  let lines = 0;
  for (const b of bdot) {
    const pieces = clipped(b.line, r);
    const len = pieces.reduce((s, l) => s + lineLength(l), 0);
    if (len < 0.5) continue;
    lines++;
    bdotLength[b.kind] = Math.round((bdotLength[b.kind] ?? 0) + len);
    let near = 0;
    let all = 0;
    for (const l of pieces)
      for (let s = 0.5; s < lineLength(l); s += 1) {
        const p = pointAlong(l, s);
        all++;
        if (osmLines.some((o) => distToLine(p, o.l) <= BARRIER_BUFFER)) near++;
      }
    const share = all ? near / all : 0;
    if (share < BARRIER_SHARE) without.push({ id: b.id, kind: b.kind, length: Math.round(len), share: Math.round(share * 100) / 100 });
  }
  return { bdotLines: lines, bdotLength, osmLength, bdotWithoutOsm: without.length, bdotWithoutOsmLength: without.reduce((s, w) => s + w.length, 0), without };
};
