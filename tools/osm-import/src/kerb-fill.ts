/**
 * A pavement reaches the kerb (G-522): the map's footways and pavement areas lie where they were
 * drawn, and a carriageway is as wide as its width, its lanes or its type say, so along most
 * streets with separately mapped sidewalks the two missed each other by 1–3 m and left a strip of
 * bare terrain between the asphalt and the paving, a wedge where the footway wanders off the
 * street's axis. The strip is closed from the carriageway's edge to the paving when nothing else
 * lies in it (a building, a lawn, water, steps, rails or another carriageway keep their place; a
 * gap wider than `KERB_REACH` is a verge of its own):
 * - where the street's width is the import's estimate (no `width` or `width:carriageway` in the
 *   map) and the gap is `ROAD_GAP` or more, the estimate missed the asphalt: lanes times 3.25 m or
 *   the width by type leave out the parking lanes and bus bays, which the orthophoto shows paved
 *   up to the footway (G-570, T-247). The carriageway's own band is widened to the paving, and a
 *   kerb stone (`KERB_STONE` of sidewalk) laid over its edge where the paving draws no kerb of its own;
 * - elsewhere the strip is laid as a sidewalk, so the renderer draws its kerb at the asphalt.
 * The lanes, markings and zebras' places come from the street's axis and width as before: the
 * simulation sees no change; the zebras only reach on to the new kerb (`fitZebras`).
 */
import { COVER } from "../../orto/src/classify.ts";
import { type Pt, type Rect, ccw, lineLength, offsetLine, ringBounds, selfIntersects, simplifyRing } from "./geometry.ts";
import { type Band } from "./ground.ts";
import { LAWN_GAP, lawnStretches, pastKerbOf } from "./kerb-lawn.ts";
import { type WidenRun } from "./kerb-widen.ts";
import { RingBins } from "./ring-bins.ts";

/** The widest gap between a carriageway's edge and its paving closed (m), as the glitch scan's `kerb-gap-bare` counts. */
export const KERB_REACH = 3;
/** The narrowest gap along a street of estimated width taken for its own asphalt, not a pavement (m). */
export const ROAD_GAP = 1;
/** The step along a carriageway's edge (m). */
const ALONG = 0.5;
/** Steps of the edge a fill spans at most: a fill reads the map no further than this along the edge, wherever its run goes on. */
const WINDOW = 20;
/**
 * How far past a chunk the bands and buildings a fill in it reads may lie (m): a window of the
 * edge from the chunk on, and the march out from it. Built with them, a district alone gets the
 * fills it gets in the whole city (`generate`).
 */
export const FILL_MARGIN = WINDOW * ALONG + KERB_REACH + 2;
/** The step out from the edge toward the paving (m). */
const ACROSS = 0.2;
/** How far a fill reaches into the paving it leads to (m), past the rounding to 0.1 m: no seam between them. */
const INTO = 0.1;
/**
 * How far a strip to a lawn reaches into it (m): the lawn's mapped edge runs at a slant between the
 * samples `ALONG` apart, and a seam of bare ground stayed between them; the strip is grass too (G-825).
 */
const LAWN_INTO = 0.3;
/** How far out from the edge the paving must start for a strip to lie between (m): nearer, it reaches the asphalt. */
const SEAM = 0.01;
/** Halvings of the last step, to the paving's edge within 1.25 cm: the fill's outer edge follows it. */
const REFINE = 4;
/** How far the fill's outline may stray from its samples when simplified (m): finer than a chunk's 0.3, or a seam opens at the paving or the asphalt. */
const SIMPLIFY = 0.05;
/** The most a widened kerb steps out or back from one sample to the next (m, `ALONG` apart): a slope of about 70°. */
const RISE = 3 * ALONG;
/** How near its axis another carriageway alongside covers a carriageway for the two to run into one (m): further out, they only touch, as the two of a dual road. */
const MERGE_AXIS = 1;
/** How far past the paving reached another carriageway makes it an island between two (m): neither is widened over to it. */
const MEDIAN_REACH = KERB_REACH;
/** The fewest samples in a row a carriageway is widened over (`ALONG` apart): 3 m, a car's bay at the least. */
const MIN_RUN = 1;
/** The most the paving's edge steps out or back from one sample to the next for a widened stretch to grow over it (m, `ALONG` apart): a slope of 45°. */
const GROW_STEP = ALONG;
/** The kerb stone laid between a widened carriageway and paving with no kerb of its own (m): the renderer draws kerbs on sidewalks only. */
const KERB_STONE = 0.3;

