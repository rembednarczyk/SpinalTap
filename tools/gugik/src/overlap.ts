/**
 * Footprint overlap for matching GUGiK buildings to the game's (ADR-0077): intersection over
 * union of two simple polygons, measured on a sample grid (concave outlines, courtyards and
 * near-touching neighbours all come out right, to well under 1 % at the grid used), and the
 * distance from a point to a polyline for the barrier buffer.
 */
import { pointInRing, type Pt, type Rect, ringBounds, signedArea } from "../../osm-import/src/geometry.ts";

export interface Footprint {
  readonly ring: readonly Pt[];
  readonly box: Rect;
  readonly area: number;
}

export const footprint = (ring: readonly Pt[]): Footprint => ({ ring, box: ringBounds(ring), area: Math.abs(signedArea(ring)) });

const boxesOverlap = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

/** Sample step for a pair: 0.25 m, coarser for big outlines so a pair costs at most ~40 000 samples. */
const stepFor = (box: Rect) => Math.max(0.25, Math.sqrt(((box.maxX - box.minX) * (box.maxZ - box.minZ)) / 40000));

/**
 * The sampled intersection overruns the true one by its grid's error, well under this share of
 * the bound; a pair is skipped only below `min` by more, so the pairs kept sample as before.
 */
const BOUND_SLACK = 1.1;

/** Where a ring's edges cross the line at `z`, sorted: the crossings of `pointInRing`'s ray. */
const crossings = (ring: readonly Pt[], z: number): number[] => {
  const out: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > z !== b.z > z) out.push(((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x);
  }
  return out.sort((u, v) => u - v);
};

/** Samples along one side of a box at `step`, as the sampling loops take them. */
const samples = (lo: number, hi: number, step: number): number => {
  let n = 0;
  for (let v = lo + step / 2; v < hi; v += step) n++;
  return n;
};

/**
 * Intersection over union of two footprints, 0 when their boxes do not overlap. With `min`, 0 also
 * for a pair that cannot reach it (the match wants no value under it): before sampling when the
 * intersection, at most the smaller area and the common box, is too small, and while sampling once
 * the samples left could not make up what is missing.
 */
export const iou = (a: Footprint, b: Footprint, min = 0): number => {
  if (!boxesOverlap(a.box, b.box)) return 0;
  const box = { minX: Math.max(a.box.minX, b.box.minX), maxX: Math.min(a.box.maxX, b.box.maxX), minZ: Math.max(a.box.minZ, b.box.minZ), maxZ: Math.min(a.box.maxZ, b.box.maxZ) };
  const most = Math.min(a.area, b.area, (box.maxX - box.minX) * (box.maxZ - box.minZ)) * BOUND_SLACK;
  if (min > 0 && most < min * (a.area + b.area - most)) return 0;
  const step = stepFor(box);
  // IoU ≥ min takes an intersection of min / (1 + min) of the two areas; a hair under it, for the rounding.
  const need = min > 0 ? ((min * (a.area + b.area)) / (1 + min) / (step * step)) * (1 - 1e-9) : 0;
  const row = samples(box.minX, box.maxX, step);
  let left = samples(box.minZ, box.maxZ, step) * row;
  let both = 0;
  // Row by row: where each ring's edges cross the row, as `pointInRing` reckons it, so a sample is
  // inside a ring when an odd number of crossings lies past it. The same samples, the same count.
  for (let z = box.minZ + step / 2; z < box.maxZ; z += step) {
    const ca = crossings(a.ring, z);
    const cb = crossings(b.ring, z);
    let ia = 0;
    let ib = 0;
    for (let x = box.minX + step / 2; x < box.maxX; x += step) {
      while (ia < ca.length && ca[ia]! <= x) ia++;
      while (ib < cb.length && cb[ib]! <= x) ib++;
      if ((ca.length - ia) % 2 === 1 && (cb.length - ib) % 2 === 1) both++;
    }
    left -= row;
    if (both + left < need) return 0;
  }
  const inter = both * step * step;
  const union = a.area + b.area - inter;
  return union > 0 ? Math.min(1, inter / union) : 0;
};

/** Share of `a`'s area inside any of `others` (0–1), on the same sample grid. */
export const coveredShare = (a: Footprint, others: readonly Footprint[]): number => {
  const near = others.filter((o) => boxesOverlap(a.box, o.box));
  if (near.length === 0 || a.area === 0) return 0;
  const step = stepFor(a.box);
  let inA = 0;
  let covered = 0;
  for (let x = a.box.minX + step / 2; x < a.box.maxX; x += step)
    for (let z = a.box.minZ + step / 2; z < a.box.maxZ; z += step) {
      const p = { x, z };
      if (!pointInRing(p, a.ring)) continue;
      inA++;
      if (near.some((o) => pointInRing(p, o.ring))) covered++;
    }
  return inA ? covered / inA : 0;
};

/** Distance from `p` to the polyline `line`. */
export const distToLine = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return best;
};

/** A spatial bin index of boxes, 50 m cells. */
export class BoxIndex<T extends { readonly box: Rect }> {
  private readonly bins = new Map<string, T[]>();
  private readonly cell: number;
  constructor(items: readonly T[], cell = 50) {
    this.cell = cell;
    for (const it of items) for (const k of this.keys(it.box)) (this.bins.get(k) ?? this.bins.set(k, []).get(k)!).push(it);
  }
  private *keys(b: Rect) {
    for (let i = Math.floor(b.minX / this.cell); i <= Math.floor(b.maxX / this.cell); i++)
      for (let j = Math.floor(b.minZ / this.cell); j <= Math.floor(b.maxZ / this.cell); j++) yield `${i},${j}`;
  }
  near(b: Rect, pad = 0): T[] {
    const q = { minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad };
    const out = new Set<T>();
    for (const k of this.keys(q)) for (const it of this.bins.get(k) ?? []) if (boxesOverlap(q, it.box)) out.add(it);
    return [...out];
  }
}
