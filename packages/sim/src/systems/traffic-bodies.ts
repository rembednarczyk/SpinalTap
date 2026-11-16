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

/**
 * A body `at` metres ahead along its route: the centre of the box it sweeps on its way from halfway
 * back to the body before to halfway on to the next, the way it faces, and how much longer than the
 * body that box reaches each way (m).
 */
type Body = { readonly at: number; readonly x: number; readonly z: number; readonly fx: number; readonly fz: number; readonly more: number };
type Half = VehicleState["half"];

/** How far a body reaches along the unit axis (ux, uz) from its centre. */
const radius = (b: Body, h: Half, ux: number, uz: number): number =>
  (h.l + b.more + BODY_GAP / 2) * Math.abs(b.fx * ux + b.fz * uz) + (h.w + BODY_GAP / 2) * Math.abs(b.fz * ux - b.fx * uz);

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
 * A vehicle's bodies along its route, `at` metres ahead of it: where it is, at every `STEP` of its
 * route up to `to` metres ahead, and just before and past each bend, where its body has turned and
 * swings out most. The steps lie where they lie on the route, not where it is: read from where it
 * happens to be, a narrow place where two bodies meet (one just past a bend) fell between the steps
 * every other frame, the place they met jumped by metres, and which of the two gave way changed
 * from frame to frame (G-768). Each body is as long as the way it covers to the bodies beside it,
 * so no place between two of them is missed either.
 */
const bodiesAhead = (v: Vehicle, to: number): Sweep => {
  const st = v.vehicle;
  const known = sweeps.get(v);
  if (known && known.s === st.s && known.aside === st.aside && known.to === to && known.x === v.position.x && known.z === v.position.z) return known;
  const lane = TRAFFIC_ROUTES[st.route]!;
  const end = Math.min(st.s + to, lane.length);
  const ats: number[] = [];
  for (let k = Math.floor(st.s / STEP) + 1; k * STEP <= end; k++) ats.push(k * STEP - st.s);
  const at = bends(st.route);
  for (let i = firstPast(at, st.s - PAST_BEND); i < at.length && at[i]! + PAST_BEND <= end; i++) {
    if (at[i]! - PAST_BEND > st.s) ats.push(at[i]! - PAST_BEND - st.s);
    ats.push(at[i]! + PAST_BEND - st.s);
  }
  ats.sort((p, q) => p - q);
  const out: Body[] = [];
  const add = (ahead: number, x: number, z: number, fx: number, fz: number, back: number, on: number) =>
    out.push({ at: ahead, x: x + (fx * (on - back)) / 2, z: z + (fz * (on - back)) / 2, fx, fz, more: (back + on) / 2 });
  add(0, v.position.x, v.position.z, Math.sin(v.yaw), Math.cos(v.yaw), 0, (ats[0] ?? 0) / 2);
  ats.forEach((a, i) => {
    const p = lanePose(lane, st.s + a, st.aside);
    add(a, p.x, p.z, p.tx, p.tz, (a - (ats[i - 1] ?? 0)) / 2, ((ats[i + 1] ?? a) - a) / 2);
  });
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
  // Two bodies whose centres lie farther apart than both their half diagonals, each a `STEP` longer, do not touch.
  const apart = Math.hypot(ha.l + STEP / 2, ha.w) + Math.hypot(hb.l + STEP / 2, hb.w) + BODY_GAP;
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