/** The surfaces a fill leads to. */
const PAVING = new Set(["sidewalk", "footway", "square", "cobble"]);

type Boxed = Band & { readonly box: Rect };
/** A building's outline, among the ground's bands. */
type Block = { readonly box: Rect; readonly ring: readonly Pt[]; readonly block: true };
/** What a march out from a kerb reads: the ground with the buildings, and its carriageways alone. */
type World = { readonly lots: RingBins<Boxed | Block>; readonly roads: RingBins<Boxed> };
/** A strip's two ends across it: on the inner and the outer line. */
type Span = { readonly edge: Pt; readonly out: Pt };
/**
 * The paving reached from a point of a carriageway's edge: how far out, whether it draws its own
 * kerb, whether another carriageway lies just past it (an island between the two of a dual road),
 * and whether it is no paving but another carriageway, met at a corner (`joins`).
 */
type Hit = { readonly gap: number; readonly kerbed: boolean; readonly median: boolean; readonly joins?: true; readonly lawn?: true };
/** A point of a carriageway's edge `s` along it, the way out from it and the paving reached. */
type Sample = { readonly k: number | null; readonly s: number; readonly edge: Pt; readonly dir: Pt; readonly hit: Hit | null };

const isPaving = (b: Band) => PAVING.has(b.surface) && !b.carriageway && !b.bridge;
const along = (p: Pt, d: Pt, t: number): Pt => ({ x: p.x + d.x * t, z: p.z + d.z * t });

/** Whether the axis `line` runs alongside an edge whose way out is `dir` near `q`: its nearest segment within 25° of square to `dir`. */
const alongside = (line: readonly Pt[], q: Pt, dir: Pt): boolean => {
  let best: { d: number; cos: number } | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const len = Math.hypot(dx, dz) || 1;
    // Not `segmentDistance` of core: the parameter divides by `len * len` of the rounded length, another rounding than `dx * dx + dz * dz`.
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.z - a.z) * dz) / (len * len)));
    const d = Math.hypot(a.x + dx * t - q.x, a.z + dz * t - q.z);
    if (!best || d < best.d) best = { d, cos: Math.abs((dx * dir.x + dz * dir.z) / len) };
  }
  return best !== null && best.cos < Math.sin((25 * Math.PI) / 180);
};

/**
 * The paving reached marching out from `edge` along `dir` over bare ground only, within
 * `KERB_REACH`, or another carriageway met (`joins`); null where something else comes first, or
 * where the paving starts at the edge. The zebras are not among the bands: they are fitted to the
 * kerbs after (`fitZebras`, G-836).
 */
