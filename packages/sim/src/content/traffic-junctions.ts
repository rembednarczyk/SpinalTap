import { type Pt, polylineLength, surfacesAt } from "./lublin/roads";
import { inBuilding } from "./lublin/places";
import { MAP_CHUNKS } from "./lublin/sites";
import { TURN_SPEED, type TrafficRoute, pointAt, slice } from "./traffic-lane";

/**
 * Turns at junctions (ADR-0055): a lane that ends where another street's lane of the same use
 * starts drives on into it along an arc, so its vehicles do not stand at the end of the lane.
 * Lanes joined end to start make one route. Pure data of the map.
 */

/**
 * A lane's end turns into a start this close to it (m). Measured over the 93 lane ends inside the
 * map: the nearest other street's start with an arc on the road lies within 3 m at 50 of them,
 * then at 3.1 and 14.7 m; the next lies 59 m off, across a block.
 */
export const JUNCTION_REACH = 16;
/**
 * A lane goes on into its own street's next lane only from this close (m): where OSM splits the
 * street at a junction. A wider gap is a hole in the street's data (G-020, G-021), not a junction.
 */
const STREET_GOES_ON = 3;
/** Ends and starts this close to the map's edge (m) lead off it, not into a junction. */
const EDGE = 6;
/** Headings within this (its cosine, about 30 degrees) drive straight on; below `OPPOSITE` they turn round, which `turnRound` does. */
const STRAIGHT_COS = 0.87;
const OPPOSITE_COS = -0.7;
/** How far back both lanes may give way to the arc (m), tried shortest first. */
const SETBACKS = [0, 1.5, 3, 4.5, 6, 8, 10, 12];
/** Most an arc may swing one way and back (rad): an S across a junction misleads the vehicles crossing it about where it goes. */
const MAX_SWERVE = 0.35;
/** The tightest bend an arc may take (m). */
const MIN_RADIUS = 3;
/** Most an arc's points lie apart (m). */
const STEP = 0.5;
/** An arc is checked to lie on the carriageway this often along it (m). */
const PROBE = 0.25;

export type Way = "straight" | "right" | "left";
const RANK: Readonly<Record<Way, number>> = { straight: 0, right: 1, left: 2 };

/** Lane `from`'s end drives into lane `to`'s start: both cut back so far, along the arc between (its ends included). */
export interface Join {
  readonly from: number;
  readonly to: number;
  readonly way: Way;
  /** From the end to the start, before the cuts (m). */
  readonly d: number;
  readonly cutEnd: number;
  readonly cutStart: number;
  readonly arc: readonly Pt[];
}

const onChunk = (x: number, z: number): boolean => MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
const deepInMap = (x: number, z: number): boolean => [-EDGE, 0, EDGE].every((a) => [-EDGE, 0, EDGE].every((b) => onChunk(x + a, z + b)));

type Heading = { readonly tx: number; readonly tz: number };

/** The way from heading `a` into heading `b` (+x east, +z north: a right turn swings clockwise), or none when it turns back. */
export const wayOf = (a: Heading, b: Heading): Way | null => {
  const dot = a.tx * b.tx + a.tz * b.tz;
  if (dot < OPPOSITE_COS) return null;
  if (dot > STRAIGHT_COS) return "straight";
  return a.tx * b.tz - a.tz * b.tx < 0 ? "right" : "left";
};

