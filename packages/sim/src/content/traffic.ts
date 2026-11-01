import { VEHICLE_SIZE, type VehicleModel } from "@seki/core";
import { type Pt, ROAD_CHAINS, type RoadChain, onRoad, polylineLength } from "./lublin/roads";
import { inBuilding } from "./lublin/places";
import { MAP_CHUNKS, PASSAGES } from "./lublin/sites";
import { GAME_PROPS, WORLD_STREET_PROPS } from "./street-props";
import { METRO_STATIONS } from "./metro";
import { groundY } from "./lublin/terrain";
import { type RouteUse, type TrafficRoute, pointAt, slice } from "./traffic-lane";
import { joinAtJunctions } from "./traffic-junctions";

export { type RouteUse, type TrafficRoute, TURN_SPEED, pointAt } from "./traffic-lane";

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
  "Lwowska",
  "Aleja Unii Lubelskiej",
  "Mełgiewska",
  "Aleja Władysława Andersa",
  "Krakowskie Przedmieście",
]);
const TROLLEY_SPEED = 8.5;
const TROLLEY_SPACING = 420;
const DELIVERY_SPEED = 3.5;
/** Half the widest delivery vehicle, and a hand of room. */
const VAN_HALF = Math.max(VEHICLE_SIZE.van.width, VEHICLE_SIZE.delivery.width) / 2 + 0.1;

/** A two-way street whose carriageway reaches this far right of its axis has a parking strip by the kerb (m). */
export const KERB_ROOM = 4.6;

/** The lane of a two-way street: mid-carriageway, or beside the parking strip where there is one (m from the axis). */
export const laneOffset = (half: number): number => (half <= 0 ? 1.5 : half >= KERB_ROOM ? 1.6 : Math.min(2.2, Math.max(1.2, half / 2)));

/** Trolleybus lines shorter than this have none (a stub of a street at the map's edge). */
const MIN_TROLLEY = 150;

/** Streets shorter than this carry nobody. */
export const MIN_ROUTE = 45;
/** A one-way street keeps one lane if a tenth of it is too narrow for two. */
const NARROW_Q = 0.1;

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

/** How far the carriageway reaches to the right of the polyline at arc length `s`, to 9 m (m; 0 off the road). */
const reachAt = (pts: readonly Pt[], s: number, side: 1 | -1): number => {
  const { x, z, tx, tz } = pointAt(pts, s);
  let w = 0;
  while (w < 9 && onRoad(x + tz * side * (w + 0.25), z - tx * side * (w + 0.25))) w += 0.25;
  return w;
};

/** How far the carriageway reaches to the right of a street's axis: the median (or quantile `q`) over samples every 10 m (m). */
export const roadHalfWidth = (pts: readonly Pt[], side: 1 | -1 = 1, q = 0.5): number => {
  const out: number[] = [];
  const len = polylineLength(pts);
  for (let s = 5; s < len; s += 10) {
    const w = reachAt(pts, s, side);
    if (w > 0) out.push(w);
  }
  if (out.length === 0) return 0;
  out.sort((a, b) => a - b);
  return out[Math.floor((out.length - 1) * q + 0.5)]!;
};

/** The local width of a street is sampled this often along it (m), and its narrowest taken over this many samples. */
const WIDTH_STEP = 5;
const WIDTH_WINDOW = 5;
/** Less asphalt than this beside the axis is a chunk's seam or an island, not a lane's room (m). */
const MIN_REACH = 1;
/** A lane's car keeps this far inside the kerb: half the widest car and a hand's breadth (m). */
const LANE_REACH = 1;
/** How fast a lane edges towards the axis where the carriageway narrows (m aside per m along). */
const LANE_EDGE = 0.1;

/**
 * The right-hand lane of a two-way street walked along `pts`: the whole street's lane, `whole` m
 * from its axis, brought in towards the axis where the carriageway right there is too narrow for
 * its car. A street of wide and narrow stretches (Staszica) kept the lane of its median and ran
 * over the narrow stretch's kerb (G-090). The width is the narrowest of a few samples, so a side
 * street's mouth does not move the lane out, and the lane comes in gently, ahead of the narrowing.
 */