const pavingOut = (edge: Pt, dir: Pt, { lots, roads }: World, lawns = false): Hit | null => {
  // What lies at a point: a building, or none, a carriageway among it, all of it
  // paving, a sidewalk among it. One visitor for the whole march, so a step allocates nothing: the
  // city takes some two million steps, and their garbage was a good part of the import's time.
  const at = { block: false, any: false, road: false, paving: true, sidewalk: false, lawn: true };
  const visit = (b: Boxed | Block) => {
    if ("block" in b) return (at.block = true);
    at.any = true;
    at.road ||= b.carriageway === true;
    at.paving &&= isPaving(b);
    at.lawn &&= b.surface === "grass" && !b.bridge;
    at.sidewalk ||= b.surface === "sidewalk";
    return false;
  };
  const what = (t: number): "bare" | "paving" | "kerbed" | "road" | "lawn" | "other" => {
    const x = edge.x + dir.x * t;
    const z = edge.z + dir.z * t;
    at.block = at.any = at.road = at.sidewalk = false;
    at.paving = at.lawn = true;
    lots.scan(x, z, visit);
    if (at.block) return "other";
    if (!at.any) return "bare";
    if (at.road) return "road";
    if (!at.paving) return lawns && at.lawn ? "lawn" : "other";
    return at.sidewalk ? "kerbed" : "paving";
  };
  for (let t = ACROSS / 2; t <= KERB_REACH; t += ACROSS) {
    const got = what(t);
    if (got === "bare") continue;
    // Paving within the first step is a seam the outlines' rounding leaves bare unless it reaches
    // the edge itself: a kerb measured on the orthophoto lies by the map's paving (G-811).
    if (got === "other") return null;
    // A lawn at a moved carriageway's edge itself is its strip's too, of no width: the strip's
    // stretch is one surface over it, else the lawn met the asphalt between two squares (G-825 r4).
    if (got === "lawn" && t < ACROSS && what(SEAM) === "lawn") return { gap: 0, kerbed: true, median: false, lawn: true };
    if (t < ACROSS && (got === "road" || what(SEAM) !== "bare")) return null;
    let [lo, hi] = [Math.max(0, t - ACROSS), t];
    for (let k = 0; k < REFINE; k++) {
      const mid = (lo + hi) / 2;
      if (what(mid) === "bare") lo = mid;
      else hi = mid;
    }
    if (got === "road") return { gap: hi, kerbed: true, median: false, joins: true };
    if (got === "lawn") return { gap: hi, kerbed: true, median: false, lawn: true };
    let median = false;
    for (let u = hi + ACROSS / 2; u <= hi + MEDIAN_REACH && !median; u += ACROSS) median = roads.holds(edge.x + dir.x * u, edge.z + dir.z * u);
    return { gap: hi, kerbed: got === "kerbed", median };
  }
  return null;
};

/** The ring of a run of spans, from the inner line out; split in two where it would cross itself (a bend's inner side). */
const runRings = (run: readonly Span[]): Pt[][] => {
  if (run.length < 2) return [];
  const ring = ccw([...run.map((h) => h.edge), ...run.map((h) => h.out).reverse()]);
  if (!selfIntersects(ring)) return [simplifyRing(ring, SIMPLIFY)];
  if (run.length < 4) return [];
  const mid = Math.floor(run.length / 2);
  return [...runRings(run.slice(0, mid + 1)), ...runRings(run.slice(mid))];
};

/**
 * The samples along one edge of a carriageway, `side` 1 its left (`offsetLine`'s positive offset),
 * -1 its right, each with the step it is at (the edge's last point none) and the paving reached.
 */
