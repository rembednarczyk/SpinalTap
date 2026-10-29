import type { VehicleModel } from "@seki/core";
import { type Pt, ROAD_CHAINS, type RoadChain, onRoad, polylineLength } from "./lublin/roads";
import { WORLD_STREET_PROPS } from "./street-props";

/**
 * The street's traffic (ADR-0050): the lanes cars drive along on the map's roads, the
 * trolleybuses on the lines of the plan, the rare delivery van on the pedestrian streets and
 * how busy the roads are by the hour. Pure data of the map, built once.
 */

/** How much traffic the graphics quality allows (the crowd's density by default). */
export type TrafficDensity = "off" | "low" | "medium" | "high";

/** How far from the player vehicles drive (m), and what share of the full traffic. */
export const TRAFFIC_RANGE: Readonly<Record<TrafficDensity, { readonly radius: number; readonly share: number }>> = {
  off: { radius: 0, share: 0 },
  low: { radius: 140, share: 0.45 },
  medium: { radius: 200, share: 0.7 },
  high: { radius: 260, share: 1 },
};

export type RouteUse = "cars" | "trolley" | "deliveries";

/** One lane of one road, driven from its first point to its last. */
export interface TrafficRoute {
  readonly id: string;
  readonly street: string;
  readonly use: RouteUse;
  /** The lane's line, offset from the street's axis to its side of the road. */
  readonly points: readonly Pt[];
  readonly length: number;
  /** Cruising speed, m/s. */
  readonly speed: number;
  /** Vehicles on it at full traffic. */
  readonly vehicles: number;
  /** Arc lengths where a trolleybus stops (its stops along the lane). */
  readonly stops: readonly number[];
}

/** Cars on each road kind: speed (m/s) and the gap between them at full traffic (m). */
const ROAD_KINDS: Readonly<Record<string, { speed: number; spacing: number }>> = {
  primary: { speed: 13.5, spacing: 42 },
  primary_link: { speed: 10, spacing: 60 },
  secondary: { speed: 12, spacing: 55 },
  secondary_link: { speed: 10, spacing: 70 },
  tertiary: { speed: 10, spacing: 75 },
  tertiary_link: { speed: 9, spacing: 90 },
  residential: { speed: 8, spacing: 120 },
  unclassified: { speed: 8, spacing: 120 },
};

/** The trolleybus network of the plan (`docs/world/lublin-street-plan.md` §6): the streets the lines run along. */
const TROLLEY_STREETS: ReadonlySet<string> = new Set([
  "Lubartowska",
  "Królewska",
  "Prymasa Stefana Wyszyńskiego",
  "Aleja Tysiąclecia",
  "Aleje Tysiąclecia",
  "Lwowska",
  "Aleja Unii Lubelskiej",
  "Mełgiewska",
  "Aleja Władysława Andersa",
  "Krakowskie Przedmieście",
]);
const TROLLEY_SPEED = 8.5;
const TROLLEY_SPACING = 420;
const DELIVERY_SPEED = 3.5;

/** A two-way street whose carriageway reaches this far right of its axis has a parking strip by the kerb (m). */
export const KERB_ROOM = 4.6;

/** The lane of a two-way street: mid-carriageway, or beside the parking strip where there is one (m from the axis). */
export const laneOffset = (half: number): number => (half <= 0 ? 1.5 : half >= KERB_ROOM ? 1.6 : Math.min(2.2, Math.max(1.2, half / 2)));

/** Trolleybus lines shorter than this have none (a stub of a street at the map's edge). */
const MIN_TROLLEY = 150;

/** Streets shorter than this carry nobody. */
const MIN_ROUTE = 45;

const dirAt = (pts: readonly Pt[], i: number): Pt => {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
};

/** The polyline moved `off` metres to its right (+x east, +z north: heading north, right is east). */
export const offsetLine = (pts: readonly Pt[], off: number): Pt[] =>
  pts.map((p, i) => {
    const [tx, tz] = dirAt(pts, i);
    return [Math.round((p[0] + tz * off) * 100) / 100, Math.round((p[1] - tx * off) * 100) / 100] as const;
  });

/** How far the carriageway reaches to the right of a street's axis: the median over samples every 10 m (m). */
export const roadHalfWidth = (pts: readonly Pt[], side: 1 | -1 = 1): number => {
  const out: number[] = [];
  const len = polylineLength(pts);
  for (let s = 5; s < len; s += 10) {
    const { x, z, tx, tz } = pointAt(pts, s);
    let w = 0;
    while (w < 9 && onRoad(x + tz * side * (w + 0.25), z - tx * side * (w + 0.25))) w += 0.25;
    if (w > 0) out.push(w);
  }
  if (out.length === 0) return 0;
  out.sort((a, b) => a - b);
  return out[Math.floor(out.length / 2)]!;
};

/** The point at arc length `s` of an open polyline (clamped), with the way along it. */
export const pointAt = (pts: readonly Pt[], s: number): { x: number; z: number; tx: number; tz: number } => {
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    if (left <= len || i === pts.length - 1) {
      const t = Math.min(1, left / len);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len };
    }
    left -= len;
  }
  const p = pts[0] ?? [0, 0];
  return { x: p[0], z: p[1], tx: 0, tz: 1 };
};

/** Arc length of the polyline's point nearest to (x, z), and how far from the line it is (+ right). */
export const projectOn = (pts: readonly Pt[], x: number, z: number): { s: number; d: number; side: number } => {
  let best = { s: 0, d: Infinity, side: 0 };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    const len = Math.sqrt(len2);
    const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
    const px = a[0] + dx * t;
    const pz = a[1] + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { s: acc + len * t, d, side: len > 0 ? ((x - a[0]) * dz - (z - a[1]) * dx) / len : 0 };
    acc += len;
  }
  return best;
};

