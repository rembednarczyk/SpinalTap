/**
 * Groups of the street furniture plan without positions (ADR-0047): flower baskets hang on
 * every second pastoral lamp and candelabrum near their lines, manholes and cabinets follow the
 * streets, name plates stand at junctions, bins go beside bus stops and benches.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import { type Pt } from "./geometry.ts";
import type { Placed, PlanItem } from "./props-gen.ts";
import { fnv, sideOffset, stations, yawOf } from "./props-place.ts";
import type { Site, SiteStreet } from "./props-site.ts";

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const distToLine = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    best = Math.min(best, segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z));
  }
  return best;
};

/** What a basket's key adds to its lamp's. */
export const BASKET = "+basket";

/** Lamps a basket hangs on. */
export const BASKET_LAMPS: ReadonlySet<StreetPropKind> = new Set(["lamp-pastoral", "lamp-candelabra"]);

const byKey = (a: Placed, b: Placed): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Baskets on every second pastoral lamp and candelabrum, those within 12 m of the group's lines first. */
const baskets = (item: PlanItem, placed: readonly Placed[]): Placed[] => {
  const lines = (item.lines ?? (item.line ? [item.line] : [])).map(flat);
  // Near the plan's lines first, then the other pastoral lamps and candelabra of the city.
  const all = placed.filter((x) => BASKET_LAMPS.has(x.prop) && !x.bare).sort(byKey);
  const near = (x: Placed) => lines.some((l) => distToLine(x.p, l) < 12);
  const lamps = [...all.filter(near), ...all.filter((x) => !near(x))];
  return lamps.filter((_, i) => i % 2 === 0).slice(0, item.count ?? lamps.length).map((x) => ({ prop: "hanging-basket", p: x.p, yaw: x.yaw, key: `${x.key}${BASKET}` }));
};

/** Streets that carry traffic (not paths, steps or service lanes). */
const ROADS: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "primary_link", "secondary_link", "tertiary_link", "trunk"]);

/** A street's segment, by its box in `segments`. */
interface Segment {
  readonly st: SiteStreet;
  readonly a: Pt;
  readonly b: Pt;
}

const SEGMENTS = new WeakMap<readonly SiteStreet[], SpatialHash<Segment>>();

