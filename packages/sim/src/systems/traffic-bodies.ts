import { TRAFFIC_ROUTES } from "../content/traffic";
import type { Entity, VehicleState } from "../world/components";
import { lanePose } from "../world/traffic";
import { mayMeet } from "./traffic-body-stretches";

/**
 * Two vehicles whose lanes run apart but whose bodies would meet (G-744). Oncoming traffic, and
 * crossing traffic whose ways never come close, keeps to its lane; but a body turns at once with
 * its lane at a bend and its ends swing out by up to its length, and two lanes of a narrow street
 * leave less room than two vans take. Their margin was a few centimetres: a lane moved by one, or
 * a vehicle there a second earlier, and they drove into each other. So both read where their bodies
 * go along their lanes, not their lanes alone.
 */

type Vehicle = Entity & { vehicle: VehicleState };

/** Room the bodies leave each other (m). */
const BODY_GAP = 0.1;
/** Steps along a route a body is read at (m). */
const STEP = 1;
/** A body is read this far past a bend too (m). */
const PAST_BEND = 0.01;

/** A body `at` metres ahead along its route: its centre and the way it faces. */
type Body = { readonly at: number; readonly x: number; readonly z: number; readonly fx: number; readonly fz: number };
type Half = VehicleState["half"];

/** How far a body reaches along the unit axis (ux, uz) from its centre. */
const radius = (b: Body, h: Half, ux: number, uz: number): number =>
  (h.l + BODY_GAP / 2) * Math.abs(b.fx * ux + b.fz * uz) + (h.w + BODY_GAP / 2) * Math.abs(b.fz * ux - b.fx * uz);

/** Is (ux, uz) an axis that separates the two bodies? */
const separates = (p: Body, hp: Half, q: Body, hq: Half, ux: number, uz: number): boolean =>
  Math.abs((q.x - p.x) * ux + (q.z - p.z) * uz) >= radius(p, hp, ux, uz) + radius(q, hq, ux, uz);

/** Do two bodies overlap: no axis of either separates them? */
const overlap = (p: Body, hp: Half, q: Body, hq: Half): boolean =>
  !separates(p, hp, q, hq, p.fz, -p.fx) && !separates(p, hp, q, hq, p.fx, p.fz) && !separates(p, hp, q, hq, q.fz, -q.fx) && !separates(p, hp, q, hq, q.fx, q.fz);

/** Arc lengths of a route's bends (its inner points), worked out once per route. */
const bendsOf = new Map<number, readonly number[]>();
const bends = (route: number): readonly number[] => {
  let out = bendsOf.get(route);
  if (out) return out;
  const pts = TRAFFIC_ROUTES[route]!.points;
  const acc: number[] = [];
  let s = 0;
  for (let i = 1; i + 1 < pts.length; i++) acc.push((s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])));
  bendsOf.set(route, (out = acc));
  return out;
};