/**
 * Is a major road one carriageway of a dual one: another major road close by and running the
 * other way along most of it? Then it is driven one way, the way OSM draws it.
 */
const isCarriageway = (c: RoadChain, all: readonly RoadChain[]): boolean => {
  if (c.name.startsWith("Rondo")) return true;
  if (!c.kind.startsWith("primary") && !c.kind.startsWith("secondary")) return false;
  const len = polylineLength(c.points);
  let twin = 0;
  let samples = 0;
  for (let s = 5; s < len; s += 15) {
    samples++;
    const p = pointAt(c.points, s);
    for (const o of all) {
      if (o === c || (!o.kind.startsWith("primary") && !o.kind.startsWith("secondary"))) continue;
      const q = projectOn(o.points, p.x, p.z);
      if (q.d < 4 || q.d > 32) continue;
      const t = pointAt(o.points, q.s);
      if (t.tx * p.tx + t.tz * p.tz < -0.7) {
        twin++;
        break;
      }
    }
  }
  return samples > 0 && twin / samples > 0.5;
};

/** The bus and trolleybus stops of the furniture along a lane: within 10 m to its right. */
const stopsAlong = (pts: readonly Pt[]): number[] => {
  const out: number[] = [];
  for (const items of Object.values(WORLD_STREET_PROPS)) {
    for (const i of items) {
      if (i.prop !== "bus-stop" && i.prop !== "bus-shelter") continue;
      const q = projectOn(pts, i.x, i.z);
      if (q.d > 10 || q.side < 0) continue;
      if (out.some((s) => Math.abs(s - q.s) < 30)) continue;
      out.push(Math.round(q.s * 10) / 10);
    }
  }
  return out.sort((a, b) => a - b);
};

const routeOf = (id: string, street: string, use: RouteUse, points: Pt[], speed: number, vehicles: number): TrafficRoute => ({
  id,
  street,
  use,
  points,
  length: polylineLength(points),
  speed,
  vehicles,
  stops: use === "trolley" ? stopsAlong(points) : [],
});

/** The lanes of one street: one or two per carriageway, both ways on a two-way street. */
const lanesOf = (c: RoadChain, k: number, all: readonly RoadChain[]): TrafficRoute[] => {
  const len = polylineLength(c.points);
  if (len < MIN_ROUTE) return [];
  const id = `${c.name}#${k}`;
  if (c.use === "deliveries") {
    // One van now and then on a long enough pedestrian street, down its middle.
    return len >= 80 ? [routeOf(`${id}:d`, c.name, "deliveries", [...c.points], DELIVERY_SPEED, 1)] : [];
  }
  const road = ROAD_KINDS[c.kind] ?? ROAD_KINDS.residential!;
  const cars = (l: number) => Math.max(1, Math.floor(l / road.spacing));
  const trolley = TROLLEY_STREETS.has(c.name) && len >= MIN_TROLLEY;
  const out: TrafficRoute[] = [];
  if (isCarriageway(c, all)) {
    const half = Math.max(roadHalfWidth(c.points, 1), roadHalfWidth(c.points, -1));
    const offsets = half >= 2.6 ? [1.6, -1.6] : [0];
    offsets.forEach((off, n) => out.push(routeOf(`${id}:${n}`, c.name, "cars", offsetLine(c.points, off), road.speed, cars(len))));
    if (trolley) out.push(routeOf(`${id}:t`, c.name, "trolley", offsetLine(c.points, offsets[0]!), TROLLEY_SPEED, Math.max(1, Math.round(len / TROLLEY_SPACING))));
    return out;
  }
  const back = [...c.points].reverse();
  const off = laneOffset(roadHalfWidth(c.points, 1));
  const ways: [string, Pt[]][] = [
    ["f", offsetLine(c.points, off)],
    ["b", offsetLine(back, off)],
  ];
  for (const [w, pts] of ways) {
    out.push(routeOf(`${id}:${w}`, c.name, "cars", pts, road.speed, cars(len)));
    if (trolley) out.push(routeOf(`${id}:${w}t`, c.name, "trolley", pts, TROLLEY_SPEED, Math.max(1, Math.round(len / TROLLEY_SPACING))));
  }
  return out;
};

/** Every lane of the city's traffic, in a stable order (the chains' order, then lane by lane). */
export const TRAFFIC_ROUTES: readonly TrafficRoute[] = ROAD_CHAINS.flatMap((c, k) => lanesOf(c, k, ROAD_CHAINS));

/** How busy the roads are by the hour (0..1 of full traffic): the rush hours, a quiet night. */
export const TRAFFIC_BY_HOUR: readonly number[] = [
  //0   1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20   21   22   23
  0.3, 0.2, 0.15, 0.1, 0.1, 0.2, 0.5, 0.9, 1.0, 0.8, 0.7, 0.7, 0.8, 0.8, 0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 0.65, 0.55, 0.45, 0.35,
];

/** Delivery vans on the pedestrian streets only in the morning. */
export const DELIVERY_HOURS = { from: 6, to: 11 } as const;

/** The cars of the kit by how common they are on Lublin's streets in 2077 (weights). */
export const CAR_MODELS: readonly (readonly [VehicleModel, number])[] = [
  ["sedan", 30],
  ["hatchback", 25],
  ["taxi", 15],
  ["van", 15],
  ["delivery", 15],
];
