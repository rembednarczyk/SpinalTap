/**
 * One-to-one matching of footprints by overlap (ADR-0077): every pair of a game building and a
 * GUGiK building whose outlines overlap gets its IoU; pairs are taken greedily from the best
 * down, each building at most once, while the IoU is at least `MIN_IOU`. Outlines split
 * differently (one OSM building over three BDOT10k ones) stay unmatched; `coveredShare` tells
 * those apart from buildings missing on one side.
 */
import { BoxIndex, type Footprint, footprint, iou } from "./overlap.ts";
import { type Pt } from "../../osm-import/src/geometry.ts";

export const MIN_IOU = 0.5;

export interface Keyed {
  readonly id: string;
  readonly ring: readonly Pt[];
}

export interface Pair {
  readonly a: string;
  readonly b: string;
  readonly iou: number;
}

export interface Matching {
  /** `a` id → its partner in `b` with the IoU. */
  readonly byA: ReadonlyMap<string, Pair>;
  readonly byB: ReadonlyMap<string, Pair>;
}

type Item = Footprint & { readonly id: string };

const items = (xs: readonly Keyed[]): Item[] => xs.filter((x) => x.ring.length >= 3).map((x) => ({ id: x.id, ...footprint(x.ring) }));

export const matchFootprints = (as: readonly Keyed[], bs: readonly Keyed[], min = MIN_IOU): Matching => {
  const bIndex = new BoxIndex(items(bs));
  const pairs: Pair[] = [];
  for (const a of items(as)) for (const b of bIndex.near(a.box)) {
    const v = iou(a, b);
    if (v >= min) pairs.push({ a: a.id, b: b.id, iou: v });
  }
  pairs.sort((p, q) => q.iou - p.iou || p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
  const byA = new Map<string, Pair>();
  const byB = new Map<string, Pair>();
  for (const p of pairs) {
    if (byA.has(p.a) || byB.has(p.b)) continue;
    byA.set(p.a, p);
    byB.set(p.b, p);
  }
  return { byA, byB };
};

/** Footprints of `xs` as an index for coverage queries. */
export const footprintIndex = (xs: readonly Keyed[]) => new BoxIndex(items(xs));
