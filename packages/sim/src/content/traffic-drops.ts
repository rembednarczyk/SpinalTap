import { bezier, deepInMap, onCarriageway, tightest } from "./traffic-junctions";
import { type TrafficRoute, pointAt, projectOn, stitch } from "./traffic-lane";

/**
 * Lane drops (G-989): a street of two lanes one way whose one lane ends at a junction while the
 * other goes on through it (Ruska at Lwowska, Lubartowska at Ruska, Podzamcze south) left the
 * ending lane's vehicles standing on its end, where the junction gives it no way on (`lane-dead-end`).
 * Its route now changes onto the lane beside it before its end and drives on along that lane's route.
 * Pattern: the lane reduction transition of the road codes, a merging taper of length L = W·S²/155
 * (MUTCD 2009 §6C.08, metric, S < 70 km/h; W the lanes' spacing in m, S the speed in km/h), and
 * the mandatory lane change of traffic microsimulation (SUMO's strategic change off a lane with no
 * way on). Unlike a simulation the change is drawn into the route once, as the deptak's mouth does
 * for Bajkowskiego (`traffic-deptak.ts`): the vehicles follow their timetables along it. Where the
 * room is short the taper shortens down to `MIN_TAPER`; with no room the lane stays as it was.
 */

/** The lane beside lies this far off the ending lane's end (m): two lanes 3.2 m apart, with slack. */
const BESIDE = [2.2, 4.4] as const;
/** Lanes side by side head within this of one another (its cosine). */
const PARALLEL_COS = 0.95;
/** The lane beside goes on at least this far past the ending lane's end (m). */
const GOES_ON = 20;
/** The change ends this far short of the ending lane's end (m), as Bajkowskiego's does. */
const CHANGE_CLEAR = 4;
/** The shortest taper tried (m), Bajkowskiego's change, and the step down from the code's. */
const MIN_TAPER = 14;
const TAPER_STEP = 2;
/** A lane change bends no tighter than this (m). */
const CHANGE_RADIUS = 8;

/** The code's taper for lanes `w` apart at `speed` m/s (m). */
export const taperLength = (w: number, speed: number): number => (w * (speed * 3.6) ** 2) / 155;

/** The street's lane a route ends on: its last lane's id up to the lane's number (`Ruska#113:`). */
const lastLane = (r: TrafficRoute): string => {
  const last = r.id.split("+").pop()!.split(">").pop()!.split("~").pop()!;
  return last.slice(0, last.lastIndexOf(":") + 1);
};

/** The route of the lane beside `r`'s end going on past it: the nearest of its street's other lanes. */
const besideAtEnd = (routes: readonly TrafficRoute[], r: TrafficRoute): { o: TrafficRoute; s: number; w: number } | null => {
  const e = pointAt(r.points, r.length);
  const lane = lastLane(r);
  let best: { o: TrafficRoute; s: number; w: number } | null = null;
  for (const o of routes) {
    if (o === r || o.use !== r.use || o.ring || !o.id.includes(lane)) continue;
    const q = projectOn(o.points, e.x, e.z);
    const p = pointAt(o.points, q.s);
    if (q.d < BESIDE[0] || q.d > BESIDE[1] || p.tx * e.tx + p.tz * e.tz < PARALLEL_COS || o.length - q.s < GOES_ON) continue;
    if (!best || q.d < best.w) best = { o, s: q.s, w: q.d };
  }
  return best;
};

/** The route `r` changing onto `o` before its end, with the longest taper that fits, or null. */
const dropped = (r: TrafficRoute, o: TrafficRoute, s: number, w: number): TrafficRoute | null => {
  const to = s - CHANGE_CLEAR;
  for (let taper = Math.max(MIN_TAPER, taperLength(w, o.speed)); taper >= MIN_TAPER; taper -= TAPER_STEP) {
    if (to - taper < 0) continue;
    const p = pointAt(o.points, to - taper);
    const from = projectOn(r.points, p.x, p.z);
    if (from.s <= 0 || from.d < BESIDE[0] || from.d > BESIDE[1]) continue;
    const a = pointAt(r.points, from.s);
    const b = pointAt(o.points, to);
    const change = bezier([a.x, a.z], a, [b.x, b.z], b);
    if (tightest(change) < CHANGE_RADIUS || !onCarriageway(change)) continue;
    return stitch(
      `${r.id}~${o.id}`,
      [
        { of: r, from: 0, to: from.s },
        { points: change, speed: o.speed },
        { of: o, from: to, to: o.length },
      ],
      r.vehicles,
    );
  }
  return null;
};

/**
 * The routes with every car route that ends at a junction with no lane starting by its end, while
 * its street's lane beside goes on, changed onto that lane before its end (in its place, so the
 * vehicles keep their ids).
 */
export const laneDrops = (routes: readonly TrafficRoute[]): TrafficRoute[] => {
  const starts = routes.map((r) => ({ r, p: pointAt(r.points, 0) }));
  return routes.map((r) => {
    if (r.use !== "cars" || r.ring || r.ownWay || r.points.length < 2) return r;
    const e = pointAt(r.points, r.length);
    if (!deepInMap(e.x, e.z) || starts.some(({ r: o, p }) => o !== r && o.use === r.use && Math.hypot(p.x - e.x, p.z - e.z) < 3 && p.tx * e.tx + p.tz * e.tz > 0.5)) return r;
    const beside = besideAtEnd(routes, r);
    return (beside && dropped(r, beside.o, beside.s, beside.w)) ?? r;
  });
};