/** A cubic Bézier from `a` heading `ea` to `b` heading `eb`, tangent to both, its handles as for a circle's arc; points every `STEP` or less. */
const bezier = (a: Pt, ea: Heading, b: Pt, eb: Heading): Pt[] => {
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.acos(Math.max(-1, Math.min(1, ea.tx * eb.tx + ea.tz * eb.tz)));
  const k = angle < 1e-3 ? chord / 3 : (chord * (4 / 3) * Math.tan(angle / 4)) / (2 * Math.sin(angle / 2));
  const p1: Pt = [a[0] + ea.tx * k, a[1] + ea.tz * k];
  const p2: Pt = [b[0] - eb.tx * k, b[1] - eb.tz * k];
  const n = Math.max(4, Math.ceil((chord + k) / STEP));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    out.push([w[0] * a[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * b[0], w[0] * a[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * b[1]]);
  }
  return out;
};

/** The tightest bend of a polyline (m): each step's length over the angle it turns by. */
const tightest = (pts: readonly Pt[]): number => {
  let least = Infinity;
  for (let i = 1; i + 1 < pts.length; i++) {
    const [a, b, c] = [pts[i - 1]!, pts[i]!, pts[i + 1]!];
    const turn = Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.atan2(c[0] - b[0], c[1] - b[1]));
    const angle = Math.min(turn, 2 * Math.PI - turn);
    if (angle > 1e-6) least = Math.min(least, Math.hypot(c[0] - b[0], c[1] - b[1]) / angle);
  }
  return least;
};

/** How far a polyline swings against its overall turn (rad): its turning both ways, less its net turn. */
const swerve = (pts: readonly Pt[]): number => {
  let net = 0;
  let all = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const [a, b, c] = [pts[i - 1]!, pts[i]!, pts[i + 1]!];
    const turn = Math.atan2(Math.sin(Math.atan2(c[0] - b[0], c[1] - b[1]) - Math.atan2(b[0] - a[0], b[1] - a[1])), Math.cos(Math.atan2(c[0] - b[0], c[1] - b[1]) - Math.atan2(b[0] - a[0], b[1] - a[1])));
    net += turn;
    all += Math.abs(turn);
  }
  return all - Math.abs(net);
};

/** Is every point of an arc on the carriageway and out of every building? */
const onCarriageway = (pts: readonly Pt[]): boolean => {
  const len = polylineLength(pts);
  for (let s = 0; s <= len; s += PROBE) {
    const p = pointAt(pts, s);
    if (!surfacesAt(p.x, p.z).includes("road") || inBuilding(p.x, p.z)) return false;
  }
  return true;
};

/**
 * The arc from lane `a`'s end into lane `b`'s start with the least cut back from either (each
 * keeps two thirds of itself at least): driven forwards, no tighter than `MIN_RADIUS`, without an S, on the
 * road. None when no cut gives one.
 */
const arcBetween = (a: TrafficRoute, b: TrafficRoute): { cutEnd: number; cutStart: number; arc: Pt[] } | null => {
  const cuts = SETBACKS.flatMap((x) => SETBACKS.map((y) => [x, y] as const)).sort((p, q) => p[0] + p[1] - q[0] - q[1] || p[0] - q[0]);
  for (const [cutEnd, cutStart] of cuts) {
    if (cutEnd > a.length / 3 || cutStart > b.length / 3) continue;
    const p = pointAt(a.points, a.length - cutEnd);
    const q = pointAt(b.points, cutStart);
    const [dx, dz] = [q.x - p.x, q.z - p.z];
    if (Math.hypot(dx, dz) < STEP || dx * p.tx + dz * p.tz <= 0 || dx * q.tx + dz * q.tz <= 0) continue;
    const arc = bezier([p.x, p.z], p, [q.x, q.z], q);
    if (tightest(arc) >= MIN_RADIUS && swerve(arc) <= MAX_SWERVE && onCarriageway(arc)) return { cutEnd, cutStart, arc };
  }
  return null;
};

/**
 * The joins of the lanes at their ends: every end with a start of the same use within
 * `JUNCTION_REACH`, the way not back, an arc on the road between. Each end and each start is
 * taken once: straight on first, then right, then left; the nearer start, then the lanes' order.
 */
