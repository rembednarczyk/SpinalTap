/**
 * The street lamps by OSM's `lit` tag (ADR-0064 stage 3, G-798): every way OSM tags `lit=yes` gets
 * lamps along it, by its class, where no lamp stands near. The lamps stood on the plan's hand-drawn
 * lines of 29.10 alone and the import read no `lit`, so the ways drawn into the map after it (the
 * strip of Krakowskie south of z = −200, the paths of the castle hill) stayed dark at night.
 *
 * - The OSM street lamps (`highway=street_lamp` of `data/osm/points/furniture.json`) the plan does
 *   not hold stand where the map has them (`osm.street-lamps`) and light the stretch round them.
 * - The plan's lines of plain road lamps (`lamp-road`) lying on lit car streets give way to the rule
 *   (`yieldToRule`): it lamps those streets by their class in the same look, with the medians of the
 *   plan's lines on that class for spacing and sides.
 * - The plan's styled lines (the deptak's pastorals, Plac Zamkowy's candelabra, Plac Litewski's poles,
 *   the Old Town's wall lanterns, the park lamps) are the city's own looks and stay, as do the road
 *   lamp lines on ways OSM does not tag lit; a lit way a styled line lies on takes the rest of its
 *   lamps in that look, so one street keeps one look (G-266).
 * - A way is lamped where it runs further than `COVER` (`CAR_COVER` for a car street) from every lamp
 *   line and lamp point before it: car streets first, then pedestrian streets, then paths, by OSM id.
 *   A second pass (`litFillItems`, after the furniture stands) lamps what is still dark.
 * The placement is the plan's (`props-gen`): at the kerb or beside the path, off the carriageway, the
 * steps, the buildings and the trees' crowns, a lamp of a kind within 7 m of another merged.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { DISTRICTS } from "./config.ts";
import type { FurniturePoint } from "./furniture.ts";
import { type Pt, pointInRing } from "./geometry.ts";
import { OLD_TOWN_RING } from "./old-town.ts";
import type { Tags } from "./osm.ts";
import type { PlanItem, PropsPlan } from "./props-gen.ts";
import { propOf } from "./props-kinds.ts";
import { mostlyInside } from "./courtyards.ts";
import { type Kerbs, bothSides, facing } from "./props-lit-sides.ts";

/** A way of the map with its tags and its points in the world. */
export interface LitWay {
  readonly id: number;
  readonly tags: Tags;
  readonly pts: readonly Pt[];
  /**
   * A courtyard's square (`courtyards.ts`), lit from its facades: wall lanterns round it, no lamp on a
   * post (Dziedziniec Zamkowy); or a way lying in one, which the facades' lanterns light.
   */
  readonly court?: "square" | "inside";
  /** Its separately mapped sidewalks (`props-lit-sides.ts`): a side street's lamps on both its sides or one. */
  readonly kerbs?: Kerbs;
}

/** Ways OSM tags lit that light nothing yet: being built or only planned. */
const NOT_BUILT: ReadonlySet<string> = new Set(["construction", "proposed", "abandoned", "razed"]);

/** Whether a way is one OSM lights: `lit=yes`, a highway in use, not underground or roofed over. */
export const isLitWay = (tags: Tags | undefined): boolean =>
  tags?.lit === "yes" && tags.highway !== undefined && !NOT_BUILT.has(tags.highway) && (tags.tunnel === undefined || tags.tunnel === "no") && tags.covered !== "yes" && tags.indoor !== "yes";

/** How a class of ways is lamped: the lamp's kind, the spacing along the way (m) and on how many sides. */
export interface LampLine {
  readonly kind: StreetPropKind;
  readonly spacing: number;
  readonly sides: 1 | 2;
}

