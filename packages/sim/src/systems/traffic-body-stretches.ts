import { VEHICLE_SIZE, type VehicleModel } from "@seki/core";
import { CAR_MODELS, TRAFFIC_ROUTES } from "../content/traffic";
import { pointOn } from "../content/traffic-lane";

/**
 * Where along two routes the bodies of their vehicles can meet at all (G-744), read once per pair
 * of routes as the vehicles first come near each other: the widest and longest vehicle of each
 * route at every half metre of both and just past every bend. Two lanes of a street that keep
 * apart never get there, so the vehicles read their bodies against each other only on those
 * stretches: at a bend, down a narrow street.
 */

/** Samples along a route (m), and how far past a bend one is taken. */
const SAMPLE = 0.5;
const PAST_BEND = 0.01;
/** Room the bodies leave each other (m), as the vehicles read them. */
const GAP = 0.1;
/** Grid cell the samples are sorted into (m). */
const CELL = 8;

type Sample = { readonly s: number; readonly x: number; readonly z: number; readonly fx: number; readonly fz: number };

const modelsOf = (route: number): readonly VehicleModel[] => {
  const r = TRAFFIC_ROUTES[route]!;
  if (r.use === "trolley") return ["trolleybus"];
  if (r.use === "deliveries") return ["van", "delivery"];
  return (r.models ?? CAR_MODELS).map(([m]) => m);
};

/** Half the widest and of the longest vehicle of a route, and a margin. */
const halfOf = (route: number): { readonly w: number; readonly l: number } => {
  const ms = modelsOf(route);
  return { w: Math.max(...ms.map((m) => VEHICLE_SIZE[m].width)) / 2 + GAP / 2, l: Math.max(...ms.map((m) => VEHICLE_SIZE[m].length)) / 2 + GAP / 2 };
};

/** A grid cell's key. */
const cellOf = (cx: number, cz: number): number => (cx + 5000) * 10000 + (cz + 5000);

const samplesOf = new Map<number, ReadonlyMap<number, readonly Sample[]>>();
const samples = (route: number) => {
  const known = samplesOf.get(route);
  if (known) return known;
  const r = TRAFFIC_ROUTES[route]!;
  const at: number[] = [];
  for (let s = 0; s <= r.length; s += SAMPLE) at.push(s);
  let acc = 0;
  for (let i = 1; i + 1 < r.points.length; i++) at.push((acc += Math.hypot(r.points[i]![0] - r.points[i - 1]![0], r.points[i]![1] - r.points[i - 1]![1])) + PAST_BEND);
  const all: Sample[] = at.map((s) => {
    const p = pointOn(r.points, s);
    return { s, x: p.x, z: p.z, fx: p.tx, fz: p.tz };
  });
  const grid = new Map<number, Sample[]>();
  for (const p of all) {
    const k = cellOf(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    const list = grid.get(k);
    if (list) list.push(p);
    else grid.set(k, [p]);
  }
  samplesOf.set(route, grid);
  return grid;
};

const reach = (p: Sample, h: { w: number; l: number }, ux: number, uz: number): number => h.l * Math.abs(p.fx * ux + p.fz * uz) + h.w * Math.abs(p.fz * ux - p.fx * uz);

const meet = (p: Sample, hp: { w: number; l: number }, q: Sample, hq: { w: number; l: number }): boolean =>
  [
    [p.fx, p.fz],
    [p.fz, -p.fx],
    [q.fx, q.fz],
    [q.fz, -q.fx],
  ].every(([ux, uz]) => Math.abs((q.x - p.x) * ux! + (q.z - p.z) * uz!) < reach(p, hp, ux!, uz!) + reach(q, hq, ux!, uz!));

/** Sorted arc lengths of route `a` at which a body of it meets one of route `b` somewhere, and of `b` likewise. */
const stretchesOf = new Map<string, { readonly a: readonly number[]; readonly b: readonly number[] }>();
const stretches = (a: number, b: number): { readonly a: readonly number[]; readonly b: readonly number[] } => {
  const key = `${a}:${b}`;
  const known = stretchesOf.get(key);
  if (known) return known;
  const [ha, hb] = [halfOf(a), halfOf(b)];
  const apart = Math.hypot(ha.l, ha.w) + Math.hypot(hb.l, hb.w);
  const B = samples(b);
  const [onA, onB] = [new Set<number>(), new Set<number>()];
  // Cell by cell of route `a`, against the cells of `b` round it: two routes far apart cost nothing.
  for (const [k, ps] of samples(a)) {
    const [cx, cz] = [Math.floor(k / 10000) - 5000, (k % 10000) - 5000];
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const q of B.get(cellOf(cx + i, cz + j)) ?? [])
          for (const p of ps) {
            if (Math.abs(p.x - q.x) > apart || Math.abs(p.z - q.z) > apart || !meet(p, ha, q, hb)) continue;
            onA.add(p.s);
            onB.add(q.s);
          }
  }
  const out = { a: [...onA].sort((x, y) => x - y), b: [...onB].sort((x, y) => x - y) };
  stretchesOf.set(key, out);
  stretchesOf.set(`${b}:${a}`, { a: out.b, b: out.a });
  return out;
};

/** Is there an arc length of the sorted `at` within [from, to]? */
const within = (at: readonly number[], from: number, to: number): boolean => {
  let [lo, hi] = [0, at.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid]! < from) lo = mid + 1;
    else hi = mid;
  }
  return lo < at.length && at[lo]! <= to;
};

/**
 * Could a body of route `a` driving from arc length `sa` to `ta` meet one of route `b` driving from
 * `sb` to `tb`? Only on the stretches where the two routes' bodies meet at all.
 */
export const mayMeet = (a: number, sa: number, ta: number, b: number, sb: number, tb: number): boolean => {
  if (a === b) return true;
  const st = stretches(a, b);
  return within(st.a, sa - SAMPLE, ta + SAMPLE) && within(st.b, sb - SAMPLE, tb + SAMPLE);
};