const laneLine = (pts: readonly Pt[], whole: number): Pt[] => {
  const len = polylineLength(pts);
  const at: number[] = [];
  for (let s = WIDTH_STEP / 2; s < len; s += WIDTH_STEP) at.push(s);
  const widths = at.map((s) => reachAt(pts, s, 1));
  const off = widths.map((_, i) => {
    const near = widths.slice(Math.max(0, i - (WIDTH_WINDOW >> 1)), i + (WIDTH_WINDOW >> 1) + 1).filter((w) => w >= MIN_REACH);
    if (near.length === 0) return whole;
    const half = Math.min(...near);
    return Math.min(whole, Math.max(laneOffset(half), half - LANE_REACH));
  });
  for (let i = 1; i < off.length; i++) off[i] = Math.min(off[i]!, off[i - 1]! + LANE_EDGE * WIDTH_STEP);
  for (let i = off.length - 2; i >= 0; i--) off[i] = Math.min(off[i]!, off[i + 1]! + LANE_EDGE * WIDTH_STEP);
  if (off.every((o) => o === whole)) return offsetLine(pts, whole);
  return offsetAlong(pts, at, off);
};

/**
 * The polyline moved to its right by `off[j]` at arc length `at[j]`, linearly between and level
 * past the ends: its own points keep their way across a corner (as `offsetLine`), and a point is
 * put in where the offset bends along a straight piece.
 */
