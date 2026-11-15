/**
 * The rows of bollards along the kerbs of the town's centre (G-820, T-303, the user's decision of
 * 15.11): Lublin's cast-iron posts with their chains stand along every bigger street of Śródmieście
 * and the whole of Krakowskie Przedmieście, where OSM maps only some (368 nodes, 16 ways). The rule
 * walks the kerbs `props-kerb-lines.ts` gives, `KERB_SET` out on the pavement, once the plan's
 * furniture stands (its lamps, trees and OSM's bollards are known):
 *
 * - a post stands only on the pavement (no carriageway, lawn, steps or building), out of the town
 *   walls, and the row breaks where people or cars cross the kerb: a zebra's band with `CROSSING_ROOM`
 *   either side; a drive, a footway, a pedestrian or living street or a passage meeting the kerb
 *   (`MOUTH_ROOM` past half its width); a gate behind the kerb; a junction, `CORNER` metres past
 *   the other street's carriageway (the tangent of the corner's curve); a bus stop over `STOP_REACH`
 *   either way of its post (a platform and 5 m); a taxi rank and a car park along the kerb; a tree
 *   or a solid piece in the row (a bench, a kiosk, a café's garden in it);
 * - the posts stand evenly between the breaks, about `SPACING` apart, the first and the last
 *   `GAP_INSET` off a break; a lamp, a trolley pole or a bollard of OSM standing in the row is one
 *   of its posts (its chain hangs on it, G-032), and a rule post within `NODE_ROOM` of an OSM
 *   bollard gives way to it;
 * - the chains hang only where the pavement behind the row is `WIDE` or more to the nearest wall,
 *   fence or hedge, or the row borders a square; on a narrower one, or a street steeper than
 *   `STEEP`, the posts stand closer, `BARE_SPACING` apart, with no chain (Wyszyńskiego, GSV 2025).
 */
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type CrossingBand, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { BOLLARD, POLE_SHAFT, distanceToPiece, furnitureRadius } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, pointInRing } from "./geometry.ts";
import { type KerbLine, type KerbSample, LEAST_HALF, STEP, inRowArea, kerbLines, onGround } from "./props-kerb-lines.ts";
import type { Site } from "./props-site.ts";

/** Spacing of a row with chains, its range, and of a row without (m). */
export const SPACING = 1.8;
export const BARE_SPACING = 1.4;
/** The first and last post of a row stand this far off a break (m). */
export const GAP_INSET = 0.5;
/** Room either side of a zebra's band, past a mouth's half width, and past a junction's carriageway (m). */
export const CROSSING_ROOM = 0.5;
export const MOUTH_ROOM = 0.5;
export const CORNER = 2.5;
/** A bus stop's platform and 5 m either way of its post (m), on its kerb within `STOP_SIDE` of the post. */
export const STOP_REACH = 11;
export const STOP_SIDE = 6;
/** A pole or a bollard this near the row's line is one of its posts (m); a rule post this near an OSM bollard gives way to it. */
export const ANCHOR_REACH = 0.6;
export const NODE_ROOM = 1;
/** The pavement behind a row with chains, kerb to wall (m), and the steepest street with chains. */
export const WIDE = 3;
export const STEEP = 0.06;
/** A stretch of one look shorter than this takes its neighbour's (m): no chain coming and going. */
const LOOK_MIN = 6;
/** The least angle of a way to the kerb for it to meet it (a footway along the pavement is no mouth). */
const MOUTH_ANGLE = Math.sin((30 * Math.PI) / 180);

/** What the rule needs beyond the chunks: the taxi ranks of OSM as rings. */
export interface KerbRuleContext {
  readonly taxis?: readonly (readonly Pt[])[];
}

/** A post of the rule: its spot, its key, and whether it holds no chain. */
export interface KerbPost {
  readonly p: Pt;
  readonly key: string;
  readonly bare: boolean;
}

export interface KerbRowStats {
  readonly posts: number;
  readonly bare: number;
  /** Metres of row with chains and without. */
  readonly metres: number;
  readonly bareMetres: number;
}

interface Way {
  readonly a: Pt;
  readonly b: Pt;
  readonly room: number;
}

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const toSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

const crosses = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

const segmentHash = (ways: readonly Way[], cell = 8): SpatialHash<Way> => {
  const h = new SpatialHash<Way>(cell);
  for (const w of ways) h.insert(w, Math.min(w.a.x, w.b.x) - w.room, Math.min(w.a.z, w.b.z) - w.room, Math.max(w.a.x, w.b.x) + w.room, Math.max(w.a.z, w.b.z) + w.room);
  return h;
};