const edgeSamples = (line: readonly Pt[], offset: number, side: number, world: World, lawns = false): { edge: Pt[]; samples: Sample[] } => {
  const edge = offsetLine(line, offset);
  // `pointAlong` with the segments' lengths taken once: every sample walked the edge from its start.
  const lens = edge.slice(1).map((b, i) => Math.hypot(b.x - edge[i]!.x, b.z - edge[i]!.z));
  const at = (s: number): Pt => {
    let left = Math.max(0, s);
    for (let i = 0; i < lens.length; i++) {
      const [a, b, len] = [edge[i]!, edge[i + 1]!, lens[i]!];
      if (left <= len) return { x: a.x + ((b.x - a.x) * left) / (len || 1), z: a.z + ((b.z - a.z) * left) / (len || 1) };
      left -= len;
    }
    return edge[edge.length - 1] ?? { x: 0, z: 0 };
  };
  const out: Sample[] = [];
  const sample = (k: number | null, s: number, p: Pt, dir: Pt) => out.push({ k, s, edge: p, dir, hit: pavingOut(p, dir, world, lawns) });
  const normal = (a: Pt, b: Pt, len: number) => ({ x: (-(b.z - a.z) / len) * side, z: ((b.x - a.x) / len) * side });
  let s0 = 0;
  for (let i = 0; i + 1 < edge.length; i++) {
    const [a, b] = [edge[i]!, edge[i + 1]!];
    const len = lens[i]!;
    if (len < 1e-6) continue;
    // Samples at the steps of the whole edge's length, so a short segment gets its share.
    const dir = normal(a, b, len);
    for (let k = Math.ceil(s0 / ALONG); k * ALONG < s0 + len; k++) sample(k, k * ALONG, at(k * ALONG), dir);
    s0 += len;
  }
  const [a, b] = [edge[edge.length - 2]!, edge[edge.length - 1]!];
  sample(null, s0, b, normal(a, b, Math.hypot(b.x - a.x, b.z - a.z) || 1));
  return { edge, samples: out };
};

/**
 * One edge of a widened carriageway: its own vertices where it is not widened, the samples moved
 * out to the paving where it is, stepping out and back at their ends; and those stretches alone,
 * the pieces of asphalt a chunk lays along the carriageway (`widenPieces`).
 */
const widenedEdge = (edge: readonly Pt[], samples: readonly Sample[], out: (s: Sample) => Pt | null): { pts: Pt[]; runs: WidenRun[] } => {
  const pts: Pt[] = [];
  const runs: { inner: Pt[]; outer: Pt[] }[] = [];
  let [v, at, was] = [0, 0, false];
  const vertex = () => {
    if (!was) pts.push(edge[v]!);
    if (v + 1 < edge.length) at += Math.hypot(edge[v + 1]!.x - edge[v]!.x, edge[v + 1]!.z - edge[v]!.z);
    v++;
  };
  for (const s of samples) {
    while (v < edge.length && at < s.s - 1e-9) vertex();
    const moved = out(s);
    if (moved && !was) {
      pts.push(s.edge);
      runs.push({ inner: [], outer: [] });
    }
    if (moved) {
      pts.push(moved);
      runs[runs.length - 1]!.outer.push(moved);
    } else if (was) pts.push(s.edge);
    if (moved || was) runs[runs.length - 1]!.inner.push(s.edge);
    was = moved !== null;
  }
  while (v < edge.length) vertex();
  return { pts, runs };
};

/** Keeps only the runs of `MIN_RUN` true flags and longer: a shorter stretch is a junction's corner, not a parking lane. */
const longRuns = (flags: readonly boolean[]): boolean[] => {
  const out = [...flags];
  for (let i = 0; i < flags.length; ) {
    let j = i;
    while (j < flags.length && flags[j]) j++;
    if (j - i < MIN_RUN) for (let k = i; k < j; k++) out[k] = false;
    i = Math.max(j, i + 1);
  }
  return out;
};

/**
 * The runs of `seeds` grown on either side over the samples where the carriageway `may` reach its
 * paving, as long as the paving's edge runs on smooth (`GROW_STEP` from one sample to the next):
 * the asphalt follows it in to the kerb as the gap closes under `ROAD_GAP`, and does not step back
 * 1 m to the estimated edge where it crosses it (G-837). A corner's wedge it stops at.
 */
const grownRuns = (seeds: readonly boolean[], may: readonly boolean[], gaps: readonly number[]): boolean[] => {
  const out = [...seeds];
  const smooth = (j: number, k: number) => may[j] && Math.abs(gaps[j]! - gaps[k]!) <= GROW_STEP;
  for (let i = 0; i < seeds.length; i++) {
    if (!seeds[i]) continue;
    for (let j = i - 1; j >= 0 && !out[j] && smooth(j, j + 1); j--) out[j] = true;
    for (let j = i + 1; j < seeds.length && !seeds[j] && smooth(j, j - 1); j++) out[j] = true;
  }
  return out;
};

