import type { Vec3 } from "@seki/core";
import type { SchedulePose } from "../../world/components";

/**
 * A guard's patrol along a fixed route (ADR-0082 §3, `ai.route`): the closed loop of its points
 * walked at `ROUTE_SPEED` with a halt of `ROUTE_HALT` seconds at every point, where it looks
 * round. Where it should be is a pure function of the simulation's time and its phase, as a
 * guard's watch is, so nothing of it is saved: after a chase or a search it walks back to the
 * route's point of the moment.
 */

/** Walking pace on a route (m/s) and the halt at each of its points (s). */
export const ROUTE_SPEED = 1.4;
export const ROUTE_HALT = 4;

export interface GuardRoute {
  /** The loop's points, in order; the last one leads back to the first. */
  readonly points: readonly [Vec3, ...Vec3[]];
  /** Seconds into the loop at time 0, so two guards on one loop keep apart. */
  readonly phase: number;
}

interface Leg {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly length: number;
}

const legsOf = (points: readonly Vec3[]): Leg[] =>
  points.map((from, i) => {
    const to = points[(i + 1) % points.length] as Vec3;
    return { from, to, length: Math.hypot(to.x - from.x, to.z - from.z) };
  });

/** One lap's seconds: every leg walked and every halt held. */
export const routeLapSeconds = (points: readonly Vec3[]): number => legsOf(points).reduce((s, l) => s + l.length / ROUTE_SPEED + ROUTE_HALT, 0);

/**
 * Where the guard of `route` should be `seconds` into the game: halted at a point (facing along
 * the next leg) or walking a leg (facing along it). The pose of a daily plan, so the walk of the
 * schedules follows it.
 */
export const routePose = (route: GuardRoute, seconds: number): SchedulePose => {
  const legs = legsOf(route.points);
  const lap = routeLapSeconds(route.points);
  let t = lap > 0 ? (((seconds + route.phase) % lap) + lap) % lap : 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i] as Leg;
    const heading = Math.atan2(leg.to.x - leg.from.x, leg.to.z - leg.from.z);
    if (t < ROUTE_HALT) return { stop: i, position: leg.from, heading, arrived: true };
    t -= ROUTE_HALT;
    const walk = leg.length / ROUTE_SPEED;
    if (t < walk) {
      const k = walk > 0 ? t / walk : 1;
      const position = { x: leg.from.x + (leg.to.x - leg.from.x) * k, y: leg.from.y + (leg.to.y - leg.from.y) * k, z: leg.from.z + (leg.to.z - leg.from.z) * k };
      return { stop: i, position, heading, arrived: false };
    }
    t -= walk;
  }
  const first = legs[0] as Leg;
  return { stop: 0, position: first.from, heading: Math.atan2(first.to.x - first.from.x, first.to.z - first.from.z), arrived: true };
};