const offsetAlong = (pts: readonly Pt[], at: readonly number[], off: readonly number[]): Pt[] => {
  const offAt = (s: number): number => {
    if (s <= at[0]!) return off[0]!;
    const j = at.findIndex((a) => a >= s);
    if (j < 0) return off[off.length - 1]!;
    return off[j - 1]! + ((off[j]! - off[j - 1]!) * (s - at[j - 1]!)) / (at[j]! - at[j - 1]!);
  };
  const round = (v: number) => Math.round(v * 100) / 100;
  const out: Pt[] = [];
  let acc = 0;
  pts.forEach((p, i) => {
    if (i > 0) {
      const a = pts[i - 1]!;
      const seg = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const [tx, tz] = seg > 1e-9 ? [(p[0] - a[0]) / seg, (p[1] - a[1]) / seg] : [0, 0];
      at.forEach((s, j) => {
        const bends = off[j] !== (off[j - 1] ?? off[j]) || off[j] !== (off[j + 1] ?? off[j]);
        if (!bends || s <= acc + 0.5 || s >= acc + seg - 0.5) return;
        const x = a[0] + tx * (s - acc);
        const z = a[1] + tz * (s - acc);
        out.push([round(x + tz * off[j]!), round(z - tx * off[j]!)]);
      });
      acc += seg;
    }
    const [tx, tz] = dirAt(pts, i);
    const o = offAt(acc);
    out.push([round(p[0] + tz * o), round(p[1] - tx * o)]);
  });
  return out;
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

/** The stretch of a passage's axis under a building, as arc lengths from its `from` end (sampled every 0.25 m), or null. */
const underBuilding = (p: (typeof PASSAGES)[number]): readonly [number, number] | null => {
  const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
  const under: number[] = [];
  for (let s = 0; s <= len; s += 0.25) if (inBuilding(p.from.x + ((p.to.x - p.from.x) * s) / len, p.from.z + ((p.to.z - p.from.z) * s) / len)) under.push(s);
  return under.length > 0 ? [under[0]!, under[under.length - 1]!] : null;
};

const VAULTS = PASSAGES.flatMap((p) => {
  const span = underBuilding(p);
  return span ? [{ p, span }] : [];
});

/**
 * A van's line through the passages under buildings: its points from a metre before a passage's
 * mouth to a metre past the other, off the axis by more than the van leaves free, moved onto the
 * axis. The OSM way through a gate need not be the passage's axis (Brama Grodzka, 1.4 m off it,
 * G-136), and a van on it would scrape the wall.
 */
const onPassageAxes = (pts: readonly Pt[]): Pt[] =>
  pts.map(([x, z]) => {
    for (const { p, span } of VAULTS) {
      const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
      const [ux, uz] = [(p.to.x - p.from.x) / len, (p.to.z - p.from.z) / len];
      const s = (x - p.from.x) * ux + (z - p.from.z) * uz;
      const off = Math.abs((x - p.from.x) * uz - (z - p.from.z) * ux);
      if (s >= span[0] - 1 && s <= span[1] + 1 && off > p.width / 2 - VAN_HALF && off < p.width / 2 + 2) return [p.from.x + ux * s, p.from.z + uz * s];
    }
    return [x, z];
  });

/** The lanes of one street: one or two per carriageway, both ways on a two-way street. */
const lanesOf = (c: RoadChain, k: number, all: readonly RoadChain[]): TrafficRoute[] => {
  const len = polylineLength(c.points);
  if (len < MIN_ROUTE) return [];
  const id = `${c.name}#${k}`;
  if (c.use === "deliveries") {
    // One van now and then on a long enough pedestrian street, down its middle.
    return len >= 80 ? [routeOf(`${id}:d`, c.name, "deliveries", onPassageAxes(c.points), DELIVERY_SPEED, 1)] : [];
  }
  const road = ROAD_KINDS[c.kind] ?? ROAD_KINDS.residential!;
  const cars = (l: number) => Math.max(1, Math.floor(l / road.spacing));
  const trolley = TROLLEY_STREETS.has(c.name) && len >= MIN_TROLLEY;
  const out: TrafficRoute[] = [];
  // A one-way street or one carriageway of a dual road: its lanes all go the way it is drawn.
  if (c.oneway || isCarriageway(c, all)) {
    // Two lanes side by side only if the asphalt reaches past both of them nearly all the way.
    const half = Math.min(roadHalfWidth(c.points, 1, NARROW_Q), roadHalfWidth(c.points, -1, NARROW_Q));
    const offsets = half >= 2.6 ? [1.6, -1.6] : [0];
    offsets.forEach((off, n) => out.push(routeOf(`${id}:${n}`, c.name, "cars", offsetLine(c.points, off), road.speed, cars(len))));
    if (trolley) out.push(routeOf(`${id}:t`, c.name, "trolley", offsetLine(c.points, offsets[0]!), TROLLEY_SPEED, Math.max(1, Math.round(len / TROLLEY_SPACING))));
    return out;
  }
  const back = [...c.points].reverse();
  const off = laneOffset(roadHalfWidth(c.points, 1));
  const ways: [string, Pt[]][] = [
    ["f", laneLine(c.points, off)],
    ["b", laneLine(back, off)],
  ];
  for (const [w, pts] of ways) {
    out.push(routeOf(`${id}:${w}`, c.name, "cars", pts, road.speed, cars(len)));
    if (trolley) out.push(routeOf(`${id}:${w}t`, c.name, "trolley", pts, TROLLEY_SPEED, Math.max(1, Math.round(len / TROLLEY_SPACING))));
  }
  return out;
};

/** A vehicle keeps this far from the game's blocks: half the widest car and a margin (m). */
const BLOCK_REACH = 1.4;
/** Blocks whose underside is higher than this above the ground (the market's deck, a sign) let vehicles under (m). */
const VEHICLE_HEADROOM = 3;

/**
 * The game's solid blocks standing on the roads (the market's halls and the viaduct's pillars on
 * Aleja Tysiąclecia, ADR-0045), grown by `BLOCK_REACH`: lanes stop short of them.
 */
const ROAD_BLOCKS: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [...GAME_PROPS, ...METRO_STATIONS.flatMap((m) => m.props)].flatMap((p) =>
  p.solid && p.view.kind === "block" && p.center.y - p.view.size.y / 2 < groundY(p.center.x, p.center.z) + VEHICLE_HEADROOM
    ? [{ minX: p.center.x - p.view.size.x / 2 - BLOCK_REACH, maxX: p.center.x + p.view.size.x / 2 + BLOCK_REACH, minZ: p.center.z - p.view.size.z / 2 - BLOCK_REACH, maxZ: p.center.z + p.view.size.z / 2 + BLOCK_REACH }]
    : [],
);

/** Arc lengths along a lane where it runs into one of the game's blocks, every half metre. */
const blockedAlong = (r: TrafficRoute): number[] => {
  const xs = r.points.map((p) => p[0]);
  const zs = r.points.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const near = ROAD_BLOCKS.filter((b) => b.maxX > x0 && b.minX < x1 && b.maxZ > z0 && b.minZ < z1);
  const out: number[] = [];
  if (near.length === 0) return out;
  for (let s = 0; s <= r.length; s += 0.5) {
    const p = pointAt(r.points, s);
    if (near.some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ)) out.push(s);
  }
  return out;
};

