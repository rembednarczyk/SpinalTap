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
 *   kerb stone (`KERB_STONE` of sidewalk) laid along paving that draws none of its own;
 * - elsewhere the strip is laid as a sidewalk, so the renderer draws its kerb at the asphalt.
 * The lanes, markings and zebras' places come from the street's axis and width as before: the
 * simulation sees no change; the zebras only reach on to the new kerb (`stretchZebras`).
 */
import { type Pt, type Rect, ccw, lineLength, offsetLine, pointAlong, pointInRing, ringBounds, selfIntersects, simplifyRing } from "./geometry.ts";
import { type Band } from "./ground.ts";
import { type WidenRun } from "./kerb-widen.ts";

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
/** The kerb stone laid between a widened carriageway and paving with no kerb of its own (m): the renderer draws kerbs on sidewalks only. */
const KERB_STONE = 0.3;
/** How far a zebra may reach on past the carriageway's estimated edge (m). */
const ZEBRA_REACH = KERB_REACH + INTO;

/** The surfaces a fill leads to. */
const PAVING = new Set(["sidewalk", "footway", "square", "cobble"]);

type Boxed = Band & { readonly box: Rect };
type Block = { readonly box: Rect; readonly ring: readonly Pt[] };
/** A strip's two ends across it: on the inner and the outer line. */
type Span = { readonly edge: Pt; readonly out: Pt };
/**
 * The paving reached from a point of a carriageway's edge: how far out, whether it draws its own
 * kerb, whether another carriageway lies just past it (an island between the two of a dual road),
 * and whether it is no paving but another carriageway, met at a corner (`joins`).
 */
type Hit = { readonly gap: number; readonly kerbed: boolean; readonly median: boolean; readonly crossed: boolean; readonly joins?: true };
/** A point of a carriageway's edge `s` along it, the way out from it and the paving reached. */
type Sample = { readonly k: number | null; readonly s: number; readonly edge: Pt; readonly dir: Pt; readonly hit: Hit | null };

/** Rings by the 10 m cells their boxes reach. */
class Bins<T extends { readonly box: Rect }> {
  private readonly cells = new Map<string, T[]>();
  constructor(items: readonly T[]) {
    for (const it of items)
      for (let i = Math.floor(it.box.minX / 10); i <= Math.floor(it.box.maxX / 10); i++)
        for (let k = Math.floor(it.box.minZ / 10); k <= Math.floor(it.box.maxZ / 10); k++) {
          const key = `${i},${k}`;
          const list = this.cells.get(key);
          if (list) list.push(it);
          else this.cells.set(key, [it]);
        }
  }
  at(p: Pt): readonly T[] {
    return this.cells.get(`${Math.floor(p.x / 10)},${Math.floor(p.z / 10)}`) ?? [];
  }
}

const inBox = (p: Pt, b: Rect) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
const isPaving = (b: Band) => PAVING.has(b.surface) && !b.carriageway && !b.bridge;
const along = (p: Pt, d: Pt, t: number): Pt => ({ x: p.x + d.x * t, z: p.z + d.z * t });

/** Whether the axis `line` runs alongside an edge whose way out is `dir` near `q`: its nearest segment within 25° of square to `dir`. */
const alongside = (line: readonly Pt[], q: Pt, dir: Pt): boolean => {
  let best: { d: number; cos: number } | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const len = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.z - a.z) * dz) / (len * len)));
    const d = Math.hypot(a.x + dx * t - q.x, a.z + dz * t - q.z);
    if (!best || d < best.d) best = { d, cos: Math.abs((dx * dir.x + dz * dir.z) / len) };
  }
  return best !== null && best.cos < Math.sin((25 * Math.PI) / 180);
};

/**
 * The paving reached marching out from `edge` along `dir` over bare ground only, within
 * `KERB_REACH`, or another carriageway met (`joins`); null where something else comes first, or
 * where the paving starts at the edge. A zebra mapped past the estimated kerb lies on the asphalt
 * the strip is, so the march goes on over it (G-090), and says so (`crossed`): a sidewalk is not
 * laid over one.
 */