const segmentsOf = (pts: readonly Pt[], room: number): Way[] => pts.slice(1).map((b, k) => ({ a: pts[k]!, b, room }));

/** The ways meeting a kerb, each segment with the room its mouth keeps (half its width and `MOUTH_ROOM`). */
export const mouthWays = (chunks: readonly LublinChunkData[]): Way[] =>
  chunks.flatMap((c) => [
    ...(c.serviceWays ?? []).flatMap((w) => segmentsOf(flat(w.line), w.width / 2 + MOUTH_ROOM)),
    ...(c.footWays ?? []).flatMap((w) => segmentsOf(flat(w.line), w.width / 2 + MOUTH_ROOM)),
    ...c.streets.filter((s) => MOUTH_STREETS.has(s.kind)).flatMap((s) => segmentsOf(flat(s.line), widthOf(s.half) / 2 + MOUTH_ROOM)),
    // A passage's axis runs a little past its facades: on over the pavement to the kerb.
    ...(c.passages ?? []).flatMap((p) => segmentsOf(longer(p.from, p.to, 6), p.width / 2 + MOUTH_ROOM)),
    // A gate's span: the way through it runs square to it, over the pavement in front.
    ...(c.barriers ?? []).filter((b) => b.kind === "gate" || b.kind === "lift-gate").flatMap((b) => gateWay(flat(b.line))),
  ]);

/** The streets whose mouths break a row: every way of the chunks' streets but the car streets lined themselves. */
const MOUTH_STREETS: ReadonlySet<string> = new Set(["service", "pedestrian", "living_street", "footway", "path", "steps", "cycleway"]);

const widthOf = (half: readonly number[] | undefined): number => {
  if (!half || half.length < 2) return 4;
  let w = 0;
  for (let i = 0; i + 1 < half.length; i += 2) w = Math.max(w, half[i]! + half[i + 1]!);
  return w > 0 ? w : 4;
};

const longer = (a: Pt, b: Pt, by: number): Pt[] => {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  return [
    { x: a.x - u.x * by, z: a.z - u.z * by },
    { x: b.x + u.x * by, z: b.z + u.z * by },
  ];
};

const gateWay = (span: readonly Pt[]): Way[] => {
  if (span.length < 2) return [];
  const [a, b] = [span[0]!, span[span.length - 1]!];
  const l = Math.hypot(b.x - a.x, b.z - a.z);
  if (l < 0.5) return [];
  const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
  return [{ a: { x: m.x - n.x * 8, z: m.z - n.z * 8 }, b: { x: m.x + n.x * 8, z: m.z + n.z * 8 }, room: l / 2 + MOUTH_ROOM }];
};

/** The pieces placed so far the rule reads: poles, trees and other solids, and the bollards. */
interface Placed {
  readonly poles: SpatialHash<StreetPropItem>;
  readonly solids: SpatialHash<StreetPropItem>;
  readonly posts: SpatialHash<Pt>;
}

const placedOf = (items: readonly StreetPropItem[]): Placed => {
  const poles = new SpatialHash<StreetPropItem>(4);
  const solids = new SpatialHash<StreetPropItem>(4);
  const posts = new SpatialHash<Pt>(4);
  for (const i of items) {
    if (i.prop === "bollard") posts.insertPoint({ x: i.x, z: i.z }, i.x, i.z);
    else if (i.prop === "manhole") continue;
    else if (POLE_SHAFT[i.prop] !== undefined) poles.insertPoint(i, i.x, i.z);
    else {
      const r = furnitureRadius(i);
      if (r > 0) solids.insert(i, i.x - r, i.z - r, i.x + r, i.z + r);
    }
  }
  return { poles, solids, posts };
};

/** Everything the rule reads, indexed once. */
interface World {
  readonly site: Site;
  readonly bands: readonly CrossingBand[];
  readonly mouths: SpatialHash<Way>;
  readonly walls: SpatialHash<Way>;
  readonly squares: readonly (readonly Pt[])[];
  readonly stops: readonly Pt[];
  readonly taxis: readonly (readonly Pt[])[];
  readonly placed: Placed;
}

