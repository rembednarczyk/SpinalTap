/**
 * The asphalt a carriageway of estimated width is widened by to its paving (G-570, `kerbFills`),
 * laid in a chunk as pieces of their own along the carriageway's piece there, as simplified. Its
 * own ring is left as the map gives it: widened, the ring's new vertices changed which of its others
 * a chunk's simplification keeps on the edges not widened, and the outline moved there by up to
 * the 0.3 m it may stray, under the cars parked along it, the grates at its kerb and the lawns
 * beside it. A widening piece shares the carriageway piece's edge to the vertex: neither a seam
 * between them nor an overlap of one surface in one plane (`paving-coplanar`).
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Pt, type Rect, ccw, clipRingToRect, r1, rectsOverlap, ringBounds, selfIntersects, signedArea } from "./geometry.ts";

/** One stretch of an edge widened: its points on the edge as the map's width lays it, from where the asphalt steps out to where it is back, and the asphalt's new edge. */
export interface WidenRun {
  readonly inner: readonly Pt[];
  readonly outer: readonly Pt[];
}

/** The smallest widening piece laid (m²): below it, float noise at a chunk's edge. */
const MIN_AREA = 0.01;

/** How near a vertex of the carriageway's piece a run's end is taken to be at it (m): within the outlines' rounding. */
const SNAP = 0.1;

/** A point on a carriageway's edge kept to 0.1 mm, not to the 0.1 m grid of the outlines: on the 0.1 m grid it would stray off the edge's segment and part the two pieces by a sliver. */
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;

/** The nearest point of the ring's outline to `p`: on the segment from vertex `i`, its distance. */
const nearestOn = (ring: readonly Pt[], p: Pt): { i: number; at: Pt; d: number } => {
  let best = { i: 0, at: ring[0]!, d: Infinity };
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const l2 = dx * dx + dz * dz;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    const at = { x: a.x + dx * t, z: a.z + dz * t };
    const d = Math.hypot(at.x - p.x, at.z - p.z);
    if (d >= best.d) continue;
    // A vertex this near is the end itself (a corner of the carriageway's end, as rounded): a point beside it, its piece folded over the corner.
    const len = Math.sqrt(l2);
    best = { i, at: (1 - t) * len < SNAP ? b : t * len < SNAP ? a : { x: r4(at.x), z: r4(at.z) }, d };
  }
  return best;
};

/** The ring's outline from `from` (on the segment from vertex `i`) to `to` (from vertex `j`), forward along the ring or back. */
const pathAlong = (ring: readonly Pt[], from: { i: number; at: Pt }, to: { i: number; at: Pt }, forward: boolean): Pt[] => {
  const n = ring.length;
  const out = [from.at];
  const push = (p: Pt) => {
    const last = out[out.length - 1]!;
    if (last.x !== p.x || last.z !== p.z) out.push(p);
  };
  const along = (p: Pt, i: number) => {
    const [a, b] = [ring[i]!, ring[(i + 1) % n]!];
    return Math.hypot(p.x - a.x, p.z - a.z) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
  };
  if (forward) {
    if (from.i !== to.i || along(to.at, to.i) < along(from.at, from.i)) for (let k = 1; k <= n; k++) {
      push(ring[(from.i + k) % n]!);
      if ((from.i + k) % n === to.i) break;
    }
  } else if (from.i !== to.i || along(to.at, to.i) > along(from.at, from.i)) {
    for (let k = 0; k < n; k++) {
      const v = (from.i - k + n) % n;
      push(ring[v]!);
      if ((v - 1 + n) % n === to.i) break;
    }
  }
  push(to.at);
  return out;
};

/** How far the path's points stray from the polyline `line` at the most (m). */
const strays = (path: readonly Pt[], line: readonly Pt[]): number => {
  let worst = 0;
  for (const p of path) {
    let d = Infinity;
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i]!, line[i + 1]!];
      d = Math.min(d, segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z));
    }
    worst = Math.max(worst, d);
  }
  return worst;
};

/**
 * The widening pieces of a carriageway in the chunk `rect`, its piece there `ring` (as the chunk
 * lays it: clipped, simplified, rounded): each run's new edge closed along the piece's outline
 * between the nearest points to the run's ends, the way along the run's own edge, not around the
 * carriageway. Where the carriageway has no piece in the chunk, the run as it is, clipped.
 */
export const widenPieces = (ring: readonly Pt[] | null, runs: readonly WidenRun[], rect: Rect): Pt[][] => {
  const out: Pt[][] = [];
  for (const run of runs) {
    if (run.inner.length < 1 || run.outer.length < 1 || !rectsOverlap(ringBounds([...run.inner, ...run.outer]), rect)) continue;
    const outer = run.outer.map((p) => ({ x: r1(p.x), z: r1(p.z) })).reverse();
    let inner: Pt[] = [...run.inner];
    if (ring && ring.length >= 3) {
      const [from, to] = [nearestOn(ring, run.inner[0]!), nearestOn(ring, run.inner[run.inner.length - 1]!)];
      const [fw, bw] = [pathAlong(ring, from, to, true), pathAlong(ring, from, to, false)];
      inner = strays(fw, run.inner) <= strays(bw, run.inner) ? fw : bw;
    }
    const clipped = clipRingToRect([...inner, ...outer], rect).map((p) => ({ x: r4(p.x), z: r4(p.z) }));
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) < MIN_AREA || selfIntersects(clipped)) continue;
    out.push(ccw(clipped));
  }
  return out;
};
