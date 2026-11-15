/**
 * The zebras fitted to the carriageway they cross (G-836): a rectangle square to the street's axis
 * where the crossing meets it, from kerb to kerb of the asphalt as laid (widened to the paving by
 * `kerbFills` too), its centre where the crossing is. A zebra about its node with the nearest
 * segment's axis and the width by type, or the buffer of a crossing way as the map draws it, stood
 * askew to the street, short of its widened kerbs or out over the sidewalk past them, its stripes
 * and edge lines with it (the user's report of 15.11).
 */
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, lineLength, pointAlong, ringBounds } from "./geometry.ts";
import { type Band, CROSSING_ALONG, type RoadFoot, isCarriageway, pathWidth, roadFeet, roadFoot } from "./ground.ts";
import { type kerbFills } from "./kerb-fill.ts";
import { geoToWorld } from "./project.ts";
import { RingBins } from "./ring-bins.ts";

/**
 * Where a zebra crosses its street, how far it runs along it (m), the way of the foot path across
 * it there (unit), if the map has one, and whether that path is a crossing way (`footway=crossing`).
 */
export interface ZebraSpot {
  readonly at: Pt;
  readonly along: number;
  readonly path?: Pt;
  readonly way?: boolean;
}

/** The step of the march across the street (m), and halvings of the last one: the kerb within about 6 mm. */
const STEP = 0.1;
const REFINE = 4;
/** How far a zebra may reach each side of its street's axis (m): the asphalt as laid decides, to its kerb, not the width by type (a mouth of a road area, G-836). */
const FAR = 15;
/** How near a crossing the axes of a junction's carriageways are read for the one its foot path crosses square (m). */
const JUNCTION = 2;
/** The ways a zebra's foot path is read off (not a sidewalk along the street: `footway=sidewalk`). */
const FOOT_PATHS: ReadonlySet<string> = new Set(["footway", "path", "cycleway"]);
/** The cosine of the least angle between two axes of a junction (20 degrees). */
const BENT = Math.cos((20 * Math.PI) / 180);
/** How near a crossing node a foot path of the map runs through it (m). */
const ON_PATH = 1;
/** Half the stretch of the street's axis its direction at a zebra is read over (m): a bend at the node is no skew. */
const TANGENT = 2;
/** Points of a crossing way on the axes nearer than this are one crossing (m). */
const SAME = 2;
/** How far along the street a seam across it is bridged (m): two bands' ends a few centimetres apart or lapping. */
const SEAM = 0.3;
/** The narrowest zebra laid across (m): less is a sliver of asphalt, and the band stays as it was. */
const MIN_ACROSS = 2;

/** Where a crossing way's line meets the axes of the carriageways, in its order, one point a crossing, and the way's direction there. */
export const wayCrossings = (way: readonly Pt[], roads: readonly Line[]): { p: Pt; dir: Pt }[] => {
  const out: { s: number; p: Pt; dir: Pt }[] = [];
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
        const len = Math.hypot(ex, ez);
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push({ s: s0 + t * len, p: { x: a.x + ex * t, z: a.z + ez * t }, dir: { x: ex / len, z: ez / len } });
      }
    }
    s0 += Math.hypot(ex, ez);
  }
  out.sort((p, q) => p.s - q.s);
  const kept: { s: number; p: Pt; dir: Pt }[] = [];
  for (const o of out) if (!kept.some((k) => Math.hypot(k.p.x - o.p.x, k.p.z - o.p.z) < SAME)) kept.push(o);
  return kept.map(({ p, dir }) => ({ p, dir }));
};

/** The direction (unit) of the foot path of `paths` nearest `at`, within `ON_PATH`. */
const pathThrough = (at: Pt, paths: readonly Line[]): Pt | undefined => {
  let best: { d: number; dir: Pt } | undefined;
  for (const l of paths) {
    for (let i = 0; i + 1 < l.line.length; i++) {
      const [a, b] = [l.line[i]!, l.line[i + 1]!];
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const k = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.z - a.z) * dz) / (len * len)));
      const d = Math.hypot(a.x + dx * k - at.x, a.z + dz * k - at.z);
      if (d < ON_PATH && (!best || d < best.d)) best = { d, dir: { x: dx / len, z: dz / len } };
    }
  }
  return best?.dir;
};

/**
 * Where the zebras of the crossing nodes (`n` and the id: `crossingBand`) and of the crossing `ways`
 * cross the carriageways of `roads`, with the foot path across: the crossing way, or a foot path
 * of `lines` through the node.
 */
