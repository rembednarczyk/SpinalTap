import { P1_CABINS, P1_RAMP, p1DriveFloor } from "./alchemia/parking";
import type { Pt } from "./lublin/roads";
import { bezier } from "./traffic-junctions";
import { TURN_SPEED, type TrafficRoute, pointAt, projectOn, slice } from "./traffic-lane";

/**
 * The cars of Alchemia's P-1 in the street's traffic (ADR-0074 §4, G-491, G-510): one route in,
 * along Bajkowskiego (one way east) on its left lane, turning left off it onto the car park's
 * driveway (`turn:lanes=left|right`, way 40052294) and down the ramp's east lane to the apron and
 * into the south hand-over cabin; one route out, from the north cabin up the ramp's west lane,
 * left onto Bajkowskiego's left lane and with it left again, north up Lubartowska (one way) past
 * Olejna to where the city's route ends. Both are the city's route along Bajkowskiego's left lane,
 * cut where they leave or join it, so their cars drive its lane at its pace and give way as the
 * rest of the traffic does. Pure data of the map, built once.
 */

/** The ramp's carriageway, west of the footway along its east wall: its axis, and its lanes this far either side (m). */
const AXIS = (P1_RAMP.minX + P1_RAMP.walk) / 2;
const LANE = 1.6;
/** Down on the east (keep right), up on the west. */
export const RAMP_DOWN_X = AXIS + LANE;
export const RAMP_UP_X = AXIS - LANE;
/** The turn off Bajkowskiego onto the driveway and back onto it: its radius (m). */
const MOUTH = 5;
/** The turns between the ramp's lanes and the apron at its foot: their radii (m). */
const FOOT_IN = 2.6;
const FOOT_OUT = 4;
const [CABIN_IN, CABIN_OUT] = [P1_CABINS[0]!, P1_CABINS[1]!];
/**
 * The cars a hand-over cabin (6 m deep) takes, by the city's weights: no van or delivery van, whose
 * tail sweeps over the pay machine and the hall's wall on the turn out of the north cabin.
 */
const CABIN_MODELS = [
  ["sedan", 30],
  ["hatchback", 25],
  ["taxi", 15],
] as const;
/** A car stands in a cabin this far from its back wall (its middle, m): its tail clear of the shutter. */
const IN_CABIN = 2.8;
const midZ = (c: (typeof P1_CABINS)[number]): number => (c.minZ + c.maxZ) / 2;

const NORTH = { tx: 0, tz: 1 } as const;
const SOUTH = { tx: 0, tz: -1 } as const;
const EAST = { tx: 1, tz: 0 } as const;
const WEST = { tx: -1, tz: 0 } as const;

/** The ramp's east lane from the driveway at `z` down to the turn onto the apron, and its west lane up from the apron to `z`. */
const downFrom = (z: number): Pt[] => [
  [RAMP_DOWN_X, z],
  [RAMP_DOWN_X, midZ(CABIN_IN) - FOOT_IN],
];
const upTo = (z: number): Pt[] => [
  [RAMP_UP_X, midZ(CABIN_OUT) - FOOT_OUT],
  [RAMP_UP_X, z],
];

/** On the apron: from the foot of the east lane west into the south cabin, and out of the north cabin east to the west lane's foot. */
const APRON_IN: readonly Pt[] = [
  [RAMP_DOWN_X - FOOT_IN, midZ(CABIN_IN)],
  [CABIN_IN.minX + IN_CABIN, midZ(CABIN_IN)],
];
const APRON_OUT: readonly Pt[] = [
  [CABIN_OUT.minX + IN_CABIN, midZ(CABIN_OUT)],
  [RAMP_UP_X - FOOT_OUT, midZ(CABIN_OUT)],
];

/** A point on Bajkowskiego's carriageway by the driveway, north of its axis. */
const BY_DRIVEWAY = { x: AXIS, z: P1_RAMP.top - 8 } as const;