/**
 * Whether a sample is widened, by the flags of its edge's samples: its own, or a side street's
 * corner beside one widened. The corner between a widened stretch and a side street it meets is
 * asphalt too: left bare, it pinched the lane the wider street moved out (Radziwiłłowska, G-090).
 */
const cornered = (ok: readonly boolean[], s: Sample, i: number): boolean => ok[i] === true || (s.hit?.joins === true && (ok[i - 1] === true || ok[i + 1] === true));

/** How far out the asphalt of each sample of the edges goes (`easedReach`) where `wide`, up to its `cap`. */
const reachOf = (sides: readonly (readonly Sample[])[], wide: (s: Sample) => boolean, cap: ReadonlyMap<Sample, number>): Map<Sample, number> => {
  const reach = new Map<Sample, number>();
  for (const side of sides) {
    const eased = easedReach(side, wide, cap);
    side.forEach((s, i) => reach.set(s, eased[i]!));
  }
  return reach;
};

/** A carriageway's ring widened by `reach` on its right and left edges, and the stretches widened; null where it would cross itself. */
const widenedRing = ([re, right]: readonly [readonly Pt[], readonly Sample[]], [le, left]: readonly [readonly Pt[], readonly Sample[]], reach: ReadonlyMap<Sample, number>) => {
  const out = (s: Sample) => (reach.get(s)! > 0 ? along(s.edge, s.dir, reach.get(s)!) : null);
  const [wr, wl] = [widenedEdge(re, right, out), widenedEdge(le, left, out)];
  const ring = ccw([...wr.pts, ...wl.pts.reverse()]);
  return selfIntersects(ring) ? null : { ring, runs: [...wr.runs, ...wl.runs] };
};

/** Cuts samples into runs of one kind, every `WINDOW` steps too, neighbouring runs sharing the step between them. */
const runsOf = <T>(samples: readonly Sample[], spanOf: (s: Sample) => T | null, flush: (run: T[]) => void): void => {
  let run: T[] = [];
  for (const s of samples) {
    const span = spanOf(s);
    if (span === null) {
      flush(run);
      run = [];
      continue;
    }
    run.push(span);
    if (s.k !== null && s.k % WINDOW === 0 && run.length > 1) {
      flush(run);
      run = [span];
    }
  }
  flush(run);
};

/**
 * How far out the asphalt may step at the end of a widened stretch whose next sample out meets a
 * lawn on its way (`pavingOut` stops at it) a kerb's width (`LAWN_GAP`) and more from the edge and
 * as much short of the paving the end sample reaches: a kerb's width short of the lawn's line, as
 * the paving between the lawn and the asphalt runs on by its corner, and the paving the step leaves
 * is reached by a sidewalk. The end sample's march passed the lawn's corner to the paving behind
 * it, and the asphalt stepped out 1.5 m by the corner: the bare ground rule laid the corner's
 * green between paving either side, a metre of grass between two squares along the kerb (Ruska at
 * its zebra by Podzamcze, G-897). Not so far short that the sample next in loses its reach to the
 * paving (`RISE` a step), or a seam of bare ground opened between the two.
 */
const lawnCaps = (side: readonly Sample[], wide: (s: Sample) => boolean, world: World, caps: Map<Sample, number>): void => {
  side.forEach((s, i) => {
    if (!wide(s)) return;
    for (const j of [i - 1, i + 1]) {
      const [n, inner] = [side[j], side[2 * i - j]];
      if (!n || wide(n) || n.hit !== null) continue;
      const lawn = pavingOut(n.edge, n.dir, world, true);
      if (!lawn?.lawn || lawn.gap < LAWN_GAP || s.hit!.gap - lawn.gap <= LAWN_GAP) continue;
      const cap = Math.max(lawn.gap - LAWN_GAP, inner?.hit && wide(inner) ? inner.hit.gap + INTO - RISE : 0);
      if (cap < Math.min(s.hit!.gap + INTO, RISE)) caps.set(s, Math.min(caps.get(s) ?? cap, cap));
    }
  });
};