/** Why no post stands at a sample (null: one may); "road" is the carriageway of another street, a junction. */
export const gapAt = (w: World, s: KerbSample, along: Pt): string | null => {
  const { p } = s;
  if (s.half < LEAST_HALF || !inRowArea(p)) return "off";
  const surface = w.site.surfaceAt(p);
  if (surface === "road") return "road";
  if (surface !== "walk" || w.site.onSteps(p)) return "ground";
  if (w.bands.some((b) => inCrossingBand(b, p, CROSSING_ROOM + BOLLARD.radius))) return "crossing";
  if (w.mouths.at(p.x, p.z).some((m) => toSegment(p, m.a, m.b) < m.room && meets(m, along))) return "mouth";
  const inner = { x: s.kerb.x - s.out.x * 0.5, z: s.kerb.z - s.out.z * 0.5 };
  if (w.site.inKerbPark(inner) || w.site.inKerbPark(p)) return "parking";
  if (w.taxis.some((r) => pointInRing(p, r) || pointInRing(inner, r))) return "taxi";
  for (const o of w.placed.solids.queryRadius(p.x, p.z, 1)) {
    const room = o.prop === "tree" ? GAP_INSET + 0.3 : 0.25;
    if (distanceToPiece(o, p.x, p.z) < room) return o.prop === "tree" ? "tree" : "solid";
  }
  return null;
};

const meets = (m: Way, along: Pt): boolean => {
  const l = Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) || 1;
  return Math.abs(((m.b.x - m.a.x) * along.z - (m.b.z - m.a.z) * along.x) / l) >= MOUTH_ANGLE;
};

/** How far the pavement reaches from the kerb out to a wall, a fence or a hedge, up to `WIDE` (m). */
const pavementAt = (w: World, s: KerbSample): number => {
  const far = { x: s.kerb.x + s.out.x * WIDE, z: s.kerb.z + s.out.z * WIDE };
  let best = WIDE;
  for (const b of w.walls.query(Math.min(s.kerb.x, far.x), Math.min(s.kerb.z, far.z), Math.max(s.kerb.x, far.x), Math.max(s.kerb.z, far.z)))
    if (crosses(s.kerb, far, b.a, b.b)) best = Math.min(best, toSegment(s.kerb, b.a, b.b));
  for (let d = 0.5; d < best; d += 0.25) {
    const q = { x: s.kerb.x + s.out.x * d, z: s.kerb.z + s.out.z * d };
    const surface = w.site.surfaceAt(q);
    if (surface === "building" || surface === "water" || surface === "rail") return d;
  }
  return best;
};

const bySquare = (w: World, s: KerbSample): boolean =>
  [1, 2.5].some((d) => {
    const q = { x: s.kerb.x + s.out.x * d, z: s.kerb.z + s.out.z * d };
    return w.squares.some((r) => pointInRing(q, r));
  });

/** Does a sample's row hang chains: a wide pavement behind it or a square, on a street not too steep? */
const chainedAt = (w: World, samples: readonly KerbSample[], i: number): boolean => {
  const s = samples[i]!;
  const [a, b] = [samples[Math.max(0, i - 8)]!, samples[Math.min(samples.length - 1, i + 8)]!];
  const run = b.arc - a.arc;
  const steep = run > 1 && Math.abs(w.site.heightAt(b.p) - w.site.heightAt(a.p)) / run > STEEP;
  return !steep && (bySquare(w, s) || pavementAt(w, s) >= WIDE);
};

/** The direction of a line at sample i. */
const alongAt = (samples: readonly KerbSample[], i: number): Pt => {
  const [a, b] = [samples[Math.max(0, i - 1)]!, samples[Math.min(samples.length - 1, i + 1)]!];
  const l = Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z) || 1;
  return { x: (b.p.x - a.p.x) / l, z: (b.p.z - a.p.z) / l };
};

/** The samples' gaps, a junction's grown `CORNER` along the line past the other carriageway. */
const gapsOf = (w: World, samples: readonly KerbSample[]): (string | null)[] => {
  const gaps = samples.map((s, i) => gapAt(w, s, alongAt(samples, i)));
  const grown = [...gaps];
  samples.forEach((s, i) => {
    if (gaps[i] !== "road") return;
    for (let j = i - 1; j >= 0 && s.arc - samples[j]!.arc <= CORNER; j--) grown[j] ??= "corner";
    for (let j = i + 1; j < samples.length && samples[j]!.arc - s.arc <= CORNER; j++) grown[j] ??= "corner";
  });
  return grown;
};

/** The point at `arc` along the samples. */
const pointAt = (samples: readonly KerbSample[], arc: number): Pt => {
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.arc <= arc) lo = mid;
    else hi = mid;
  }
  const [a, b] = [samples[lo]!, samples[hi]!];
  const t = b.arc > a.arc ? Math.max(0, Math.min(1, (arc - a.arc) / (b.arc - a.arc))) : 0;
  return { x: a.p.x + (b.p.x - a.p.x) * t, z: a.p.z + (b.p.z - a.p.z) * t };
};