export const zebraSpots = (
  nodes: ReadonlyMap<number, { readonly lat: number; readonly lon: number }>,
  ways: readonly Line[],
  roads: readonly Line[],
  lines: readonly Line[],
): ((z: Band) => ZebraSpot[] | null) => {
  const paths = lines.filter((l) => FOOT_PATHS.has(l.tags.highway ?? "") && l.tags.footway !== "sidewalk" && l.tags.area !== "yes");
  const byId = new Map(ways.map((l) => [l.id, l]));
  const axes = roads.filter((l) => isCarriageway(l.tags));
  return (z) => {
    const n = z.source.startsWith("n") ? nodes.get(Number(z.source.slice(1))) : undefined;
    if (n) {
      const at = geoToWorld(n.lat, n.lon);
      const path = pathThrough(at, paths);
      return [{ at, along: CROSSING_ALONG, ...(path ? { path } : {}) }];
    }
    const way = byId.get(z.source);
    return way ? wayCrossings(way.line, axes).map(({ p, dir }) => ({ at: p, along: Math.max(pathWidth(way.tags), CROSSING_ALONG), path: dir, way: way.tags.footway === "crossing" })) : null;
  };
};

/**
 * The street a zebra at `s` crosses: the carriageway its foot path crosses most nearly square,
 * of those within `JUNCTION` (a junction's, or a node where its ways meet); the nearest within
 * 1 m where the map draws no path. Its foot and the direction the zebra lies square to: the
 * street's axis there (`tangent`), or at a crossing node's junction square to the path through it.
 */
