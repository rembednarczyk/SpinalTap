/**
 * Holes in a ground ring (G-421): the ground output has outlines only, so a ring with holes is laid
 * as one ring that runs out to each hole along a seam of no width, round it the other way and
 * back (the way ear clipping takes holes). Read even-odd, as the simulation and the renderer's
 * triangulation read it, it covers the ring less its holes.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Pt, ccw, pointInRing, signedArea } from "./geometry.ts";

/** The least a hole keeps off the ring it is cut out of and off the other holes (m): one that touches them is no hole the seam can reach. */
const CLEAR = 0.3;

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const segDist = (p: Pt, a: Pt, b: Pt): number => segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z);

/** Whether segments a-b and c-d meet anywhere but at a shared end. */
const segmentsMeet = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const same = (p: Pt, q: Pt) => p.x === q.x && p.z === q.z;
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false;
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return segDist(c, a, b) < 1e-6 || segDist(d, a, b) < 1e-6 || segDist(a, c, d) < 1e-6 || segDist(b, c, d) < 1e-6;
};

const edges = (ring: readonly Pt[]): [Pt, Pt][] => ring.map((p, i) => [p, ring[(i + 1) % ring.length]!]);

/** Whether `hole` lies inside `ring` at least `CLEAR` off its edges. */
export const holeFits = (ring: readonly Pt[], hole: readonly Pt[]): boolean =>
  hole.length >= 3 && hole.every((p) => pointInRing(p, ring)) && edges(ring).every(([a, b]) => hole.every((p) => segDist(p, a, b) >= CLEAR)) && ring.every((p) => !pointInRing(p, hole) && edges(hole).every(([a, b]) => segDist(p, a, b) >= CLEAR));

/** Whether holes `a` and `b` lie apart, at least `CLEAR` from each other. */
export const holesApart = (a: readonly Pt[], b: readonly Pt[]): boolean =>
  !a.some((p) => pointInRing(p, b)) && !b.some((p) => pointInRing(p, a)) && edges(a).every(([p, q]) => b.every((r) => segDist(r, p, q) >= CLEAR)) && edges(b).every(([p, q]) => a.every((r) => segDist(r, p, q) >= CLEAR));

/** How far off a ring's edge a corner of a lawn may lie and still be on it (m): both are rounded to 0.1 m. */
const ON_EDGE = 0.08;

/**
 * `ring` (counter-clockwise) less `lawn`, a counter-clockwise ring inside it whose outline runs
 * along the ring's for one stretch (G-427: Plac Czechowicza's lawn lies along three edges of the
 * square, so it fits no hole): the stretch is replaced by the rest of the lawn's outline, the
 * lawn becoming a notch in the ring's edge. The lawn's corners on the ring's edges are made its
 * corners first. Null when the outlines share no edge or more than one stretch (a lawn across
 * the ring would part it), or when the lawn leaves the ring.
 */
export const notchOut = (ring: readonly Pt[], lawn: readonly Pt[]): Pt[] | null => {
  const key = (p: Pt) => `${p.x},${p.z}`;
  const out: Pt[] = [];
  for (const [a, b] of edges(ring)) {
    out.push(a);
    const on = lawn.filter((p) => key(p) !== key(a) && key(p) !== key(b) && segDist(p, a, b) < ON_EDGE);
    on.sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z));
    out.push(...on);
  }
  const at = new Map<string, number>();
  out.forEach((p, i) => at.set(key(p), at.has(key(p)) ? -1 : i));
  const n = lawn.length;
  // The lawn's edges that are the ring's, in the same direction: both lie on their left.
  const shared = lawn.map((p, i) => {
    const [j, k] = [at.get(key(p)) ?? -1, at.get(key(lawn[(i + 1) % n]!)) ?? -1];
    return j >= 0 && k === (j + 1) % out.length;
  });
  const starts = shared.flatMap((s, i) => (s && !shared[(i + n - 1) % n] ? [i] : []));
  if (starts.length !== 1) return null;
  let end = starts[0]!;
  while (shared[end % n]) end++;
  // From the stretch's last corner on round the ring to its first, then back along the lawn's rest.
  const [first, last] = [at.get(key(lawn[starts[0]!]!))!, at.get(key(lawn[end % n]!))!];
  const rest = Array.from({ length: n - 1 - (end - starts[0]!) }, (_, k) => lawn[(end + 1 + k) % n]!).reverse();
  const around = Array.from({ length: (first - last + out.length) % out.length + 1 }, (_, k) => out[(last + k) % out.length]!);
  const notched = [...around, ...rest];
  // The lawn's rest runs inside the ring and crosses none of its edges.
  const fresh = edges(notched).slice(around.length - 1);
  const inside = rest.every((p) => pointInRing(p, ring)) && fresh.every(([a, b]) => edges(notched).every(([c, d]) => (a === c && b === d) || !segmentsMeet(a, b, c, d)));
  return inside && signedArea(notched) > 0 ? notched : null;
};

/**
 * `ring` (counter-clockwise) less `holes`, which lie inside it and apart (`holeFits`, `holesApart`):
 * each joined to the ring by the shortest seam that crosses no edge of it or of a hole. A hole no
 * seam reaches stays covered.
 */
export const cutHoles = (ring: readonly Pt[], holes: readonly (readonly Pt[])[]): Pt[] => {
  let out = ccw(ring);
  const left = holes.map((h) => ccw(h).reverse());
  while (left.length > 0) {
    const hole = left.shift()!;
    const blockers = [...edges(out), ...edges(hole), ...left.flatMap(edges)];
    // Not from a corner a seam already leaves twice: which of its two places in the ring the new
    // seam joins decides on which side of the old one it runs, and the wrong one crosses it.
    const seen = new Map<string, number>();
    for (const r of out) seen.set(`${r.x},${r.z}`, (seen.get(`${r.x},${r.z}`) ?? 0) + 1);
    const pairs: { i: number; j: number; d: number }[] = [];
    hole.forEach((h, i) => out.forEach((r, j) => seen.get(`${r.x},${r.z}`) === 1 && pairs.push({ i, j, d: Math.hypot(h.x - r.x, h.z - r.z) })));
    pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
    const seam = pairs.find(({ i, j }) => {
      const [h, r] = [hole[i]!, out[j]!];
      const mid = { x: (h.x + r.x) / 2, z: (h.z + r.z) / 2 };
      return pointInRing(mid, out) && !pointInRing(mid, hole) && blockers.every(([a, b]) => !segmentsMeet(h, r, a, b));
    });
    if (!seam) continue;
    const { i, j } = seam;
    out = [...out.slice(0, j + 1), ...hole.slice(i), ...hole.slice(0, i + 1), ...out.slice(j)];
  }
  return signedArea(out) > 0 ? out : ccw(ring);
};