/** An end of a stretch: a break (the post `GAP_INSET` in), an anchor (a post already there), or a change of look (half a spacing in). */
type End = { readonly arc: number; readonly kind: "gap" | "anchor" | "look" };

/** The arcs of a stretch's posts between its ends, evenly about `spacing` apart. */
export const stretchPosts = (from: End, to: End, spacing: number): number[] => {
  const inset = (e: End) => (e.kind === "gap" ? GAP_INSET : e.kind === "look" ? spacing / 2 : 0);
  const a = from.arc + inset(from);
  const b = to.arc - inset(to);
  const len = b - a;
  if (len < -1e-9) return [];
  const n = Math.max(1, Math.round(len / spacing));
  const out: number[] = [];
  for (let k = from.kind === "anchor" ? 1 : 0; k <= (to.kind === "anchor" ? n - 1 : n); k++) out.push(a + (len * k) / n);
  // A stretch with room for one post keeps it, in its middle.
  return len < spacing / 2 && out.length > 1 ? [(a + b) / 2] : out;
};

/** The world the rule reads from the chunks, the pieces placed so far and the context. */
export const ruleWorld = (site: Site, chunks: readonly LublinChunkData[], items: readonly StreetPropItem[], bands: readonly CrossingBand[], ctx: KerbRuleContext = {}): World => {
  const stops = new Map<string, Pt>();
  for (const c of chunks) for (const p of flat(c.busStops ?? [])) stops.set(`${p.x},${p.z}`, p);
  const walls = chunks.flatMap((c) => (c.barriers ?? []).filter((b) => b.kind !== "gate" && b.kind !== "lift-gate").flatMap((b) => segmentsOf(flat(b.line), 0)));
  return {
    site,
    bands,
    mouths: segmentHash(mouthWays(chunks)),
    walls: segmentHash(walls),
    squares: chunks.flatMap((c) => (c.walkAreas ?? []).filter((a) => a.surface === "square").map((a) => flat(a.outline))),
    stops: [...stops.values()],
    taxis: ctx.taxis ?? [],
    placed: placedOf(items),
  };
};

/** The samples of each line by a bus stop's post (the line nearest it, within `STOP_SIDE`), `STOP_REACH` either way of it. */
const byStops = (lines: readonly KerbLine[], stops: readonly Pt[]): Set<KerbSample> => {
  const out = new Set<KerbSample>();
  for (const stop of stops) {
    let best: { l: KerbLine; i: number; d: number } | null = null;
    for (const l of lines)
      l.samples.forEach((s, i) => {
        const d = Math.hypot(s.p.x - stop.x, s.p.z - stop.z);
        if (d < STOP_SIDE && (best === null || d < best.d)) best = { l, i, d };
      });
    if (best === null) continue;
    const { l, i } = best as { l: KerbLine; i: number };
    const at = l.samples[i]!.arc;
    for (const s of l.samples) if (Math.abs(s.arc - at) <= STOP_REACH) out.add(s);
  }
  return out;
};

/** The arcs along a line of the poles and OSM's bollards standing in its row, each at the sample nearest it. */
const anchorsOf = (w: World, samples: readonly KerbSample[], gaps: readonly (string | null)[]): Map<number, number> => {
  const best = new Map<Pt | StreetPropItem, { i: number; d: number }>();
  samples.forEach((s, i) => {
    if (gaps[i] !== null) return;
    const near = [...w.placed.poles.queryRadius(s.p.x, s.p.z, ANCHOR_REACH), ...w.placed.posts.queryRadius(s.p.x, s.p.z, ANCHOR_REACH)];
    for (const o of near) {
      const d = Math.hypot(o.x - s.p.x, o.z - s.p.z);
      if (d <= ANCHOR_REACH && d < (best.get(o)?.d ?? Infinity)) best.set(o, { i, d });
    }
  });
  return new Map([...best.values()].map(({ i }) => [i, samples[i]!.arc]));
};

