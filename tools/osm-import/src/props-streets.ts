/**
 * Groups of the street furniture plan without positions (ADR-0047): flower baskets hang on
 * every second pastoral lamp and candelabrum near their lines, manholes, cabinets and fire
 * hydrants follow the streets, name plates stand at junctions, bins go beside bus stops and benches.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { type Pt } from "./geometry.ts";
import type { Placed, PlanItem } from "./props-gen.ts";
import { fnv, sideOffset, stations, yawOf } from "./props-place.ts";
import { type Site } from "./props-site.ts";

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
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
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
  const all = placed.filter((x) => BASKET_LAMPS.has(x.prop)).sort(byKey);
  const near = (x: Placed) => lines.some((l) => distToLine(x.p, l) < 12);
  const lamps = [...all.filter(near), ...all.filter((x) => !near(x))];
  return lamps.filter((_, i) => i % 2 === 0).slice(0, item.count ?? lamps.length).map((x) => ({ prop: "hanging-basket", p: x.p, yaw: x.yaw, key: `${x.key}${BASKET}` }));
};

/** Streets that carry traffic (not paths, steps or service lanes). */
const ROADS: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "primary_link", "secondary_link", "tertiary_link", "trunk"]);

/** Is p within `reach` metres of the axis of a street cars drive (where the traffic's lanes run)? */
export const nearTraffic = (site: Site, p: Pt, reach: number): boolean =>
  site.streets.some((st) => ROADS.has(st.kind) && st.kind !== "living_street" && distToLine(p, st.line) < reach);

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

/** Things at the kerb along the roads, facing the road (cabinets, hydrants). */
const atKerb = (site: Site, item: PlanItem, prop: StreetPropKind): Placed[] =>
  roadStations(site, item.count ?? 0, item.id).flatMap(({ p, n, key }) => {
    const d = sideOffset(site, p, n, "kerb", 3);
    if (d === null) return [];
    return [{ prop, p: { x: p.x + n.x * (d + 0.5), z: p.z + n.z * (d + 0.5) }, yaw: yawOf(-n.x, -n.z), key }];
  });

/** A point of pavement on a corner of a junction, the first of 8 directions and 3 radii from `turn`. */
const corner = (site: Site, p: Pt, turn: number): Pt | null => {
  for (const r of [6, 8, 10, 4.5]) {
    for (let i = 0; i < 8; i++) {
      const a = ((turn % 8) + i) * (Math.PI / 4) + Math.PI / 8;
      const q = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
      if (site.surfaceAt(q) === "walk") return q;
    }
  }
  return null;
};

/** Name plates at junctions of differently named streets, on the corner's pavement. */
const namePlates = (site: Site, item: PlanItem): Placed[] => {
  const names = new Map<string, { p: Pt; names: Set<string> }>();
  for (const s of site.streets) {
    if (!s.name) continue;
    for (const p of s.line) {
      const k = `${Math.round(p.x)}:${Math.round(p.z)}`;
      const e = names.get(k) ?? { p, names: new Set<string>() };
      e.names.add(s.name);
      names.set(k, e);
    }
  }
  const junctions = [...names.entries()].filter(([, e]) => e.names.size >= 2).sort((a, b) => fnv(a[0]) - fnv(b[0]));
  const out: Placed[] = [];
  for (const [k, e] of junctions) {
    if (out.length >= (item.count ?? 0)) break;
    const q = corner(site, e.p, fnv(k));
    if (q) out.push({ prop: "street-plate", p: q, yaw: yawOf(e.p.x - q.x, e.p.z - q.z), key: `${item.id}:${k}` });
  }
  return out;
};

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
    case "hydrant":
      return atKerb(site, item, "hydrant");
    case "street-plate":
      return namePlates(site, item);
    case "waste-bin":
      return bins(site, item, placed, facing);
    default:
      return [];
  }
};