export interface KerbFills {
  /** Sidewalks over the strips, and kerb stones along the widened carriageways. */
  readonly fills: readonly Band[];
  /**
   * The carriageways widened over their strips: their new rings (the zebras' reach), the stretches
   * widened (the asphalt laid along them), and those before they grew in to the kerb (the lanes').
   */
  readonly widened: ReadonlyMap<Band, { readonly ring: readonly Pt[]; readonly runs: readonly WidenRun[]; readonly lanes: readonly WidenRun[] }>;
}

/**
 * How far out the asphalt of each sample of one edge goes: to the paving where it is widened,
 * eased in and out by `RISE` a step, so the kerb turns out along a slope and does not fold back on
 * itself where the paving's edge jumps (a square's corner); the paving the ease leaves is reached
 * by a sidewalk. On a bend's inner side the kerbs moved out may still run backwards: those samples
 * are not widened.
 */
const easedReach = (side: readonly Sample[], wide: (s: Sample) => boolean, cap: ReadonlyMap<Sample, number>): number[] => {
  const base = side.map((s) => (wide(s) ? Math.min(s.hit!.gap + INTO, cap.get(s) ?? Infinity) : 0));
  for (let round = 0; round < side.length; round++) {
    const g = [...base];
    for (let i = 1; i < g.length; i++) g[i] = Math.min(g[i]!, g[i - 1]! + RISE);
    for (let i = g.length - 2; i >= 0; i--) g[i] = Math.min(g[i]!, g[i + 1]! + RISE);
    const folded = side.findIndex((s, i) => {
      if (i === 0 || (g[i] === 0 && g[i - 1] === 0)) return false;
      const [a, b] = [along(side[i - 1]!.edge, side[i - 1]!.dir, g[i - 1]!), along(s.edge, s.dir, g[i]!)];
      const [ex, ez] = [s.edge.x - side[i - 1]!.edge.x, s.edge.z - side[i - 1]!.edge.z];
      return (b.x - a.x) * ex + (b.z - a.z) * ez <= 0.1 * (ex * ex + ez * ez);
    });
    if (folded < 0) return g;
    base[folded] = 0;
    base[folded - 1] = 0;
  }
  return side.map(() => 0);
};

/**
 * The fills of the gaps between the carriageways among `bands` (their `kerb` axis) and the paving
 * beside them, `buildings` standing in the way; `estimated(source, side)` says the carriageway's
 * width is the import's estimate on that side (1 its left, -1 its right); `walks` are the sidewalks before they were cut at the carriageways. A carriageway whose widened ring would cross itself keeps its ring,
 * and its strips are laid as sidewalks. A carriageway `moved` off its way's line (G-825) has its
 * strip to a lawn up to `LAWN_GAP` across laid too, as the lawn's: the bare ground rule's cells left
 * seams and paving on the green between its new edge and the lawn's slanted edge (Lwowska by Rondo Mohyły).
 */