/** A piece of a lane clear of the blocks, and whether it stops short at its start or its end: a block cut it, or the street ends there. */
interface Piece {
  readonly route: TrafficRoute;
  readonly cutStart: boolean;
  readonly cutEnd: boolean;
}

/** A street's end this far from every other car street and from the map's edge is a dead end (m). */
const DEAD_END_REACH = 8;

const onMap = (x: number, z: number): boolean => MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);

/**
 * Does no car go on from this end of street `k`: the street ends there in OSM, or turns into a
 * pedestrian street or one for deliveries? Its lanes turn round there, as before a block. An end
 * at a junction, at a chunk's seam or at the map's edge is not one.
 */
const deadEnd = (k: number, [x, z]: Pt): boolean =>
  [-1, 0, 1].every((a) => [-1, 0, 1].every((b) => onMap(x + a * DEAD_END_REACH, z + b * DEAD_END_REACH))) &&
  ROAD_CHAINS.every((o, j) => j === k || o.use !== "cars" || projectOn(o.points, x, z).d > DEAD_END_REACH);

type DeadEnds = { readonly first: boolean; readonly last: boolean };

/** Whether a street's first and last points are dead ends. */
const deadEndsOf = (c: RoadChain, k: number): DeadEnds => ({ first: deadEnd(k, c.points[0]!), last: deadEnd(k, c.points[c.points.length - 1]!) });

/**
 * The lanes of one street as their pieces clear of the game's blocks, `MIN_ROUTE` long at least.
 * A block in one lane closes the street's other lanes there too, so no lane starts among them.
 */
const clearOfBlocks = (lanes: readonly TrafficRoute[], dead: DeadEnds): Piece[] => {
  const blocked = lanes.flatMap(blockedAlong);
  // A lane that runs the other way meets the same block, and the street's ends, at the other end of its arc length.
  const isBack = (r: TrafficRoute) => r.id.endsWith(":b") || r.id.endsWith(":bt");
  const deadStart = (r: TrafficRoute) => (isBack(r) ? dead.last : dead.first);
  const deadStop = (r: TrafficRoute) => (isBack(r) ? dead.first : dead.last);
  if (blocked.length === 0) return lanes.map((route) => ({ route, cutStart: deadStart(route), cutEnd: deadStop(route) }));
  return lanes.flatMap((r) => {
    const back = isBack(r);
    const own = blocked.map((s) => (back ? r.length - s : s)).sort((a, b) => a - b);
    const free: [number, number][] = [];
    let from = 0;
    for (const s of own) {
      if (s - 0.5 > from) free.push([from, s - 0.5]);
      from = Math.max(from, s + 0.5);
    }
    if (from < r.length) free.push([from, r.length]);
    return free
      .filter(([a, b]) => b - a >= MIN_ROUTE)
      .map(([a, b], n) => ({
        route: routeOf(`${r.id}/${n}`, r.street, r.use, slice(r.points, a, b), r.speed, Math.max(1, Math.round((r.vehicles * (b - a)) / r.length))),
        cutStart: a > 0 || deadStart(r),
        cutEnd: b < r.length || deadStop(r),
      }));
  });
};