/** The first of the sorted arc lengths `at` past `s`. */
const firstPast = (at: readonly number[], s: number): number => {
  let [lo, hi] = [0, at.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid]! <= s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** A vehicle's bodies ahead, the box round their centres, and what they were read for. */
interface Sweep {
  readonly s: number;
  readonly aside: number;
  readonly to: number;
  readonly x: number;
  readonly z: number;
  readonly bodies: readonly Body[];
  readonly box: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** Each vehicle's sweep, read again only once it has moved: every vehicle near it reads it in a step. */
const sweeps = new WeakMap<Vehicle, Sweep>();

/**
 * A vehicle's bodies along its route, `at` metres ahead of it: every `STEP` from where it is to
 * `to` metres ahead, and just past each bend, where its body has turned and swings out most.
 */
const bodiesAhead = (v: Vehicle, to: number): Sweep => {
  const st = v.vehicle;
  const known = sweeps.get(v);
  if (known && known.s === st.s && known.aside === st.aside && known.to === to && known.x === v.position.x && known.z === v.position.z) return known;
  const lane = TRAFFIC_ROUTES[st.route]!;
  const out: Body[] = [{ at: 0, x: v.position.x, z: v.position.z, fx: Math.sin(v.yaw), fz: Math.cos(v.yaw) }];
  const add = (at: number) => {
    const p = lanePose(lane, st.s + at, st.aside);
    out.push({ at, x: p.x, z: p.z, fx: p.tx, fz: p.tz });
  };
  const end = Math.min(st.s + to, lane.length);
  for (let k = STEP; st.s + k <= end; k += STEP) add(k);
  const at = bends(st.route);
  for (let i = firstPast(at, st.s - PAST_BEND); i < at.length && at[i]! + PAST_BEND <= end; i++) add(at[i]! + PAST_BEND - st.s);
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const b of out) {
    box.minX = Math.min(box.minX, b.x);
    box.maxX = Math.max(box.maxX, b.x);
    box.minZ = Math.min(box.minZ, b.z);
    box.maxZ = Math.max(box.maxZ, b.z);
  }
  const sweep = { s: st.s, aside: st.aside, to, x: v.position.x, z: v.position.z, bodies: out, box };
  sweeps.set(v, sweep);
  return sweep;
};

/**
 * Where the bodies of `a` driving up to `reachA` ahead and `b` up to `reachB` would meet: the
 * nearest of those places along each (m), or null if they do not.
 */
export const bodiesMeet = (a: Vehicle, reachA: number, b: Vehicle, reachB: number): { readonly a: number; readonly b: number } | null => {
  const [ha, hb] = [a.vehicle.half, b.vehicle.half];
  // Two bodies whose centres lie farther apart than both their half diagonals do not touch.
  const apart = Math.hypot(ha.l, ha.w) + Math.hypot(hb.l, hb.w) + BODY_GAP;
  if (Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) > reachA + reachB + apart) return null;
  // Off the stretches where the two routes' bodies meet at all (stepped aside, a vehicle leaves its lane's).
  const [sa, sb] = [a.vehicle, b.vehicle];
  if (sa.aside === 0 && sb.aside === 0 && !mayMeet(sa.route, sa.s, sa.s + reachA, sb.route, sb.s, sb.s + reachB)) return null;
  const A = bodiesAhead(a, reachA);
  const B = bodiesAhead(b, reachB);
  if (A.box.maxX + apart < B.box.minX || B.box.maxX + apart < A.box.minX || A.box.maxZ + apart < B.box.minZ || B.box.maxZ + apart < A.box.minZ) return null;
  let [atA, atB] = [Infinity, Infinity];
  for (const p of A.bodies)
    for (const q of B.bodies) {
      if ((p.at >= atA && q.at >= atB) || Math.abs(p.x - q.x) > apart || Math.abs(p.z - q.z) > apart || !overlap(p, ha, q, hb)) continue;
      atA = Math.min(atA, p.at);
      atB = Math.min(atB, q.at);
    }
  return atA === Infinity ? null : { a: atA, b: atB };
};

/** Hardest a vehicle brakes (m/s²): as `drive` lets it. */
const HARD_BRAKE = 9;
/** Within this of each other from where their bodies meet (m), the lower id goes first: a tie, held while both close in. */
const HOLD = 2;

/** Too close to where it meets another, at its speed, to stop short of it however hard it brakes. */
export const cannotStop = (v: Vehicle, at: number): boolean => at - STEP < (v.vehicle.v * v.vehicle.v) / (2 * HARD_BRAKE);

/**
 * Of two vehicles whose bodies meet `a` and `b` metres ahead of them, does `a` go first? One that
 * can no longer stop goes on; else the nearer one, by more than `HOLD`; else the lower id. The one
 * giving way slows down and only falls further behind, so the choice holds as both close in.
 */
export const goesFirst = (a: Vehicle, atA: number, b: Vehicle, atB: number): boolean => {
  const [late, lateB] = [cannotStop(a, atA), cannotStop(b, atB)];
  if (late !== lateB) return late;
  if (Math.abs(atA - atB) > HOLD) return atA < atB;
  return a.id < b.id;
};