const pavingOut = (edge: Pt, dir: Pt, bands: Bins<Boxed>, blocks: Bins<Block>): Hit | null => {
  let crossed = false;
  const what = (q: Pt): "bare" | "paving" | "kerbed" | "road" | "other" => {
    if (blocks.at(q).some((b) => inBox(q, b.box) && pointInRing(q, b.ring))) return "other";
    const all = bands.at(q).filter((b) => inBox(q, b.box) && pointInRing(q, b.ring));
    const on = all.filter((b) => b.surface !== "crossing");
    if (on.length === 0) {
      crossed ||= all.length > 0;
      return "bare";
    }
    if (on.some((b) => b.carriageway === true)) return "road";
    if (!on.every(isPaving)) return "other";
    return on.some((b) => b.surface === "sidewalk") ? "kerbed" : "paving";
  };
  const carriageway = (q: Pt) => bands.at(q).some((b) => b.carriageway === true && inBox(q, b.box) && pointInRing(q, b.ring));
  for (let t = ACROSS / 2; t <= KERB_REACH; t += ACROSS) {
    const got = what(along(edge, dir, t));
    if (got === "bare") continue;
    if (got === "other" || t < ACROSS) return null;
    let [lo, hi] = [t - ACROSS, t];
    for (let k = 0; k < REFINE; k++) {
      const mid = (lo + hi) / 2;
      if (what(along(edge, dir, mid)) === "bare") lo = mid;
      else hi = mid;
    }
    if (got === "road") return { gap: hi, kerbed: true, median: false, crossed, joins: true };
    let median = false;
    for (let u = hi + ACROSS / 2; u <= hi + MEDIAN_REACH && !median; u += ACROSS) median = carriageway(along(edge, dir, u));
    return { gap: hi, kerbed: got === "kerbed", median, crossed };
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
const edgeSamples = (line: readonly Pt[], offset: number, side: number, bands: Bins<Boxed>, blocks: Bins<Block>): { edge: Pt[]; samples: Sample[] } => {
  const edge = offsetLine(line, offset);
  const out: Sample[] = [];
  const sample = (k: number | null, s: number, p: Pt, dir: Pt) => out.push({ k, s, edge: p, dir, hit: pavingOut(p, dir, bands, blocks) });
  const normal = (a: Pt, b: Pt, len: number) => ({ x: (-(b.z - a.z) / len) * side, z: ((b.x - a.x) / len) * side });
  let s0 = 0;
  for (let i = 0; i + 1 < edge.length; i++) {
    const [a, b] = [edge[i]!, edge[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    // Samples at the steps of the whole edge's length, so a short segment gets its share.
    for (let k = Math.ceil(s0 / ALONG); k * ALONG < s0 + len; k++) sample(k, k * ALONG, pointAlong(edge, k * ALONG), normal(a, b, len));
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

export interface KerbFills {
  /** Sidewalks over the strips, and kerb stones along the widened carriageways. */
  readonly fills: readonly Band[];
  /** The carriageways widened over their strips: their new rings (the zebras' reach), and the stretches widened (the asphalt laid along them). */
  readonly widened: ReadonlyMap<Band, { readonly ring: readonly Pt[]; readonly runs: readonly WidenRun[] }>;
}

/**
 * How far out the asphalt of each sample of one edge goes: to the paving where it is widened,
 * eased in and out by `RISE` a step, so the kerb turns out along a slope and does not fold back on
 * itself where the paving's edge jumps (a square's corner); the paving the ease leaves is reached
 * by a sidewalk. On a bend's inner side the kerbs moved out may still run backwards: those samples
 * are not widened.
 */
const easedReach = (side: readonly Sample[], wide: (s: Sample) => boolean): number[] => {
  const base = side.map((s) => (wide(s) ? s.hit!.gap + INTO : 0));
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
 * beside them, `buildings` standing in the way; `estimated(source)` says the carriageway's width
 * is the import's estimate; `walks` are the sidewalks before they were cut at the carriageways. A carriageway whose widened ring would cross itself keeps its ring,
 * and its strips are laid as sidewalks.
 */
export const kerbFills = (bands: readonly Boxed[], buildings: readonly (readonly Pt[])[], estimated: (source: string) => boolean, walks: readonly (readonly Pt[])[] = []): KerbFills => {
  // The sidewalks laid and mapped, whole: a stretch cut off where it ran over a carriageway is paving the march stops at too.
  const whole = walks.map((ring): Boxed => ({ surface: "sidewalk", ring, bridge: false, source: "", box: ringBounds(ring) }));
  const ground = new Bins([...bands.filter((b) => !b.bridge), ...whole]);
  const blocks = new Bins(buildings.map((ring) => ({ ring, box: ringBounds(ring) })));
  const fills: Band[] = [];
  const widened = new Map<Band, { ring: readonly Pt[]; runs: readonly WidenRun[] }>();
  for (const road of bands) {
    if (!road.kerb || road.bridge || lineLength(road.kerb.line) < ALONG) continue;
    const { line, half } = road.kerb;
    const [r, l] = [edgeSamples(line, -half, -1, ground, blocks), edgeSamples(line, half, 1, ground, blocks)];
    const [right, left] = [r.samples, l.samples];
    // Where another carriageway running alongside covers this one past its axis (the two of a dual road
    // running into one), the kerb is theirs too: widened, it made a kerb for cars parked across the
    // other carriageway (Ruska by Podzamcze, G-570). A side street's mouth runs across: no matter.
    const merged = (s: Sample) => {
      const q = along(s.edge, s.dir, -half - MERGE_AXIS);
      return ground.at(q).some((b) => b !== road && b.carriageway === true && b.kerb !== undefined && inBox(q, b.box) && pointInRing(q, b.ring) && alongside(b.kerb.line, q, s.dir));
    };
    const own = (s: Sample) => estimated(road.source) && s.hit !== null && !s.hit.joins && s.hit.gap >= ROAD_GAP && !s.hit.median && !merged(s);
    // The corner between a widened stretch and a side street it meets is asphalt too: left bare,
    // it pinched the lane the wider street moved out (Radziwiłłowska, G-090).
    const wideSet = new Set<Sample>();
    for (const side of [right, left]) {
      const ok = longRuns(side.map(own));
      side.forEach((s, i) => {
        if (ok[i] || (s.hit?.joins && (ok[i - 1] === true || ok[i + 1] === true))) wideSet.add(s);
      });
    }
    const wide = (s: Sample) => wideSet.has(s);
    const reach = new Map<Sample, number>();
    for (const side of [right, left]) side.forEach((s, i) => reach.set(s, easedReach(side, wide)[i]!));
    let asRoad = wideSet.size > 0;
    if (asRoad) {
      const out = (s: Sample) => (reach.get(s)! > 0 ? along(s.edge, s.dir, reach.get(s)!) : null);
      const [wr, wl] = [widenedEdge(r.edge, right, out), widenedEdge(l.edge, left, out)];
      const ring = ccw([...wr.pts, ...wl.pts.reverse()]);
      if (selfIntersects(ring)) asRoad = false;
      else widened.set(road, { ring, runs: [...wr.runs, ...wl.runs] });
    }
    const full = (s: Sample) => asRoad && wide(s) && reach.get(s)! >= s.hit!.gap + INTO - 1e-9;
    const lay = (run: Span[]) => {
      for (const ring of runRings(run)) fills.push({ surface: "sidewalk", ring, bridge: false, source: road.source, holed: true });
    };
    for (const side of [right, left]) {
      // The strips left as sidewalks: from the edge to the paving.
      // From the edge, or from where the eased asphalt stops short of the paving.
      const from = (s: Sample) => (asRoad && wide(s) ? reach.get(s)! : 0);
      runsOf(side, (s) => (s.hit && !s.hit.joins && !(s.hit.crossed && !(asRoad && wide(s))) && !full(s) ? { edge: along(s.edge, s.dir, from(s)), out: along(s.edge, s.dir, s.hit.gap + INTO) } : null), lay);
      // The kerb stones of the widened carriageway, where the paving draws no kerb of its own.
      runsOf(side, (s) => (full(s) && !s.hit!.kerbed ? { edge: along(s.edge, s.dir, s.hit!.gap - KERB_STONE), out: along(s.edge, s.dir, s.hit!.gap + INTO) } : null), lay);
    }
  }
  return { fills, widened };
};

/**
 * The zebras at the crossing nodes (`crossingBand`'s four corners, across the road from the
 * second corner to the third) reaching on over the widened carriageways to their new kerbs: each
 * end moved out as far as its middle stays on one of `roads`' rings.
 */
export const stretchZebras = <B extends Band>(zebras: readonly B[], roads: readonly (readonly Pt[])[]): B[] => {
  const rings = roads.map((ring) => ({ ring, box: ringBounds(ring) }));
  const onRoad = (p: Pt) => rings.some((r) => inBox(p, r.box) && pointInRing(p, r.ring));
  return zebras.map((z) => {
    if (z.ring.length !== 4 || rings.length === 0) return z;
    const [c0, c1, c2, c3] = z.ring as [Pt, Pt, Pt, Pt];
    const len = Math.hypot(c2.x - c1.x, c2.z - c1.z) || 1;
    const dir = { x: (c2.x - c1.x) / len, z: (c2.z - c1.z) / len };
    const reach = (from: Pt, d: Pt): number => {
      let t = 0;
      while (t < ZEBRA_REACH && onRoad(along(from, d, t + ACROSS / 2))) t += ACROSS / 2;
      return t;
    };
    const back = { x: -dir.x, z: -dir.z };
    const low = reach({ x: (c0.x + c1.x) / 2, z: (c0.z + c1.z) / 2 }, back);
    const high = reach({ x: (c2.x + c3.x) / 2, z: (c2.z + c3.z) / 2 }, dir);
    if (low === 0 && high === 0) return z;
    return { ...z, ring: [along(c0, back, low), along(c1, back, low), along(c2, dir, high), along(c3, dir, high)] };
  });
};