/** The city's route that drives Bajkowskiego's left lane past the driveway, eastwards. */
const leftLaneOf = (routes: readonly TrafficRoute[]): TrafficRoute => {
  const d = (r: TrafficRoute) => projectOn(r.points, BY_DRIVEWAY.x, BY_DRIVEWAY.z);
  const east = routes.filter((r) => r.use === "cars" && r.id.includes("Bajkowskiego#") && pointAt(r.points, d(r).s).tx > 0.9);
  const near = [...east].sort((a, b) => d(a).d - d(b).d)[0];
  if (!near) throw new Error("No lane of Bajkowskiego by Alchemia's driveway");
  return near;
};

/** The arc length on a route driving east along Bajkowskiego where it passes `x`. */
const sAtX = (r: TrafficRoute, x: number): number => {
  const z = pointAt(r.points, projectOn(r.points, x, BY_DRIVEWAY.z).s).z;
  return projectOn(r.points, x, z).s;
};

interface Piece {
  readonly points: readonly Pt[];
  /** Driven off the map's paving (the driveway, the ramp, the apron), at `TURN_SPEED`. */
  readonly own?: true;
  /** An arc from lane to lane. */
  readonly arc?: true;
  /** The city route's part from this arc length to that one (its turns and arcs come with it). */
  readonly city?: readonly [number, number];
}

type Range = [number, number];

/** The pieces one after another as one route of `from`'s street and pace, its arcs and its own way by arc length. */
const join = (id: string, from: TrafficRoute, pieces: readonly Piece[]): TrafficRoute => {
  const points: Pt[] = [];
  const arcs: Range[] = [];
  const turns: Range[] = [];
  const own: Range[] = [];
  let len = 0;
  for (const p of pieces) {
    const start = len;
    for (const q of p.points) {
      const last = points[points.length - 1];
      if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1e-6) continue;
      if (last) len += Math.hypot(q[0] - last[0], q[1] - last[1]);
      points.push(q);
    }
    if (p.arc) arcs.push([start, len]);
    const prev = own[own.length - 1];
    if (p.own && prev && prev[1] === start) prev[1] = len;
    else if (p.own) own.push([start, len]);
    const kept = p.city;
    if (!kept) continue;
    const moved = (rs: readonly (readonly [number, number])[] | undefined): Range[] =>
      (rs ?? []).filter(([a, b]) => a >= kept[0] && b <= kept[1]).map(([a, b]) => [a - kept[0] + start, b - kept[0] + start]);
    arcs.push(...moved(from.arcs));
    turns.push(...moved(from.turns));
  }
  const ownLen = own.reduce((s, [a, b]) => s + b - a, 0);
  // One timetable: the city's part at the city route's pace, its own way at `TURN_SPEED`.
  const time = (len - ownLen) / from.speed + ownLen / TURN_SPEED;
  const byStart = (a: Range, b: Range) => a[0] - b[0];
  return {
    id,
    street: from.street,
    use: "cars",
    points,
    length: len,
    speed: Math.round((len / time) * 100) / 100,
    vehicles: 1,
    stops: [],
    turns: [...own.map((r): Range => [r[0], r[1]]), ...turns].sort(byStart),
    arcs: arcs.sort(byStart),
    ownWay: own,
    models: CABIN_MODELS,
  };
};

/** The routes in and out of P-1, built on the city's routes (`joinAtJunctions`). */
export const alchemiaRampRoutes = (routes: readonly TrafficRoute[]): TrafficRoute[] => {
  const city = leftLaneOf(routes);
  const leave = sAtX(city, RAMP_DOWN_X - MOUTH);
  const off = pointAt(city.points, leave);
  const down = downFrom(off.z + MOUTH);
  const into = join("alchemia-p1:in", city, [
    { points: slice(city.points, 0, leave), city: [0, leave] },
    { points: bezier([off.x, off.z], off, down[0]!, NORTH), own: true, arc: true },
    { points: down, own: true },
    { points: bezier(down[1]!, NORTH, APRON_IN[0]!, WEST), own: true, arc: true },
    { points: APRON_IN, own: true },
  ]);
  const back = sAtX(city, RAMP_UP_X + MOUTH);
  const on = pointAt(city.points, back);
  const up = upTo(on.z + MOUTH);
  const onto = join("alchemia-p1:out", city, [
    { points: APRON_OUT, own: true },
    { points: bezier(APRON_OUT[1]!, EAST, up[0]!, SOUTH), own: true, arc: true },
    { points: up, own: true },
    { points: bezier(up[1]!, SOUTH, [on.x, on.z], on), own: true, arc: true },
    { points: slice(city.points, back, city.length), city: [back, city.length] },
  ]);
  return [into, onto];
};