export const junctionJoins = (routes: readonly TrafficRoute[]): Join[] => {
  const ends = routes.map((r) => pointAt(r.points, r.length));
  const starts = routes.map((r) => pointAt(r.points, 0));
  const joinable = (r: TrafficRoute, p: Heading & { x: number; z: number }) => r.use !== "deliveries" && deepInMap(p.x, p.z);
  const openEnd = routes.map((r, i) => joinable(r, ends[i]!));
  const openStart = routes.map((r, i) => joinable(r, starts[i]!));
  const pairs: { from: number; to: number; way: Way; d: number }[] = [];
  routes.forEach((a, from) => {
    if (!openEnd[from]) return;
    const e = ends[from]!;
    routes.forEach((b, to) => {
      if (!openStart[to] || b.use !== a.use) return;
      const s = starts[to]!;
      const d = Math.hypot(s.x - e.x, s.z - e.z);
      const way = wayOf(e, s);
      if (d < (b.street === a.street ? STREET_GOES_ON : JUNCTION_REACH) && way) pairs.push({ from, to, way, d });
    });
  });
  pairs.sort((p, q) => RANK[p.way] - RANK[q.way] || p.d - q.d || p.from - q.from || p.to - q.to);
  const out: Join[] = [];
  const ended = new Set<number>();
  const started = new Set<number>();
  for (const p of pairs) {
    if (ended.has(p.from) || started.has(p.to)) continue;
    const arc = arcBetween(routes[p.from]!, routes[p.to]!);
    if (!arc) continue;
    out.push({ ...p, ...arc });
    ended.add(p.from);
    started.add(p.to);
  }
  return untangle(routes, out);
};

/** Do two polylines cross? */
const crosses = (a: readonly Pt[], b: readonly Pt[]): boolean => {
  const side = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) {
      const [p, q, r, t] = [a[i - 1]!, a[i]!, b[j - 1]!, b[j]!];
      if (side(p, q, r) * side(p, q, t) < 0 && side(r, t, p) * side(r, t, q) < 0) return true;
    }
  return false;
};

/** How far before and after its arc a join's way is read for crossing another (m): the lanes it leaves and enters. */
const APPROACH = 12;

/** The way a join drives: the end of its lane, its arc, the start of the next lane. */
const wayThrough = (routes: readonly TrafficRoute[], j: Join): Pt[] => {
  const [a, b] = [routes[j.from]!, routes[j.to]!];
  const end = a.length - j.cutEnd;
  return [...slice(a.points, Math.max(0, end - APPROACH), end), ...j.arc, ...slice(b.points, j.cutStart, Math.min(b.length, j.cutStart + APPROACH))];
};

/**
 * Two joins out of the lanes of one street, or into the lanes of one, whose ways cross (a right
 * turn from the left lane across the right lane going straight on, a left turn into the right lane
 * of a two-lane street beside a right turn into its left one) swap the lanes they drive into when
 * the swapped arcs exist and cross no more: vehicles side by side do not drive through each other.
 */
const untangle = (routes: readonly TrafficRoute[], joins: Join[]): Join[] => {
  const out = [...joins];
  const join = (from: number, to: number): Join | null => {
    const e = pointAt(routes[from]!.points, routes[from]!.length);
    const s = pointAt(routes[to]!.points, 0);
    const way = wayOf(e, s);
    const d = Math.hypot(s.x - e.x, s.z - e.z);
    const arc = way && d < JUNCTION_REACH ? arcBetween(routes[from]!, routes[to]!) : null;
    return arc && way ? { from, to, way, d, ...arc } : null;
  };
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const [a, b] = [out[i]!, out[j]!];
      const siblings = routes[a.from]!.street === routes[b.from]!.street || routes[a.to]!.street === routes[b.to]!.street;
      if (!siblings || routes[a.from]!.use !== routes[b.to]!.use || !crosses(wayThrough(routes, a), wayThrough(routes, b))) continue;
      const [x, y] = [join(a.from, b.to), join(b.from, a.to)];
      if (x && y && !crosses(wayThrough(routes, x), wayThrough(routes, y))) [out[i], out[j]] = [x, y];
    }
  return out;
};