/** A lane cut short by a block or a dead end turns round onto a lane the other way starting this close to its end (m). */
const TURN_REACH = 16;

/** Half a circle from `a` heading (tx, tz) round to `b`: the turn round in front of a block. */
const uTurn = (a: Pt, b: Pt, tx: number, tz: number): Pt[] => {
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  const out: Pt[] = [];
  for (let k = 1; k < 8; k++) {
    const t = (Math.PI * k) / 8;
    out.push([cx + (a[0] - cx) * Math.cos(t) + tx * r * Math.sin(t), cz + (a[1] - cz) * Math.cos(t) + tz * r * Math.sin(t)]);
  }
  return out;
};

/**
 * The pieces as lanes: one cut short by a block or a dead end turns round there onto the nearest
 * unclaimed piece of the same use that starts beside its end the other way (the two carriageways
 * of Aleja Tysiąclecia before the market, the other lane of a two-way street that runs into a
 * pedestrian one), so its vehicles do not queue at a dead end. A one-way street has no such lane.
 */
const turnRound = (pieces: readonly Piece[]): TrafficRoute[] => {
  const pairs: { d: number; i: number; j: number }[] = [];
  pieces.forEach((a, i) => {
    if (!a.cutEnd) return;
    const end = a.route.points[a.route.points.length - 1]!;
    const ta = pointAt(a.route.points, a.route.length);
    pieces.forEach((b, j) => {
      if (!b.cutStart || b.route.use !== a.route.use || i === j) return;
      const tb = pointAt(b.route.points, 0);
      const d = Math.hypot(tb.x - end[0], tb.z - end[1]);
      if (d < TURN_REACH && ta.tx * tb.tx + ta.tz * tb.tz < -0.7) pairs.push({ d, i, j });
    });
  });
  pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
  const next = new Map<number, number>();
  const taken = new Set<number>();
  for (const p of pairs) {
    if (next.has(p.i) || taken.has(p.j)) continue;
    next.set(p.i, p.j);
    taken.add(p.j);
  }
  return pieces.flatMap((a, i) => {
    if (taken.has(i)) return [];
    const j = next.get(i);
    if (j === undefined) return [a.route];
    const b = pieces[j]!.route;
    // The half circle bulges forward by its radius: both lanes give that up, so it stays clear of the block.
    const end = a.route.points[a.route.points.length - 1]!;
    const r = Math.hypot(b.points[0]![0] - end[0], b.points[0]![1] - end[1]) / 2;
    const into = slice(a.route.points, 0, a.route.length - r);
    const out = slice(b.points, r, b.length);
    const t = pointAt(into, a.route.length - r);
    const points = [...into, ...uTurn(into[into.length - 1]!, out[0]!, t.tx, t.tz), ...out];
    const joined = routeOf(`${a.route.id}+${b.id}`, a.route.street, a.route.use, points, a.route.speed, a.route.vehicles + b.vehicles);
    return [{ ...joined, turns: [[a.route.length - r, joined.length - (b.length - r)]] as const }];
  });
};

/** Every lane of the city's traffic, in a stable order (the chains' order, then lane by lane), clear of the game's blocks. */
export const TRAFFIC_LANES: readonly TrafficRoute[] = turnRound(ROAD_CHAINS.flatMap((c, k) => clearOfBlocks(lanesOf(c, k, ROAD_CHAINS), deadEndsOf(c, k))));

/** The routes the vehicles drive: the lanes joined at the junctions (ADR-0055). */
export const TRAFFIC_ROUTES: readonly TrafficRoute[] = joinAtJunctions(TRAFFIC_LANES);

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