/** The ramp's two lanes and the apron's (for the scan: where its cars keep to between the driveway and the cabins). */
export const alchemiaRampLanes = (routes: readonly TrafficRoute[]): (readonly Pt[])[] => {
  const city = leftLaneOf(routes);
  const offZ = pointAt(city.points, sAtX(city, RAMP_DOWN_X - MOUTH)).z;
  const onZ = pointAt(city.points, sAtX(city, RAMP_UP_X + MOUTH)).z;
  return [downFrom(offZ + MOUTH), APRON_IN, APRON_OUT, upTo(onZ + MOUTH)];
};

/**
 * A route's segments at the street's level: all of them, but on a ramp route those under the
 * ground (down the ramp and on P-1, `p1DriveFloor`) left out, a metre at a time. The crowd keeps
 * off these (the driveway's mouth across the footway too), not off the car park over P-1.
 */
export const streetSegments = (r: TrafficRoute): (readonly [Pt, Pt])[] => {
  const all = r.points.slice(1).map((p, i) => [r.points[i]!, p] as const);
  if (!r.ownWay) return all;
  return all.flatMap(([a, b]) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const at = (k: number): Pt => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
    return Array.from({ length: n }, (_, k) => [at(k), at(k + 1)] as const).filter(([p, q]) => p1DriveFloor((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) === null);
  });
};

/** A car going round someone keeps this far off the ramp's walls (m). */
const WALL_ROOM = 0.25;

/**
 * How far a car of half width `halfW` may step aside (right +, left -) from a ramp route's line at
 * a point of it heading (tx, tz), so its body stays clear of the walls: down the ramp between
 * them; on the car park's driveway over P-1's top as anywhere on the street (no limit); none at
 * all on the turns at the ramp's foot, on the apron and in the cabins.
 */
const roomAt = (x: number, z: number, tz: number, halfW: number): readonly [number, number] => {
  const r = P1_RAMP;
  if (p1DriveFloor(x, z) === null) return [-Infinity, Infinity];
  if (x > r.minX && x < r.maxX && z > r.top && z < r.foot && Math.abs(tz) > 0.99) {
    const [a, b] = [(r.minX + halfW + WALL_ROOM - x) / tz, (r.maxX - halfW - WALL_ROOM - x) / tz];
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [0, 0];
};

/** Every so often over this far ahead (m) the room aside is read: a car back in its lane before the room narrows. */
const ROOM_AHEAD = 14;
const ROOM_STEP = 1;

/**
 * The room aside (its least and most, the lane's own line always in it) for a car at arc length
 * `s` of a route, over `ahead` metres from there, where any of it lies on the route's own way
 * (Alchemia's ramp and P-1); null off it (the street's own rule).
 */
export const ownWayRoom = (r: TrafficRoute, s: number, halfW: number, ahead = ROOM_AHEAD): readonly [number, number] | null => {
  const own = r.ownWay;
  if (!own?.some(([a, b]) => s + ahead >= a && s <= b)) return null;
  let [lo, hi] = [-Infinity, Infinity];
  for (let k = 0; k <= ahead; k += ROOM_STEP) {
    const t = s + k;
    if (!own.some(([a, b]) => t >= a && t <= b)) continue;
    const p = pointAt(r.points, t);
    const [l, h] = roomAt(p.x, p.z, p.tz, halfW);
    lo = Math.max(lo, l);
    hi = Math.min(hi, h);
  }
  return [Math.min(lo, 0), Math.max(hi, 0)];
};