const streetAt = (s: ZebraSpot, roads: readonly Line[], aside: (l: Line) => number): { foot: RoadFoot; t: Pt } | null => {
  const path = s.path;
  if (!path) {
    const foot = roadFoot(s.at, roads, aside);
    return foot ? { foot, t: tangent(foot.road.line, foot.i, foot.k) } : null;
  }
  const feet = roadFeet(s.at, roads, aside, JUNCTION).map((foot) => ({ foot, t: tangent(foot.road.line, foot.i, foot.k) }));
  let best: { foot: RoadFoot; t: Pt; sin: number } | null = null;
  for (const { foot, t } of feet) {
    const sin = Math.abs(t.x * path.z - t.z * path.x);
    // Nearest first: a farther axis only where the path crosses it squarer by more than a few degrees.
    if (!best || sin > best.sin + 0.05) best = { foot, t, sin };
  }
  // At a junction the street's axis bends and its ways meet: a crossing node's zebra lies along the
  // foot path through it (the curator's rule, G-836 round 2). A street's ways split at the node in
  // line are no junction, nor a drive leaving a street (`service`). A crossing way's zebra stays square
  // to its street: the way is drawn askew as often as not (the curator's (621,-218), round 3).
  const drive = (p: { foot: RoadFoot }) => p.foot.road.tags.highway === "service" && best?.foot.road.tags.highway !== "service";
  const turns = feet.filter((p) => !drive(p));
  const junction = !s.way && turns.some((p) => turns.some((q) => Math.abs(p.t.x * q.t.x + p.t.z * q.t.z) < BENT));
  if (best && junction) return { foot: best.foot, t: { x: path.z, z: -path.x } };
  return best;
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
 * when none is near: along the zebra's middle, to the kerb on its axis. Not the narrowest of it and
 * lines near its sides: at a mouth or a kerb askew one of them ran off the asphalt metres short of
 * the kerb the zebra reaches on the orthophoto (G-836, the curator's (927,468)).
 */
const across = (c: Pt, n: Pt, t: Pt, cap: number, on: (p: Pt) => boolean): [number, number] | null => {
  // Asphalt either side along the street is asphalt too: the seam where two ways' bands end at the
  // crossing node runs across the street, often right under the zebra's middle; a kerb runs along it.
  const mid = (u: number) => {
    const [x, z] = [c.x + n.x * u, c.z + n.z * u];
    return on({ x, z }) || (on({ x: x + t.x * SEAM, z: z + t.z * SEAM }) && on({ x: x - t.x * SEAM, z: z - t.z * SEAM }));
  };
  const k = Math.floor(cap / STEP);
  // The run of the asphalt nearest the axis: a carriageway moved aside off its axis (ADR-0080 PR 10) starts off it.
  let found: number | null = null;
  for (let j = 0; j <= k && found === null; j++) for (const u of j === 0 ? [0] : [j * STEP, -j * STEP]) if (found === null && mid(u)) found = u;
  if (found === null) return null;
  return [edge(mid, found, -1, cap), edge(mid, found, 1, cap)];
};

/** How much shorter than its middle a zebra's side may reach for the zebra to end where the side does (m). */
const SIDE_SHORT = 1;

/**
 * The span across of the zebra's middle, each end pulled in to its sides' where they end on a
 * sidewalk up to `SIDE_SHORT` short of it (`walk`: just past the side's end): a kerb a little askew
 * to the zebra, where its corner ran out over the sidewalk and cut a notch in its kerb (G-837's
 * Kapucyńska). Not a mouth's, metres short or onto other ground (`across`).
 */
const short = (mid: [number, number], sides: readonly ([number, number] | null)[], walk: (side: number, u: number) => boolean): [number, number] => {
  let [lo, hi] = mid;
  sides.forEach((side, k) => {
    if (!side) return;
    if (side[0] > lo && side[0] - lo <= SIDE_SHORT && walk(k, side[0] - 2 * STEP)) lo = side[0];
    if (side[1] < hi && hi - side[1] <= SIDE_SHORT && walk(k, side[1] + 2 * STEP)) hi = side[1];
  });
  return [lo, hi];
};

type Boxed = { readonly box: Rect; readonly ring: readonly Pt[] };

/**
 * The zebras across the carriageways at `spots`, a band's each: a rectangle square to the street's
 * axis, `along` along it, from kerb to kerb of the `asphalt` rings, short of the kerb stones laid
 * over their edge (`over`, ranked over the asphalt: the kerb is where they start), and short of the
 * `pavement` where a side meets it first (`short`). Null where the
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
  pavement: readonly Boxed[] = [],
): (Pt[][] | null)[] => {
  const [bins, kerbs, walks] = [new RingBins(asphalt), new RingBins(over), new RingBins(pavement)];
  const on = (p: Pt) => bins.holds(p.x, p.z) && !kerbs.holds(p.x, p.z);
  const done = new Set<string>();
  return zebras.map((z) => {
    const at = spots(z);
    if (!at || at.length === 0) return null;
    if (done.has(z.source)) return [];
    const rings = at.flatMap((s): Pt[][] => {
      const street = streetAt(s, roads, aside);
      if (!street) return [];
      const { foot, t } = street;
      const n = { x: -t.z, z: t.x };
      const h = s.along / 2;
      const span = across(foot.foot, n, t, FAR, on);
      if (!span || span[1] - span[0] < MIN_ACROSS) return [];
      const corner = (a: number, u: number): Pt => ({ x: foot.foot.x + t.x * a + n.x * u, z: foot.foot.z + t.z * a + n.z * u });
      const sides = [-h, h];
      const walk = (k: number, u: number) => walks.holds(foot.foot.x + t.x * sides[k]! + n.x * u, foot.foot.z + t.z * sides[k]! + n.z * u);
      const [lo, hi] = short(span, sides.map((a) => across({ x: foot.foot.x + t.x * a, z: foot.foot.z + t.z * a }, n, t, FAR, on)), walk);
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
  areas: readonly Area[],
): Laid[] => {
  const roadAreas = new Set(areas.filter((a) => a.tags["area:highway"] !== undefined).map((a) => a.id));
  const zebras = bands.filter((b) => b.surface === "crossing");
  // A joint's patch is asphalt too (`roundJoints`), and a road area the carriageways open into (`area:highway`), not a car park.
  const paved = (b: Laid) => b.surface === "road" || b.surface === "cobble";
  const asphalt = [...bands.filter((b) => b.carriageway || ((b.patch || roadAreas.has(b.source)) && paved(b))), ...[...kerbs.widened.values()].map((w) => ({ ring: w.ring, box: ringBounds(w.ring) }))];
  const stones = kerbs.fills.filter((f) => f.kerbStone).map((f) => ({ ring: f.ring, box: ringBounds(f.ring) }));
  const walks = [...bands.filter((b) => b.surface === "sidewalk"), ...kerbs.fills.filter((f) => f.surface === "sidewalk").map((f) => ({ ring: f.ring, box: ringBounds(f.ring) }))];
  const fitted = new Map(fitZebras(zebras, spots, roads, aside, asphalt, stones, walks).map((rings, i) => [zebras[i]!, rings]));
  // A rectangle: a crossing way's ends at the footways it meets (`roundEnds`) are no ends of it.
  const laid = ({ roundEnds: _, ...b }: Laid, ring: Pt[]): Laid => ({ ...b, ring, box: ringBounds(ring) });
  return bands.flatMap((b) => {
    const rings = fitted.get(b);
    if (!rings) return [b];
    const path: Laid[] = b.source.startsWith("w") ? [{ ...b, surface: "footway" }] : [];
    return [...path, ...rings.map((ring) => laid(b, ring))];
  });
};