/** The streets' segments by their boxes, once a list: the city's streets are a thousand polylines, asked of every sample. */
const segments = (streets: readonly SiteStreet[]): SpatialHash<Segment> => {
  let hash = SEGMENTS.get(streets);
  if (hash) return hash;
  hash = new SpatialHash<Segment>(32);
  for (const st of streets)
    for (let i = 0; i + 1 < st.line.length; i++) {
      const [a, b] = [st.line[i]!, st.line[i + 1]!];
      hash.insert({ st, a, b }, Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
    }
  SEGMENTS.set(streets, hash);
  return hash;
};

/** Is p within `reach` metres of the axis of one of `streets` that `keep` takes? The box asked is a centimetre wider, so no segment within reach is missed by rounding. */
export const nearStreet = (streets: readonly SiteStreet[], p: Pt, reach: number, keep: (st: SiteStreet) => boolean = () => true): boolean => {
  const r = reach + 0.01;
  return segments(streets).some(p.x - r, p.z - r, p.x + r, p.z + r, (s) => keep(s.st) && segmentDistance(p.x, p.z, s.a.x, s.a.z, s.b.x, s.b.z) < reach);
};

const carries = (st: SiteStreet): boolean => ROADS.has(st.kind) && st.kind !== "living_street";

/** Is p within `reach` metres of the axis of a street cars drive (where the traffic's lanes run)? */
export const nearTraffic = (site: Site, p: Pt, reach: number): boolean => nearStreet(site.streets, p, reach, carries);

const lengthOf = (line: readonly Pt[]): number => {
  let len = 0;
  for (let k = 1; k < line.length; k++) len += Math.hypot(line[k]!.x - line[k - 1]!.x, line[k]!.z - line[k - 1]!.z);
  return len;
};

/** `count` stations spread over the roads by length, each with its street's normal to a side from the hash. */
const roadStations = (site: Site, count: number, seed: string) => {
  const roads = site.streets.filter((s) => ROADS.has(s.kind));
  const total = roads.reduce((s, r) => s + lengthOf(r.line), 0);
  if (count <= 0 || total <= 0) return [];
  const step = total / count;
  const first = ((fnv(seed) % 1000) / 1000) * step;
  const out: { p: Pt; n: Pt; key: string }[] = [];
  let walked = 0;
  roads.forEach((r, i) => {
    const len = lengthOf(r.line);
    // The next global station at or after this road's start, as a distance along it.
    const k0 = Math.max(0, Math.ceil((walked - first) / step - 1e-9));
    const local = first + k0 * step - walked;
    if (local <= len) {
      stations(r.line, step, local).forEach((st, k) => {
        const side = fnv(`${seed}:${i}:${k}`) % 2 === 0 ? 1 : -1;
        out.push({ p: st.p, n: { x: -st.dir.z * side, z: st.dir.x * side }, key: `${seed}:${r.name}:${i}:${k}` });
      });
    }
    walked += len;
  });
  return out;
};

/** Manholes on the carriageway, a metre or two off the axis. */
const manholes = (site: Site, item: PlanItem): Placed[] =>
  roadStations(site, item.count ?? 0, item.id).flatMap(({ p, n, key }) => {
    const q = { x: p.x + n.x * 1.6, z: p.z + n.z * 1.6 };
    return site.surfaceAt(q) === "road" ? [{ prop: "manhole" as const, p: q, yaw: yawOf(n.z, -n.x), key }] : [];
  });

/** Things at the kerb along the roads, facing the road (cabinets): on the ground their cables run in, not on a bridge's deck. */
const atKerb = (site: Site, item: PlanItem, prop: StreetPropKind): Placed[] =>
  roadStations(site, item.count ?? 0, item.id).flatMap(({ p, n, key }) => {
    const d = sideOffset(site, p, n, "kerb", 3);
    if (d === null) return [];
    const q = { x: p.x + n.x * (d + 0.5), z: p.z + n.z * (d + 0.5) };
    return site.deckAt(q) === null ? [{ prop, p: q, yaw: yawOf(-n.x, -n.z), key }] : [];
  });

/** A bin beside every bus stop and then every bench with no bin within 30 m. */
const bins = (site: Site, item: PlanItem, placed: readonly Placed[], facing: (x: Placed) => number): Placed[] => {
  const have: Pt[] = placed.filter((x) => x.prop === "waste-bin").map((x) => x.p);
  const out: Placed[] = [];
  const hosts = [...placed.filter((x) => x.prop === "bus-stop" || x.prop === "bus-shelter").sort(byKey), ...placed.filter((x) => x.prop === "bench").sort(byKey)];
  for (const h of hosts) {
    if (out.length >= (item.count ?? 0)) break;
    if (have.some((q) => Math.hypot(q.x - h.p.x, q.z - h.p.z) < 30)) continue;
    const yaw = facing(h);
    const q = { x: h.p.x + Math.cos(yaw) * 1.5, z: h.p.z - Math.sin(yaw) * 1.5 };
    if (!site.standable(q)) continue;
    have.push(q);
    out.push({ prop: "waste-bin", p: q, yaw, key: `${item.id}:${h.key}` });
  }
  return out;
};

/** Pieces of a group the plan gives no positions for, from what is already placed and the streets. */
export const placeStreetGroup = (site: Site, item: PlanItem, placed: readonly Placed[], facing: (x: Placed) => number): Placed[] => {
  switch (item.kind) {
    case "hanging-basket":
      return baskets(item, placed);
    case "manhole":
      return manholes(site, item);
    case "street-cabinet":
      return atKerb(site, item, "street-cabinet");
    case "waste-bin":
      return bins(site, item, placed, facing);
    default:
      return [];
  }
};