/** The main streets: the plan's lines on primary and secondary roads (Aleja Tysiąclecia, Nabrzeże's 2.3 km) are road lamps 35 m apart on both sides. */
const MAIN: LampLine = { kind: "lamp-road", spacing: 35, sides: 2 };
/** The side streets: the plan's lines on tertiary and residential streets (Krakowskie, Podzamcze, the Old Town's edges) are road lamps every 30 m on one side. */
const SIDE: LampLine = { kind: "lamp-road", spacing: 30, sides: 1 };
/** A side street with sidewalks far apart (`bothSides`, G-804): road lamps on both kerbs, 34 m apart on each as Narutowicza's (orthophoto 2025-04). */
const WIDE: LampLine = { kind: "lamp-road", spacing: 34, sides: 2 };
/** The pedestrian streets: the plan's lines on them are 25 m apart on both sides; its plain kind is Plac Litewski's pole. */
const WALK: LampLine = { kind: "lamp-modern-pole", spacing: 25, sides: 2 };
/** The footways and paths: the plan's park lamps by the river, 30 m apart beside the path. */
const PATH: LampLine = { kind: "lamp-park", spacing: 30, sides: 1 };

const CLASSES: Readonly<Record<string, LampLine>> = {
  trunk: MAIN,
  primary: MAIN,
  secondary: MAIN,
  trunk_link: SIDE,
  primary_link: SIDE,
  secondary_link: SIDE,
  tertiary: SIDE,
  tertiary_link: SIDE,
  residential: SIDE,
  unclassified: SIDE,
  living_street: SIDE,
  service: SIDE,
  pedestrian: WALK,
  footway: PATH,
  path: PATH,
  cycleway: PATH,
  bridleway: PATH,
  track: PATH,
  steps: PATH,
};

/** The class of a lit way, or null: a crossing (the street's own lamps light it), a kind no lamp stands by. */
export const lampLineOf = (tags: Tags): LampLine | null => {
  if (tags.footway === "crossing" || tags.cycleway === "crossing" || tags.path === "crossing") return null;
  // A square mapped as an area: its lamps go round its edge, beside it, as along a path.
  if (tags.area === "yes") return PATH;
  return CLASSES[tags.highway ?? ""] ?? null;
};

/** Inside the walls the city's lamps are styled (G-264): the free-standing one is the pastoral. */
const lookAt = (line: LampLine, p: Pt): LampLine => (pointInRing(p, OLD_TOWN_RING) ? { ...line, kind: "lamp-pastoral" } : line);

/** How far from a lamp line or a lamp a way counts as lit (m): a lamp lights some 15 m round, a row 30 m apart lights a way 20 m off it within the scan's 30 m. */
export const COVER = 18;
/**
 * How near a lamp line a car street counts as lit (m): only by a line on its own carriageway. The
 * other carriageway of a dual one (Mełgiewska, Andersa, Aleja Tysiąclecia) lies 10–20 m off, within
 * `COVER`, and its outer kerb would stay without the lamps the plan's lines gave it.
 */
export const CAR_COVER = 6;
/** How near a lit way a line of the plan lies to be on it (m): the plan's lines are the streets' axes. */
export const ON_WAY = 4;
/** The share of a plan's line on lit car streets for the rule to take it over. */
export const YIELD_SHARE = 0.9;
/** How far from the placed lamps a lit way still counts as dark in the second pass (m): short of the scan's 30 m by a lamp's slide along its line. */
export const FILL_REACH = 25;
/**
 * How far the rule's lamps keep from a car street's axis (m): past the nearest lanes the traffic
 * drives (1.2 m out, sim `laneOffset`) by a road lamp's solid (0.27 m to its corner), the 0.9 m the
 * scan keeps (`furniture-in-car-lane`) and 0.13 m to spare. Where the map's pavement runs into the
 * carriageway the kerb found lies nearer: Staszica's lamps at 2.24 and 2.38 m stood in its lane.
 */
export const KEEP_OFF = 2.5;
/** The step a way is walked in (m). */
const STEP = 2.5;
/** The side of the grid cells of `LampIndex` (m). */
const CELL = 20;
/** The plan's kinds whose lines give way to the rule on lit car streets: the plain road lamp, which the rule sets in the same look. */
const YIELDING: ReadonlySet<string> = new Set(["lamp-road"]);
/** The class order the ways are lamped in: car streets, pedestrian streets and courtyards, paths. */
const RANK: Readonly<Record<string, number>> = { "lamp-road": 0, "lamp-modern-pole": 1, "lamp-wall-lantern": 1, "lamp-park": 2 };