export const kerbFills = (
  bands: readonly Boxed[],
  buildings: readonly (readonly Pt[])[],
  estimated: (source: string, side: 1 | -1) => boolean,
  walks: readonly (readonly Pt[])[] = [],
  moved: ReadonlySet<string> = new Set(),
  cover: (p: Pt) => number = () => COVER.none,
): KerbFills => {
  // The sidewalks laid and mapped, whole: a stretch cut off where it ran over a carriageway is paving the march stops at too.
  const whole = walks.map((ring): Boxed => ({ surface: "sidewalk", ring, bridge: false, source: "", box: ringBounds(ring) }));
  const laid = [...bands.filter((b) => !b.bridge), ...whole];
  const blocks = buildings.map((ring): Block => ({ ring, box: ringBounds(ring), block: true }));
  const world: World = { lots: new RingBins<Boxed | Block>([...laid, ...blocks]), roads: new RingBins(laid.filter((b) => b.carriageway === true)) };
  const fills: Band[] = [];
  const widened = new Map<Band, { ring: readonly Pt[]; runs: readonly WidenRun[]; lanes: readonly WidenRun[] }>();
  const pastKerb = pastKerbOf(cover);
  for (const road of bands) {
    if (!road.kerb || road.bridge || lineLength(road.kerb.line) < ALONG) continue;
    const { line, half } = road.kerb;
    const lawns = moved.has(road.source);
    const [r, l] = [edgeSamples(line, -half, -1, world, lawns), edgeSamples(line, half, 1, world, lawns)];
    const [right, left] = [r.samples, l.samples];
    // Where another carriageway running alongside covers this one past its axis (the two of a dual road
    // running into one), the kerb is theirs too: widened, it made a kerb for cars parked across the
    // other carriageway (Ruska by Podzamcze, G-570). A side street's mouth runs across: no matter.
    const merged = (s: Sample) => {
      const q = along(s.edge, s.dir, -half - MERGE_AXIS);
      return world.roads.scan(q.x, q.z, (b) => b !== road && b.kerb !== undefined && alongside(b.kerb.line, q, s.dir));
    };
    const reaches = (side: 1 | -1) => (s: Sample) => estimated(road.source, side) && s.hit !== null && !s.hit.joins && !s.hit.lawn && !s.hit.median && !merged(s);
    const own = (side: 1 | -1) => (s: Sample) => reaches(side)(s) && s.hit!.gap >= ROAD_GAP;
    // Grown in to the kerb, also where a zebra is mapped past it: the zebras are fitted to the kerbs after (`laidZebras`, G-836).
    const may = reaches;
    // The stretches widened (`seeded`, as the lanes read them) and the asphalt grown on from them in to the kerb (`wideSet`).
    const [seeded, wideSet] = [new Set<Sample>(), new Set<Sample>()];
    for (const [side, sign] of [[right, -1], [left, 1]] as const) {
      const seeds = longRuns(side.map(own(sign)));
      const grown = grownRuns(seeds, side.map(may(sign)), side.map((s) => s.hit?.gap ?? 0));
      side.forEach((s, i) => {
        if (cornered(seeds, s, i)) seeded.add(s);
        if (cornered(grown, s, i)) wideSet.add(s);
      });
    }
    const wide = (s: Sample) => wideSet.has(s);
    const caps = new Map<Sample, number>();
    for (const side of [right, left]) lawnCaps(side, wide, world, caps);
    const reach = reachOf([right, left], wide, caps);
    let asRoad = wideSet.size > 0;
    if (asRoad) {
      const ground = widenedRing([r.edge, right], [l.edge, left], reach);
      if (!ground) asRoad = false;
      // The lanes keep the reach of the stretches widened: moved out over the asphalt grown in to
      // the kerb, a lane ran over the bays beside it (ADR-0080).
      else widened.set(road, { ...ground, lanes: widenedRing([r.edge, right], [l.edge, left], reachOf([right, left], (s) => seeded.has(s), caps))?.runs ?? [] });
    }
    const full = (s: Sample) => asRoad && wide(s) && reach.get(s)! >= s.hit!.gap + INTO - 1e-9;
    const lay = (run: Span[], stone?: true, surface: "sidewalk" | "grass" | "square" = "sidewalk") => {
      for (const ring of runRings(run)) fills.push({ surface, ring, bridge: false, source: road.source, holed: true, ...(stone ? { kerbStone: stone } : {}) });
    };
    for (const side of [right, left]) {
      // The strips left as sidewalks: from the edge to the paving.
      // From the edge, or from where the eased asphalt stops short of the paving; `INTO` under the
      // asphalt, which ranks over it (`partitionGround`): from the edge itself, the strip's points
      // rounded off the asphalt's straight edge left a bare seam of up to 0.07 m between (G-811).
      const from = (s: Sample) => (asRoad && wide(s) ? reach.get(s)! : 0) - INTO;
      // A sample full to the paving next to one stepped out short of a lawn is in its run: alone, a strip of one sample is none.
      const byCap = new Set(caps.size === 0 ? [] : side.filter((_, i) => caps.has(side[i - 1]!) || caps.has(side[i + 1]!)));
      runsOf(side, (s) => (s.hit && !s.hit.joins && !s.hit.lawn && (!full(s) || byCap.has(s)) ? { edge: along(s.edge, s.dir, from(s)), out: along(s.edge, s.dir, s.hit.gap + INTO) } : null), lay);
      // A moved carriageway's strip to a lawn is the lawn's, drawn to the new kerb (G-825). It reaches
      // on over the next sample past its ends, to the lawn's reach there: the step to a strip of
      // paving, or to the bare ground rule's fill, stayed bare.
      const lawnLike = lawnStretches(side, (s) => s.hit!.gap <= LAWN_GAP || pastKerb(s) === COVER.green, (s) => pastKerb(s) === COVER.paving);
      const reachLawn = new Map<Sample, number>();
      side.forEach((s, i) => {
        const at = [s, side[i - 1], side[i + 1]].find((n) => n !== undefined && lawnLike.has(n));
        if (at && !s.hit?.joins) reachLawn.set(s, lawnLike.has(s) ? s.hit!.gap : at.hit!.gap);
      });
      runsOf(side, (s) => (reachLawn.has(s) ? { edge: along(s.edge, s.dir, -INTO), out: along(s.edge, s.dir, reachLawn.get(s)! + LAWN_INTO) } : null), (run) => lay(run, undefined, "grass"));
      // The wider one's paving is a square to the lawn, as the bare ground rule's cover laid it, but
      // whole: the rule's cells of 0.5 m left seams by the new kerb and the lawn's slanted edge. Over
      // the next sample past its ends too, to a strip of paving there or the lawn's reach. A kerb's
      // width at least: the light kerb the orthophoto shows where the lawn's mapped edge reaches it.
      const wideLawn = (n: Sample | undefined) => n?.hit?.lawn === true && !lawnLike.has(n);
      const reachSquare = new Map<Sample, number>();
      side.forEach((s, i) => {
        const at = [s, side[i - 1], side[i + 1]].find(wideLawn);
        if (at && s.hit && !s.hit.joins) reachSquare.set(s, wideLawn(s) ? Math.max(s.hit.gap, LAWN_GAP - LAWN_INTO) : Math.min(s.hit.gap, at.hit!.gap));
      });
      runsOf(side, (s) => (reachSquare.has(s) ? { edge: along(s.edge, s.dir, -INTO), out: along(s.edge, s.dir, reachSquare.get(s)! + LAWN_INTO) } : null), (run) => lay(run, undefined, "square"));
      // The kerb stones of the widened carriageway, where the paving draws no kerb of its own: on the
      // asphalt's side of the paving's edge, ranked over the asphalt that reaches under them
      // (`KERB_STONES`, G-803), so the kerb stands 0.3 m short of the paving's mapped edge, where the
      // orthophoto shows it (T-294); the renderer draws the kerb on the stone's edge. A stone reaches
      // past the asphalt's edge by `INTO`: two edges of the paving's cut a few millimetres apart
      // left it in slivers.
      runsOf(side, (s) => (full(s) && !s.hit!.kerbed ? { edge: along(s.edge, s.dir, s.hit!.gap - KERB_STONE), out: along(s.edge, s.dir, reach.get(s)! + INTO) } : null), (run) => lay(run, true));
    }
  }
  return { fills, widened };
};