/** The looks of the samples a post may stand on (true: chains), a stretch shorter than `LOOK_MIN` taking the one before it. */
const looksOf = (w: World, samples: readonly KerbSample[], gaps: readonly (string | null)[]): (boolean | null)[] => {
  const looks: (boolean | null)[] = samples.map((_, i) => (gaps[i] === null ? chainedAt(w, samples, i) : null));
  let from = 0;
  for (let i = 1; i <= samples.length; i++) {
    if (i < samples.length && looks[i] === looks[from]) continue;
    const fill = (from > 0 ? looks[from - 1] : null) ?? (i < samples.length ? looks[i] : null) ?? null;
    if (looks[from] !== null && fill !== null && samples[i - 1]!.arc - samples[from]!.arc < LOOK_MIN) for (let k = from; k < i; k++) looks[k] = fill;
    from = i;
  }
  return looks;
};

/** One line's posts: its stretches between breaks, anchors and changes of look, each evenly. */
const linePosts = (line: KerbLine, looks: readonly (boolean | null)[], anchors: ReadonlyMap<number, number>, out: KerbPost[], stats: { metres: number; bareMetres: number }): void => {
  const { samples } = line;
  let start: End | null = null;
  const close = (end: End, look: boolean) => {
    if (!start) return;
    for (const arc of stretchPosts(start, end, look ? SPACING : BARE_SPACING)) out.push({ p: pointAt(samples, arc), key: `kb:${line.id}@${arc.toFixed(1)}`, bare: !look });
    if (look) stats.metres += Math.max(0, end.arc - start.arc);
    else stats.bareMetres += Math.max(0, end.arc - start.arc);
  };
  samples.forEach((s, i) => {
    const look = looks[i] ?? null;
    if (look === null) {
      if (i > 0) close({ arc: samples[i - 1]!.arc, kind: "gap" }, looks[i - 1] === true);
      start = null;
      return;
    }
    if (!start) start = { arc: s.arc, kind: "gap" };
    else if (looks[i - 1] !== look) {
      const at = (samples[i - 1]!.arc + s.arc) / 2;
      close({ arc: at, kind: "look" }, looks[i - 1] === true);
      start = { arc: at, kind: "look" };
    }
    const anchor = anchors.get(i);
    if (anchor !== undefined) {
      close({ arc: anchor, kind: "anchor" }, look);
      start = { arc: anchor, kind: "anchor" };
    }
  });
  const last = samples.length - 1;
  if (last >= 0) close({ arc: samples[last]!.arc, kind: "gap" }, looks[last] === true);
};

/** The rule's kerbs on the carriageways' edges as the ground draws them (`onGround`). */
export const groundLines = (site: Site, chunks: readonly LublinChunkData[]): KerbLine[] => kerbLines(chunks).map((l) => ({ ...l, samples: onGround(l.samples, (p) => site.surfaceAt(p) === "road") }));

/** Why each sample of the lines has no post (null: one may stand there), a bus stop's kerb with the rest. */
export const lineGaps = (w: World, lines: readonly KerbLine[]): (string | null)[][] => {
  const stopped = byStops(lines, w.stops);
  return lines.map((line) => gapsOf(w, line.samples).map((g, i) => g ?? (stopped.has(line.samples[i]!) ? "stop" : null)));
};

/**
 * The rule's posts along the kerbs of the chunks (G-820), round the pieces `items` placed so far:
 * each clear of OSM's bollards by `NODE_ROOM` and of the posts before it, on a chunk; with the rows' lengths.
 */
export const kerbBollards = (site: Site, chunks: readonly LublinChunkData[], items: readonly StreetPropItem[], bands: readonly CrossingBand[], ctx: KerbRuleContext = {}): { posts: KerbPost[]; stats: KerbRowStats } => {
  const w = ruleWorld(site, chunks, items, bands, ctx);
  const lines = groundLines(site, chunks);
  const gaps = lineGaps(w, lines);
  const lengths = { metres: 0, bareMetres: 0 };
  const raw: KerbPost[] = [];
  lines.forEach((line, k) => linePosts(line, looksOf(w, line.samples, gaps[k]!), anchorsOf(w, line.samples, gaps[k]!), raw, lengths));
  const kept = new SpatialHash<Pt>(4);
  const near = (h: SpatialHash<Pt>, p: Pt) => h.queryRadius(p.x, p.z, NODE_ROOM).some((q) => Math.hypot(q.x - p.x, q.z - p.z) < NODE_ROOM - 1e-9);
  const posts = raw.filter((k) => {
    if (!site.chunkAt(k.p) || near(w.placed.posts, k.p) || near(kept, k.p)) return false;
    kept.insertPoint(k.p, k.p.x, k.p.z);
    return true;
  });
  return { posts, stats: { posts: posts.length, bare: posts.filter((k) => k.bare).length, metres: Math.round(lengths.metres), bareMetres: Math.round(lengths.bareMetres) } };
};