/** A lane's end left without a way on stops this far short of the junction (m): a vehicle held there leaves its arcs and lanes clear. */
const END_CLEAR = 5;
/** An end this close to another street's lane lies on it (m): a vehicle held there stands in its way. Farther off, at a plain T-junction, the end stays. */
const ON_LANE = 2.5;
/** A held vehicle's nose stays out of another street's lane from this far off its line (m): half a car and half a lane. */
const LANE_CLEAR = 3.5;
/** How far back an end may stop short (m), tried shortest first: a street meeting another at a shallow angle runs beside its lanes a while. */
const STOP_SHORT = Array.from({ length: 25 }, (_, k) => k * 2);

/** The road chains a lane is made of: `Name#k` of each part of its id (a turn round joins two). */
const chainsOf = (r: TrafficRoute): string[] => r.id.split("+").map((part) => part.split(":")[0]!);

/** How far (x, z) lies from a polyline. */
const distanceTo = (pts: readonly Pt[], x: number, z: number): number => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
  }
  return best;
};

/**
 * How far back each lane end inside the map with no way on stops short of the junction, when it
 * lies by the arcs of the joins round it (within `END_CLEAR`) or on another chain's lane (within
 * `ON_LANE`: Aleja Andersa on Mełgiewska's lanes): the shortest of `STOP_SHORT` that keeps
 * `END_CLEAR` from the arcs and `LANE_CLEAR` from the lanes, within a third of the lane. Any other
 * end stays where it is. An end with a free start right at it, within 60 degrees of its way, goes
 * on there.
 */
const stopsShort = (routes: readonly TrafficRoute[], joins: readonly Join[]): Map<number, number> => {
  const ended = new Set(joins.map((j) => j.from));
  const taken = new Set(joins.map((j) => j.to));
  const arcs = joins.flatMap((j) => j.arc);
  const starts = routes.map((r) => pointAt(r.points, 0));
  const out = new Map<number, number>();
  routes.forEach((r, i) => {
    const e = pointAt(r.points, r.length);
    if (ended.has(i) || r.use === "deliveries" || !deepInMap(e.x, e.z)) return;
    const free = (s: (typeof starts)[number], j: number) =>
      !taken.has(j) && routes[j]!.use === r.use && Math.hypot(s.x - e.x, s.z - e.z) < STREET_GOES_ON && s.tx * e.tx + s.tz * e.tz > 0.5;
    if (starts.some(free)) return;
    // Other chains' lanes, its own street's too (Ruska's two chains cross): not its own chain's other lanes beside it.
    const own = chainsOf(r);
    const others = routes.filter((o) => o.use !== "deliveries" && !chainsOf(o).some((c) => own.includes(c)));
    const clear = (cut: number, lanes: number) => {
      const p = pointAt(r.points, r.length - cut);
      return arcs.every(([x, z]) => Math.hypot(x - p.x, z - p.z) >= END_CLEAR) && others.every((o) => distanceTo(o.points, p.x, p.z) >= lanes);
    };
    if (clear(0, ON_LANE)) return;
    const cut = STOP_SHORT.find((c) => c <= r.length / 3 && clear(c, LANE_CLEAR));
    if (cut !== undefined) out.set(i, cut);
  });
  return out;
};

