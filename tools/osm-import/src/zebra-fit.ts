/**
 * The zebras fitted to the carriageway they cross (G-836): a rectangle square to the street's axis
 * where the crossing meets it, from kerb to kerb of the asphalt as laid (widened to the paving by
 * `kerbFills` too), its centre where the crossing is. A zebra about its node with the nearest
 * segment's axis and the width by type, or the buffer of a crossing way as the map draws it, stood
 * askew to the street, short of its widened kerbs or out over the sidewalk past them, its stripes
 * and edge lines with it (the user's report of 15.11).
 */
import { type Line } from "./features.ts";
import { type Pt, type Rect, lineLength, pointAlong, ringBounds } from "./geometry.ts";
import { type Band, CROSSING_ALONG, isCarriageway, pathWidth, roadFoot } from "./ground.ts";
import { KERB_REACH, type kerbFills } from "./kerb-fill.ts";
import { geoToWorld } from "./project.ts";
import { RingBins } from "./ring-bins.ts";

/** Where a zebra crosses its street, and how far it runs along it (m). */
export interface ZebraSpot {
  readonly at: Pt;
  readonly along: number;
}

/** The step of the march across the street (m), and halvings of the last one: the kerb within about 6 mm. */
const STEP = 0.1;
const REFINE = 4;
/** How far a zebra may reach past the carriageway's width by type (m): to the paving `kerbFills` widens it to, and its seam. */
const REACH = KERB_REACH + 0.1;
/** Half the stretch of the street's axis its direction at a zebra is read over (m): a bend at the node is no skew. */
const TANGENT = 2;
/** Points of a crossing way on the axes nearer than this are one crossing (m). */
const SAME = 2;
/** How far along the street a seam across it is bridged (m): two bands' ends a few centimetres apart or lapping. */
const SEAM = 0.3;
/** How near its sides, of half its run along the street, a zebra's reach is read too. */
const SIDES = 0.8;
/** The narrowest zebra laid across (m): less is a sliver of asphalt, and the band stays as it was. */
const MIN_ACROSS = 2;

/** Where a crossing way's line meets the axes of the carriageways, in its order, one point a crossing. */
export const wayCrossings = (way: readonly Pt[], roads: readonly Line[]): Pt[] => {
  const out: { s: number; p: Pt }[] = [];
  let s0 = 0;
  for (let i = 0; i + 1 < way.length; i++) {
    const a = way[i]!;
    const b = way[i + 1]!;
    const [ex, ez] = [b.x - a.x, b.z - a.z];
    for (const l of roads) {
      for (let j = 0; j + 1 < l.line.length; j++) {
        const c = l.line[j]!;
        const d = l.line[j + 1]!;
        const [fx, fz] = [d.x - c.x, d.z - c.z];
        const den = ex * fz - ez * fx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((c.x - a.x) * fz - (c.z - a.z) * fx) / den;
        const u = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push({ s: s0 + t * Math.hypot(ex, ez), p: { x: a.x + ex * t, z: a.z + ez * t } });
      }
    }
    s0 += Math.hypot(ex, ez);
  }
  out.sort((p, q) => p.s - q.s);
  const kept: { s: number; p: Pt }[] = [];
  for (const o of out) if (!kept.some((k) => Math.hypot(k.p.x - o.p.x, k.p.z - o.p.z) < SAME)) kept.push(o);
  return kept.map((k) => k.p);
};

/** Where the zebras of the crossing nodes (`n` and the id: `crossingBand`) and of the crossing `ways` cross the carriageways of `roads`. */
export const zebraSpots = (node: (id: number) => { readonly lat: number; readonly lon: number } | null, ways: readonly Line[], roads: readonly Line[]): ((z: Band) => ZebraSpot[] | null) => {
  const byId = new Map(ways.map((l) => [l.id, l]));
  const axes = roads.filter((l) => isCarriageway(l.tags));
  return (z) => {
    const n = z.source.startsWith("n") ? node(Number(z.source.slice(1))) : null;
    if (n) return [{ at: geoToWorld(n.lat, n.lon), along: CROSSING_ALONG }];
    const way = byId.get(z.source);
    return way ? wayCrossings(way.line, axes).map((p) => ({ at: p, along: Math.max(pathWidth(way.tags), CROSSING_ALONG) })) : null;
  };
};

/** The unit direction of a road's axis at a point of segment `i`, `k` along it: the chord `TANGENT` either side. */
const tangent = (line: readonly Pt[], i: number, k: number): Pt => {
  let s = 0;
  for (let j = 0; j < i; j++) s += Math.hypot(line[j + 1]!.x - line[j]!.x, line[j + 1]!.z - line[j]!.z);
  s += k * Math.hypot(line[i + 1]!.x - line[i]!.x, line[i + 1]!.z - line[i]!.z);
  const total = lineLength(line);
  const a = pointAlong(line, Math.max(0, s - TANGENT));
  const b = pointAlong(line, Math.min(total, s + TANGENT));
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
};

/** Where the asphalt ends along `c + u n` from `start` toward `dir` (|u| up to `cap`). */
const edge = (at: (u: number) => boolean, start: number, dir: 1 | -1, cap: number): number => {
  let u = start;
  while (Math.abs(u + dir * STEP) <= cap && at(u + dir * STEP)) u += dir * STEP;
  if (Math.abs(u + dir * STEP) > cap) return dir * cap;
  let [inside, outside] = [u, u + dir * STEP];
  for (let r = 0; r < REFINE; r++) {
    const mid = (inside + outside) / 2;
    if (at(mid)) inside = mid;
    else outside = mid;
  }
  return (inside + outside) / 2;
};