/** The kinds of the plan that light: the lamps and the kinds drawn as one. */
const isLamp = (kind: string): boolean => propOf(kind)?.startsWith("lamp-") ?? false;

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};
const linesOf = (item: PlanItem): (readonly number[])[] => [...(item.line ? [item.line] : []), ...(item.lines ?? [])];
const r1 = (v: number): number => Math.round(v * 10) / 10 + 0;
const lengthOf = (l: readonly Pt[]): number => l.slice(1).reduce((s, b, i) => s + Math.hypot(b.x - l[i]!.x, b.z - l[i]!.z), 0);
const inMap = (p: Pt): boolean => DISTRICTS.some(({ rect: r }) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);

/** The points of a polyline every `STEP` metres or less, its vertices among them. */
export const densify = (pts: readonly Pt[], step = STEP): Pt[] => {
  const out: Pt[] = pts.length > 0 ? [pts[0]!] : [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
};

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

/** Lamp lines (segments) and lamp points (a segment from a point to itself) on a grid, asked for the nearest. */
class LampIndex<T> {
  private readonly cells = new Map<string, { a: Pt; b: Pt; tag: T }[]>();

  add(a: Pt, b: Pt, tag: T): void {
    for (let i = Math.floor(Math.min(a.x, b.x) / CELL); i <= Math.floor(Math.max(a.x, b.x) / CELL); i++)
      for (let j = Math.floor(Math.min(a.z, b.z) / CELL); j <= Math.floor(Math.max(a.z, b.z) / CELL); j++) {
        const k = `${i},${j}`;
        const list = this.cells.get(k);
        if (list) list.push({ a, b, tag });
        else this.cells.set(k, [{ a, b, tag }]);
      }
  }

  addLine(pts: readonly Pt[], tag: T): void {
    for (let i = 1; i < pts.length; i++) this.add(pts[i - 1]!, pts[i]!, tag);
  }

  /** Every segment's tag within `r` of `p`. */
  within(p: Pt, r: number): T[] {
    const out: T[] = [];
    for (let i = Math.floor((p.x - r) / CELL); i <= Math.floor((p.x + r) / CELL); i++)
      for (let j = Math.floor((p.z - r) / CELL); j <= Math.floor((p.z + r) / CELL); j++) for (const s of this.cells.get(`${i},${j}`) ?? []) if (segGap(p, s.a, s.b) <= r) out.push(s.tag);
    return out;
  }

  /** The nearest segment within `r` of `p`, with its distance, or null. */
  nearest(p: Pt, r: number): { d: number; tag: T } | null {
    let best: { d: number; tag: T } | null = null;
    for (let i = Math.floor((p.x - r) / CELL); i <= Math.floor((p.x + r) / CELL); i++)
      for (let j = Math.floor((p.z - r) / CELL); j <= Math.floor((p.z + r) / CELL); j++)
        for (const s of this.cells.get(`${i},${j}`) ?? []) {
          const d = segGap(p, s.a, s.b);
          if (d <= r && (best === null || d < best.d)) best = { d, tag: s.tag };
        }
    return best;
  }
}

/** The share of a polyline's points within `ON_WAY` of a lit car street. */
const shareOnStreets = (line: readonly Pt[], streets: LampIndex<true>): number => {
  const pts = densify(line);
  return pts.length === 0 ? 0 : pts.filter((p) => streets.nearest(p, ON_WAY) !== null).length / pts.length;
};

/**
 * The plan with its plain road lamp lines on lit car streets taken out (the rule lamps those
 * streets), and the lines taken, `group#k` by the line's index in its group. A group keeps its
 * other lines, and the share of its count they hold. `oneSided`: the taken lines of one side, whose
 * left is the kerb the plan lit (G-804).
 */
export const yieldToRule = (plan: PropsPlan, ways: readonly LitWay[]): { plan: PropsPlan; yielded: string[]; oneSided: Pt[][] } => {
  const streets = new LampIndex<true>();
  for (const w of ways) if (isLitWay(w.tags) && lampLineOf(w.tags)?.kind === "lamp-road") streets.addLine(w.pts, true);
  const yielded: string[] = [];
  const oneSided: Pt[][] = [];
  const items = plan.items.flatMap((item): PlanItem[] => {
    if (!YIELDING.has(item.kind) || item.spacing === undefined) return [item];
    const all = linesOf(item);
    const kept = all.filter((l, k) => {
      const taken = shareOnStreets(flat(l), streets) >= YIELD_SHARE;
      if (taken) yielded.push(`${item.id}#${k}`);
      if (taken && !(item.note ?? "").includes("obu stronach")) oneSided.push(flat(l));
      return !taken;
    });
    if (kept.length === all.length) return [item];
    if (kept.length === 0) return [];
    const { line: _line, lines: _lines, ...rest } = item;
    const share = kept.reduce((s, l) => s + lengthOf(flat(l)), 0) / all.reduce((s, l) => s + lengthOf(flat(l)), 0);
    return [{ ...rest, lines: kept, ...(item.count === undefined ? {} : { count: Math.round(item.count * share) }) }];
  });
  return { plan: { ...plan, items }, yielded, oneSided };
};

/** The OSM street lamps the plan's groups do not hold by node id, as a group of their own (`street-lamp`: road lamps, pastorals inside the walls). */
export const osmLampItems = (plan: PropsPlan, points: readonly FurniturePoint[]): PlanItem[] => {
  const held = new Set(plan.items.flatMap((i) => (i.osm === undefined ? [] : typeof i.osm === "string" ? [i.osm] : i.osm)));
  const lamps = points.filter((f) => f.tag === "highway=street_lamp" && !held.has(f.id) && inMap(f.p));
  if (lamps.length === 0) return [];
  const note = "From data/osm/points/furniture.json (pnpm osm:fetch): highway=street_lamp nodes the plan lacks (G-798).";
  return [{ id: "osm.street-lamps", kind: "street-lamp", inOsm: true, points: lamps.map((f) => [r1(f.p.x), r1(f.p.z)] as [number, number]), osm: lamps.map((f) => f.id), count: lamps.length, note }];
};

/** The plan's lamps: lines with their look, points (OSM's lamps, single lamps) with none. */
const planLamps = (plan: PropsPlan): LampIndex<LampLine | null> => {
  const idx = new LampIndex<LampLine | null>();
  for (const item of plan.items) {
    const prop = propOf(item.kind);
    if (!prop || !isLamp(item.kind)) continue;
    // A line with a count and no spacing (the castle stairs' candelabra, beside the path) lights, but gives no look a rule's line could walk.
    const look: LampLine | null = item.spacing === undefined ? null : { kind: prop, spacing: item.spacing, sides: (item.note ?? "").includes("obu stronach") ? 2 : 1 };
    for (const l of linesOf(item)) idx.addLine(flat(l), look);
    for (const [x, z] of item.points ?? []) idx.add({ x, z }, { x, z }, null);
    if (item.position) idx.add(item.position, item.position, null);
  }
  return idx;
};

/** The kinds of the city's styled lamps (G-259), and the free-standing one a way beside them takes. */
const STYLED: ReadonlySet<StreetPropKind> = new Set(["lamp-pastoral", "lamp-candelabra", "lamp-wall-lantern"]);
/**
 * The free-standing lamp a way beside styled ones takes: the pastoral, Lublin's lamp of its old
 * streets. The candelabrum is Plac Zamkowy's own, its look not carried onto the streets round it
 * (Podwale, lit by pastorals: the review of G-798).
 */
const FREE_STANDING: Partial<Record<StreetPropKind, StreetPropKind>> = { "lamp-wall-lantern": "lamp-pastoral", "lamp-candelabra": "lamp-pastoral" };
/** A courtyard's look: lanterns on the facades round it, every 15 m as the Old Town's (`lamps.stare-miasto-wall`). */
const COURT: LampLine = { kind: "lamp-wall-lantern", spacing: 15, sides: 2 };
/**
 * How near a way a styled line of the plan makes it styled (m): the scan's 8 m round a way's axis
 * (`lamp-style-change-on-way`) and a lamp's offset from its line, the wall lanterns' 4 m out on the
 * facades. A plain lamp on such a way would stand on one street with the styled ones (G-266).
 */
export const STYLED_NEAR = 12;

/** The share of a way's points beside a styled line for it to take its look: a side street crossing the deptak stays a road lamp's. */
export const STYLED_SHARE = 0.3;

/** The plan's line most of the points lie within `r` of (`least` points at least), of the lines `pick` takes. */
const mostOn = (pts: readonly Pt[], plan: LampIndex<LampLine | null>, r: number, least: number, pick: (l: LampLine) => boolean): LampLine | null => {
  const tally = new Map<LampLine, number>();
  for (const p of pts) {
    const near = plan.nearest(p, r)?.tag;
    if (near && pick(near)) tally.set(near, (tally.get(near) ?? 0) + 1);
  }
  let best: LampLine | null = null;
  for (const [l, n] of tally) if (n >= least && (best === null || n > tally.get(best)!)) best = l;
  return best;
};

/**
 * The look of a way: the plan's plain line most of its points lie on (3 points at least), or a styled
 * one `STYLED_SHARE` of them lie on (3 points of Plac Zamkowy's candelabra at Podwale's end made the
 * whole street candelabra); else a styled line beside `STYLED_SHARE` of a way on foot, as the
 * free-standing lamp of that look with the way's own spacing; else its class's. A car street keeps its road lamps beside the facades' lanterns, as
 * the plan set them on Podwale and Królewska past the walls, and under a park lamp's path drawn
 * along it (the riverside path on Mełgiewska): a park lamp stands beside a path, not at a kerb.
 */
const lookOf = (pts: readonly Pt[], line: LampLine, plan: LampIndex<LampLine | null>): LampLine => {
  const car = line.kind === "lamp-road";
  const least = Math.max(3, pts.length * STYLED_SHARE);
  const on = mostOn(pts, plan, ON_WAY, 3, (l) => !STYLED.has(l.kind) && (!car || l.kind !== "lamp-park")) ?? mostOn(pts, plan, ON_WAY, least, (l) => STYLED.has(l.kind));
  if (on) return on;
  const styled = car ? null : mostOn(pts, plan, STYLED_NEAR, least, (l) => STYLED.has(l.kind));
  if (styled) return { ...line, kind: FREE_STANDING[styled.kind] ?? styled.kind };
  return lookAt(line, pts[Math.floor(pts.length / 2)]!);
};

/** The stretches of a way on the map (index ranges of its points) whose points are all `dark`, 2 points or more. */
const darkSpans = (pts: readonly Pt[], dark: (p: Pt) => boolean): [number, number][] => {
  const spans: [number, number][] = [];
  let from = -1;
  pts.forEach((p, i) => {
    if (inMap(p) && dark(p)) {
      if (from < 0) from = i;
      return;
    }
    if (from >= 0 && i - 1 > from) spans.push([from, i - 1]);
    from = -1;
  });
  if (from >= 0 && pts.length - 1 > from) spans.push([from, pts.length - 1]);
  return spans;
};

/**
 * A dark stretch grown along its way, both ways in turn, to a lamp's spacing: a line shorter than
 * half of it gets no station (`stations` starts half a spacing in), so a short gap would stay dark.
 */
const padded = (pts: readonly Pt[], [a, b]: [number, number], spacing: number): Pt[] => {
  let [i, j] = [a, b];
  while (lengthOf(pts.slice(i, j + 1)) < spacing && (i > 0 || j < pts.length - 1)) {
    if (i > 0) i--;
    if (j < pts.length - 1 && lengthOf(pts.slice(i, j + 1)) < spacing) j++;
  }
  return pts.slice(i, j + 1);
};

/**
 * The pieces of a run on the map, which its lamps light: a station past the edge has no chunk and
 * no lamp. The run itself keeps its length past the edge, so its stations on the map stay where the
 * way's spacing puts them (G-821: cut at the edge, they moved onto Mełgiewska's merging lane).
 */
const onMap = (run: readonly Pt[]): Pt[][] => {
  const out: Pt[][] = [[]];
  for (const p of run) {
    if (inMap(p)) out[out.length - 1]!.push(p);
    else if (out[out.length - 1]!.length > 0) out.push([]);
  }
  return out.filter((l) => l.length > 0);
};

/** One rule group: a lit way's stretches in its look (`note` with "obu stronach" for both sides, as the plan's). */
const litItem = (id: string, w: LitWay, look: LampLine, runs: readonly (readonly Pt[])[]): PlanItem => ({
  id,
  kind: look.kind,
  lines: runs.map((r) => r.flatMap((p) => [r1(p.x), r1(p.z)])),
  spacing: look.spacing,
  keepOff: KEEP_OFF,
  count: runs.reduce((n, r) => n + Math.max(1, Math.round(lengthOf(r) / look.spacing)) * look.sides, 0),
  note: `Rule lit=yes (ADR-0064 stage 3, G-798): w${w.id} ${w.tags.highway}${look.sides === 2 ? ", obu stronach" : ""}.`,
});

/** The lit ways the rule lamps, with their class and points every `STEP`: car streets first, then by OSM id. */
const lampedWays = (ways: readonly LitWay[]): { w: LitWay; line: LampLine; pts: Pt[] }[] =>
  ways
    .flatMap((w) => {
      if (w.court === "inside") return [];
      const line = isLitWay(w.tags) && w.pts.length >= 2 ? (w.court === "square" ? COURT : lampLineOf(w.tags)) : null;
      return line ? [{ w, line, pts: densify(w.pts) }] : [];
    })
    .sort((a, b) => RANK[a.line.kind]! - RANK[b.line.kind]! || a.w.id - b.w.id);

/**
 * A way's look: a courtyard's, else `lookOf`; a side street's road lamps on one side (its class's or
 * the plan's lines', all drawn one-sided) on both as a main street's where its sidewalks lie far apart (`bothSides`, G-804).
 * A way shorter than the main street's spacing keeps its one row: the far row starts a spacing in, so
 * it would have one lamp half a spacing further in than the row's (Świętoduska's 32 m by Lubartowska).
 */
const lookFor = (w: LitWay, line: LampLine, pts: readonly Pt[], planned: LampIndex<LampLine | null>): LampLine => {
  if (line === COURT) return COURT;
  const look = lookOf(pts, line, planned);
  const wide = line === SIDE && look.kind === "lamp-road" && look.sides === 1 && lengthOf(w.pts) >= WIDE.spacing && bothSides(w.tags, w.kerbs);
  return wide ? WIDE : look;
};

/**
 * Groups `id(way)` for the lit ways' stretches `dark` by `lit` (each group's lines join `lit` for the
 * ways after). `ref`: the plan's lines of one side taken over (`yieldToRule`), which side they lit.
 */
const lampDark = (plan: PropsPlan, ways: readonly LitWay[], lit: LampIndex<unknown>, reach: (line: LampLine) => number, id: (w: LitWay) => string, ref: readonly (readonly Pt[])[] = []): PlanItem[] => {
  const planned = planLamps(plan);
  const own = new Map(plan.items.filter((i) => i.id.startsWith("lit.w")).map((i) => [i.id, linesOf(i).map(flat)]));
  const items: PlanItem[] = [];
  for (const { w, line, pts } of lampedWays(ways)) {
    const r = reach(line);
    const spans = darkSpans(pts, (p) => lit.nearest(p, r) === null);
    if (spans.length === 0) continue;
    const look = lookFor(w, line, pts, planned);
    // A row on one kerb by the way's drawing direction (G-804): turned to the side the plan's line or the first pass lit.
    const sided = look.sides === 1 && line.kind === "lamp-road";
    const refs = sided ? [...ref, ...(own.get(`lit.w${w.id}`) ?? [])] : [];
    // A run shorter than half a spacing, a way too short to grow it, has no station (`stations` starts half a spacing in): it lights nothing (G-816).
    const runs = spans
      .map((s) => padded(pts, s, look.spacing))
      .filter((r) => lengthOf(r) >= look.spacing / 2)
      .map((r) => (sided ? facing(r, w.tags, refs, ON_WAY) : r));
    if (runs.length === 0) continue;
    // Only what lies on the map lights the ways after: Świętoduska's run grown 26 m north past z = 160 lit the footway beside it (G-812).
    for (const run of runs) for (const piece of onMap(run)) lit.addLine(piece, true);
    items.push(litItem(id(w), w, look, runs));
  }
  return items;
};

/** The rule's first pass: a group `lit.w<id>` a lit way with stretches further than `COVER` (`CAR_COVER`) from the plan's lamps. */
export const litItems = (plan: PropsPlan, ways: readonly LitWay[], oneSided: readonly (readonly Pt[])[] = []): PlanItem[] => {
  const lit = new LampIndex<unknown>();
  for (const item of plan.items) {
    if (!isLamp(item.kind)) continue;
    for (const l of linesOf(item)) lit.addLine(flat(l), true);
    for (const [x, z] of item.points ?? []) lit.add({ x, z }, { x, z }, true);
    if (item.position) lit.add(item.position, item.position, true);
  }
  return lampDark(plan, ways, lit, (line) => (line.kind === "lamp-road" ? CAR_COVER : COVER), (w) => `lit.w${w.id}`, oneSided);
};

/**
 * The rule's second pass, once the furniture stands: a group `lit.w<id>.fill` a lit way with
 * stretches still further than `FILL_REACH` from every placed lamp (`lamps`). The first pass's lamp
 * may have gone (a tree's crown, a bench, a lamp of its kind within 7 m, no kerb found), or a line of
 * the plan lit less than `COVER` assumed.
 */
export const litFillItems = (plan: PropsPlan, ways: readonly LitWay[], lamps: readonly Pt[]): PlanItem[] => {
  const lit = new LampIndex<unknown>();
  for (const p of lamps) lit.add(p, p, true);
  return lampDark(plan, ways, lit, () => FILL_REACH, (w) => `lit.w${w.id}.fill`);
};

/** The plain town lamps (G-259). */
const PLAIN: ReadonlySet<string> = new Set(["lamp-road", "lamp-modern-pole"]);
/** How near a way's axis its lamps stand, and how far off its ends (m): the scan's `lamp-style-change-on-way` (G-266). */
export const STYLE_REACH = 8;
export const STYLE_END_GAP = 15;

/** A placed lamp: its kind and place. */
type PlacedLamp = Pt & { readonly prop: string };

/**
 * The rule's groups whose plain lamps stand along a way (any street or path) with styled lamps along
 * it too (G-266), and the styled look they take: the free-standing lamp of the styled kind most of
 * those lamps have. Lamps along a way: within `STYLE_REACH` of it, `STYLE_END_GAP` off its ends; a
 * plain lamp is the group's whose line lies nearest, within `STYLE_REACH`.
 */
export const styleClashes = (items: readonly PlanItem[], ways: readonly LitWay[], lamps: readonly PlacedLamp[]): Map<string, StreetPropKind> => {
  const rule = new LampIndex<string>();
  for (const i of items) if (i.id.startsWith("lit.") && PLAIN.has(i.kind)) for (const l of linesOf(i)) rule.addLine(flat(l), i.id);
  const byLamp = new LampIndex<PlacedLamp>();
  for (const l of lamps) if (PLAIN.has(l.prop) || STYLED.has(l.prop as StreetPropKind)) byLamp.add(l, l, l);
  const out = new Map<string, StreetPropKind>();
  for (const w of ways) {
    const [a, b] = [w.pts[0]!, w.pts[w.pts.length - 1]!];
    const inner = densify(w.pts, 0.5).filter((p) => Math.hypot(p.x - a.x, p.z - a.z) > STYLE_END_GAP && Math.hypot(p.x - b.x, p.z - b.z) > STYLE_END_GAP);
    const along = new Set<PlacedLamp>();
    for (const p of inner) for (const l of byLamp.within(p, STYLE_REACH)) along.add(l);
    const plain = [...along].filter((l) => PLAIN.has(l.prop));
    const styled = [...along].filter((l) => !PLAIN.has(l.prop));
    if (plain.length === 0 || styled.length === 0) continue;
    const kinds = styled.map((l) => FREE_STANDING[l.prop as StreetPropKind] ?? (l.prop as StreetPropKind));
    const kind = [...new Set(kinds)].sort((x, y) => kinds.filter((k) => k === y).length - kinds.filter((k) => k === x).length || (x < y ? -1 : 1))[0]!;
    for (const l of plain) {
      const id = rule.nearest(l, STYLE_REACH)?.tag;
      if (id && !out.has(id)) out.set(id, kind);
    }
  }
  return out;
};

/**
 * The rule's second pass, once the furniture of the first stands (`lamps`): its groups whose plain
 * lamps share a way with styled ones in the styled look (`styleClashes`), then the fill of what is
 * still dark (`litFillItems`). The plan's items, or the same items when nothing changes.
 */
export const litSecondPass = (plan: PropsPlan, lit: readonly LitWay[], streets: readonly LitWay[], lamps: readonly PlacedLamp[]): readonly PlanItem[] => {
  const clash = styleClashes(plan.items, streets, lamps);
  const items = clash.size === 0 ? plan.items : plan.items.map((i) => (clash.has(i.id) ? { ...i, kind: clash.get(i.id)! } : i));
  const fill = litFillItems({ ...plan, items }, lit, lamps);
  return clash.size === 0 && fill.length === 0 ? plan.items : [...items, ...fill];
};

/**
 * The furniture placed by `place` with the rule's second pass (`pnpm osm:props`, its test): the plan
 * placed, then, when the second pass changes its groups, placed again with them.
 */
export const placeLit = <T extends { readonly byChunk: ReadonlyMap<string, readonly PlacedLamp[]> }>(plan: PropsPlan, place: (p: PropsPlan) => T, lit: readonly LitWay[], streets: readonly LitWay[]): T => {
  const first = place(plan);
  const lamps = [...first.byChunk.values()].flat().filter((i) => i.prop.startsWith("lamp-"));
  const items = litSecondPass(plan, lit, streets, lamps);
  return items === plan.items ? first : place({ ...plan, items });
};

/**
 * Every lit way the rule may lamp, as a group of its look along the whole way (`lit.w<id>`), for the
 * glitch scan's checks of the lamps by their lines (`lamp-off-band`, `lamp-beside-deck`): the rule's
 * lamps of either pass stand on stretches of these.
 */
export const litWayGroups = (plan: PropsPlan, ways: readonly LitWay[]): PlanItem[] => {
  const planned = planLamps(plan);
  return lampedWays(ways).map(({ w, line, pts }) => litItem(`lit.w${w.id}`, w, lookFor(w, line, pts, planned), [w.pts]));
};

/**
 * The plan with the `lit` rule's first pass: its road lamp lines on lit car streets given way, the
 * OSM street lamps it lacks, then a group a lit way still dark, after every group of the plan.
 */
export const withLitRule = (plan: PropsPlan, ways: readonly LitWay[], points: readonly FurniturePoint[]): { plan: PropsPlan; yielded: string[] } => {
  const given = yieldToRule(plan, ways);
  const withLamps: PropsPlan = { ...given.plan, items: [...given.plan.items, ...osmLampItems(given.plan, points)] };
  return { plan: { ...withLamps, items: [...withLamps.items, ...litItems(withLamps, ways, given.oneSided)] }, yielded: given.yielded };
};

/**
 * The lit ways with their courtyards marked (`LitWay.court`): a lit courtyard square (`courts`, the
 * pedestrian squares whose outline runs along buildings, `courtyards.ts`) as `square`, a lit way
 * lying mostly in one as `inside`.
 */
export const markCourts = (ways: readonly LitWay[], courts: readonly { readonly id: number; readonly ring: readonly Pt[] }[]): LitWay[] =>
  ways.map((w) => {
    if (courts.some((c) => c.id === w.id)) return { ...w, court: "square" as const };
    const pts = densify(w.pts);
    return courts.some((c) => mostlyInside(pts, c.ring)) ? { ...w, court: "inside" as const } : w;
  });