/** The lanes of a chain of joins (each join into the next lane) as one route, its last lane cut back by `endCut`. */
const compose = (routes: readonly TrafficRoute[], lanes: readonly number[], joins: readonly Join[], endCut: number): TrafficRoute => {
  const points: Pt[] = [];
  const turns: [number, number][] = [];
  const stops: number[] = [];
  let len = 0;
  let time = 0;
  const arcs: [number, number][] = [];
  let arcFrom: number | null = null;
  let arcTurns = false;
  const push = (p: Pt): void => {
    const last = points[points.length - 1];
    if (last) len += Math.hypot(p[0] - last[0], p[1] - last[1]);
    points.push(p);
  };
  lanes.forEach((k, n) => {
    const r = routes[k]!;
    const into = joins[n - 1];
    const onto = joins[n];
    const from = into?.cutStart ?? 0;
    const to = r.length - (onto ? onto.cutEnd : n === lanes.length - 1 ? endCut : 0);
    const piece = slice(r.points, from, to);
    push(piece[0]!);
    // The arc of the join into this lane ends where the lane takes over; it is a turn unless it went straight on.
    if (arcFrom !== null) {
      arcs.push([arcFrom, len]);
      if (arcTurns) turns.push([arcFrom, len]);
    }
    arcFrom = null;
    const base = len;
    for (const p of piece.slice(1)) push(p);
    let turned = 0;
    for (const [x, y] of r.turns ?? []) {
      if (x < from || y > to) continue;
      turns.push([base + x - from, base + y - from]);
      turned += y - x;
    }
    for (const s of r.stops) if (s >= from && s <= to) stops.push(Math.round((base + s - from) * 10) / 10);
    time += (len - base - turned) / r.speed + turned / TURN_SPEED;
    if (!onto) return;
    arcFrom = len;
    arcTurns = onto.way !== "straight";
    for (const p of onto.arc.slice(1, -1)) push(p);
    time += polylineLength(onto.arc) / (onto.way === "straight" ? r.speed : TURN_SPEED);
  });
  const first = routes[lanes[0]!]!;
  return {
    id: lanes.map((k) => routes[k]!.id).join(">"),
    street: first.street,
    use: first.use,
    points,
    length: len,
    // One timetable for the whole route: the time its lanes take at their own speeds, and its turns at `TURN_SPEED`.
    speed: Math.round((len / time) * 100) / 100,
    // One timetable spreads its vehicles evenly: at the spacing its vehicles had on their own lanes
    // (each lane's density weighted by its vehicles), so a main road joined to side streets keeps
    // most of its traffic instead of the plain average.
    vehicles: Math.max(1, Math.round((len * lanes.reduce((s, k) => s + routes[k]!.vehicles ** 2 / routes[k]!.length, 0)) / lanes.reduce((s, k) => s + routes[k]!.vehicles, 0))),
    stops,
    ...(turns.length > 0 ? { turns } : {}),
    ...(arcs.length > 0 ? { arcs } : {}),
  };
};

/**
 * The lanes joined at the junctions (ADR-0055): each chain of joins as one route, from the lane
 * nothing drives into, in the lanes' order; a lane with no join stays as it was, but for stopping
 * short of the junction's arcs when another end took its way on. A ring of joins
 * (none in today's map) opens at its first lane, whose start the ring's last end then gives up.
 */
export const joinAtJunctions = (routes: readonly TrafficRoute[]): TrafficRoute[] => {
  const joins = junctionJoins(routes);
  const short = stopsShort(routes, joins);
  const next = new Map(joins.map((j) => [j.from, j]));
  const into = new Set(joins.map((j) => j.to));
  const done = new Set<number>();
  const out: TrafficRoute[] = [];
  const follow = (head: number): void => {
    const lanes = [head];
    const chain: Join[] = [];
    done.add(head);
    for (let j = next.get(head); j && !done.has(j.to); j = next.get(j.to)) {
      chain.push(j);
      lanes.push(j.to);
      done.add(j.to);
    }
    const cut = short.get(lanes[lanes.length - 1]!) ?? 0;
    out.push(chain.length === 0 && cut === 0 ? routes[head]! : compose(routes, lanes, chain, cut));
  };
  routes.forEach((_, i) => {
    if (!into.has(i)) follow(i);
  });
  routes.forEach((_, i) => {
    if (!done.has(i)) follow(i);
  });
  return out;
};