/**
 * The stretch `[lo, hi]` across the street (`n`, |u| up to `cap`) on the asphalt about `c`, null
 * when none is near: the narrowest of the lines through the zebra's middle and near its sides
 * (`sides` along the street), so no stripe of it lies past a kerb running askew to it.
 */
const across = (c: Pt, n: Pt, t: Pt, sides: number, cap: number, on: (p: Pt) => boolean): [number, number] | null => {
  // Asphalt either side along the street is asphalt too: the seam where two ways' bands end at the
  // crossing node runs across the street, often right under the zebra's middle; a kerb runs along it.
  const at = (v: number, u: number) => {
    const [x, z] = [c.x + t.x * v + n.x * u, c.z + t.z * v + n.z * u];
    return on({ x, z }) || (on({ x: x + t.x * SEAM, z: z + t.z * SEAM }) && on({ x: x - t.x * SEAM, z: z - t.z * SEAM }));
  };
  const line = (v: number) => (u: number) => at(v, u);
  const mid = line(0);
  const k = Math.floor(cap / STEP);
  // The run of the asphalt nearest the axis: a carriageway moved aside off its axis (ADR-0080 PR 10) starts off it.
  let start: number | null = null;
  for (let j = 0; j <= k && start === null; j++) for (const u of j === 0 ? [0] : [j * STEP, -j * STEP]) if (start === null && mid(u)) start = u;
  if (start === null) return null;
  let [lo, hi] = [edge(mid, start, -1, cap), edge(mid, start, 1, cap)];
  for (const v of [-sides, sides]) {
    const side = line(v);
    if (!side(start!)) continue;
    [lo, hi] = [Math.max(lo, edge(side, start!, -1, cap)), Math.min(hi, edge(side, start!, 1, cap))];
  }
  return [lo, hi];
};

type Boxed = { readonly box: Rect; readonly ring: readonly Pt[] };

/**
 * The zebras across the carriageways at `spots`, a band's each: a rectangle square to the street's
 * axis, `along` along it, from kerb to kerb of the `asphalt` rings, short of the kerb stones laid
 * over their edge (`over`, ranked over the asphalt: the kerb is where they start). Null where the
 * band stays as it is (no spot, or none across asphalt); a crossing way's other bands get none,
 * its first all.
 */
export const fitZebras = <B extends Band>(
  zebras: readonly B[],
  spots: (z: B) => readonly ZebraSpot[] | null,
  roads: readonly Line[],
  aside: (l: Line) => number,
  asphalt: readonly Boxed[],
  over: readonly Boxed[],
): (Pt[][] | null)[] => {
  const [bins, kerbs] = [new RingBins(asphalt), new RingBins(over)];
  const on = (p: Pt) => bins.holds(p.x, p.z) && !kerbs.holds(p.x, p.z);
  const done = new Set<string>();
  return zebras.map((z) => {
    const at = spots(z);
    if (!at || at.length === 0) return null;
    if (done.has(z.source)) return [];
    const rings = at.flatMap((s): Pt[][] => {
      const foot = roadFoot(s.at, roads, aside);
      if (!foot) return [];
      const t = tangent(foot.road.line, foot.i, foot.k);
      const n = { x: -t.z, z: t.x };
      const h = s.along / 2;
      const span = across(foot.foot, n, t, SIDES * h, foot.w / 2 + Math.abs(aside(foot.road)) + REACH, on);
      if (!span || span[1] - span[0] < MIN_ACROSS) return [];
      const corner = (a: number, u: number): Pt => ({ x: foot.foot.x + t.x * a + n.x * u, z: foot.foot.z + t.z * a + n.z * u });
      const [lo, hi] = span;
      return [[corner(-h, lo), corner(h, lo), corner(h, hi), corner(-h, hi)]];
    });
    if (rings.length === 0) return null;
    done.add(z.source);
    return rings;
  });
};

type Laid = Band & { readonly box: Rect };

/**
 * The ground's `bands` with each zebra fitted (`fitZebras`) in its place: across the carriageways
 * and their widened stretches (`kerbs`), short of the kerb stones laid over their edges. A crossing
 * way fitted keeps its band as a footway under them: the path from the pavement to the kerb, which
 * its zebra paved before (the asphalt, the zebra and the sidewalks rank over it, `partitionGround`).
 */
export const laidZebras = (
  bands: readonly Laid[],
  kerbs: ReturnType<typeof kerbFills>,
  spots: (z: Band) => readonly ZebraSpot[] | null,
  roads: readonly Line[],
  aside: (l: Line) => number,
): Laid[] => {
  const zebras = bands.filter((b) => b.surface === "crossing");
  // A joint's patch is asphalt too (`roundJoints`).
  const asphalt = [...bands.filter((b) => b.carriageway || (b.patch && (b.surface === "road" || b.surface === "cobble"))), ...[...kerbs.widened.values()].map((w) => ({ ring: w.ring, box: ringBounds(w.ring) }))];
  const stones = kerbs.fills.filter((f) => f.kerbStone).map((f) => ({ ring: f.ring, box: ringBounds(f.ring) }));
  const fitted = new Map(fitZebras(zebras, spots, roads, aside, asphalt, stones).map((rings, i) => [zebras[i]!, rings]));
  // A rectangle: a crossing way's ends at the footways it meets (`roundEnds`) are no ends of it.
  const laid = ({ roundEnds: _, ...b }: Laid, ring: Pt[]): Laid => ({ ...b, ring, box: ringBounds(ring) });
  return bands.flatMap((b) => {
    const rings = fitted.get(b);
    if (!rings) return [b];
    const path: Laid[] = b.source.startsWith("w") ? [{ ...b, surface: "footway" }] : [];
    return [...path, ...rings.map((ring) => laid(b, ring))];
  });
};
