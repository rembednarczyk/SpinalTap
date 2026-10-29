import { type EntityId, type GameClock, VEHICLE_SIZE, type VehicleModel, hourOf } from "@seki/core";
import { CAR_MODELS, DELIVERY_HOURS, TRAFFIC_BY_HOUR, TRAFFIC_RANGE, TRAFFIC_ROUTES, type TrafficDensity, type TrafficRoute, pointAt } from "../content/traffic";
import { deriveRandom } from "../rng/derive-random";
import { realSeconds } from "./crowd";

/**
 * The street's traffic (ADR-0050), as pure functions of the seed and the clock like the
 * passers-by (ADR-0040) and the crowd (ADR-0041): which vehicles drive along a lane at the
 * hour, which model and paint each one has, and where its timetable puts it now. A vehicle
 * held up (by someone on the road, a shot) falls behind its timetable and catches up again;
 * nothing of that is saved, so after a load every vehicle is back on its timetable.
 */

/** Vehicles' ids live far above everything else's (the street's solids are at 2 000 000). */
export const VEHICLE_ID_BASE = 3_000_000;
/** Ids per lane; more than any lane holds. */
export const VEHICLE_IDS_PER_ROUTE = 32;

/** Seconds a trolleybus stands at each stop. */
export const TROLLEY_DWELL = 12;

export interface VehiclePlan {
  readonly route: number;
  readonly index: number;
  readonly model: VehicleModel;
  readonly tint: number;
  /** The lane's cruising speed for this game (every vehicle of a lane drives it). */
  readonly speed: number;
  /** Where on its timetable it starts (s for a car, seconds into the cycle for a trolleybus). */
  readonly phase: number;
}

export const vehicleId = (route: number, index: number): EntityId => VEHICLE_ID_BASE + route * VEHICLE_IDS_PER_ROUTE + index;

/** Golden ratio's fractional part: the vehicles of a lane spread evenly for any count. */
const SPREAD = 0.618034;

const pickModel = (u: number): VehicleModel => {
  const total = CAR_MODELS.reduce((s, [, w]) => s + w, 0);
  let left = u * total;
  for (const [m, w] of CAR_MODELS) {
    if (left < w) return m;
    left -= w;
  }
  return "sedan";
};

/** One full lap of a trolleybus's timetable: the drive and a dwell at every stop (s). */
export const trolleyCycle = (route: TrafficRoute, speed: number): number => route.length / speed + route.stops.length * TROLLEY_DWELL;

const plans = new Map<string, VehiclePlan>();

/** Who vehicle `index` of lane `route` is in the game of `seed`. Memoised. */
export const vehiclePlan = (seed: number, route: number, index: number): VehiclePlan => {
  const key = `${seed}:${route}:${index}`;
  const known = plans.get(key);
  if (known) return known;
  const r = TRAFFIC_ROUTES[route]!;
  const lane = deriveRandom(seed, `traffic-lane:${r.id}`);
  const start = lane.next();
  const speed = r.speed * (0.88 + lane.next() * 0.12);
  const own = deriveRandom(seed, `traffic-vehicle:${r.id}:${index}`);
  const model: VehicleModel = r.use === "trolley" ? "trolleybus" : r.use === "deliveries" ? (own.next() < 0.5 ? "van" : "delivery") : pickModel(own.next());
  const tint = Math.floor(own.next() * 0x7fffffff);
  const spread = (start + index * SPREAD) % 1;
  const phase = r.use === "trolley" ? trolleyCycle(r, speed) * spread : r.length * spread;
  const plan = { route, index, model, tint, speed, phase };
  plans.set(key, plan);
  return plan;
};

/** Is a lane one the delivery vans use now? A third of the pedestrian streets, in the morning only. */
const deliveryLane = (seed: number, r: TrafficRoute, clock: GameClock): boolean => {
  const h = hourOf(clock);
  return h >= DELIVERY_HOURS.from && h < DELIVERY_HOURS.to && deriveRandom(seed, `traffic-delivery:${r.id}`).next() < 1 / 3;
};

/** How many vehicles drive lane `route` at the clock's hour with the density's share. */
export const vehicleCount = (seed: number, route: number, density: TrafficDensity, clock: GameClock): number => {
  const r = TRAFFIC_ROUTES[route];
  const share = TRAFFIC_RANGE[density].share;
  if (!r || share <= 0) return 0;
  if (r.use === "deliveries") return deliveryLane(seed, r, clock) ? 1 : 0;
  const level = TRAFFIC_BY_HOUR[hourOf(clock)] ?? 0;
  if (r.use === "trolley") return level < 0.2 ? 0 : r.vehicles;
  return Math.min(VEHICLE_IDS_PER_ROUTE, Math.round(r.vehicles * share * level));
};

/** Where a vehicle's timetable puts it: arc length along its lane and the timetable's own speed there. */
export const timetable = (plan: VehiclePlan, clock: GameClock): { readonly s: number; readonly v: number } => {
  const r = TRAFFIC_ROUTES[plan.route]!;
  const t = realSeconds(clock);
  if (r.use !== "trolley" || r.stops.length === 0) {
    const s = (((plan.phase + plan.speed * t) % r.length) + r.length) % r.length;
    return { s, v: plan.speed };
  }
  const cycle = trolleyCycle(r, plan.speed);
  let left = (((plan.phase + t) % cycle) + cycle) % cycle;
  let at = 0;
  for (const stop of r.stops) {
    const drive = (stop - at) / plan.speed;
    if (left < drive) return { s: at + left * plan.speed, v: plan.speed };
    left -= drive;
    if (left < TROLLEY_DWELL) return { s: stop, v: 0 };
    left -= TROLLEY_DWELL;
    at = stop;
  }
  return { s: Math.min(r.length, at + left * plan.speed), v: plan.speed };
};

/** The pose on a lane at arc length `s`, stepped `aside` metres to the right of it. */
export const lanePose = (route: TrafficRoute, s: number, aside = 0): { x: number; z: number; yaw: number; tx: number; tz: number } => {
  const p = pointAt(route.points, s);
  return { x: p.x + p.tz * aside, z: p.z - p.tx * aside, yaw: Math.atan2(p.tx, p.tz), tx: p.tx, tz: p.tz };
};

/** Half the footprint of a model: across, along. */
export const halfSize = (model: VehicleModel): { readonly w: number; readonly l: number } => ({ w: VEHICLE_SIZE[model].width / 2, l: VEHICLE_SIZE[model].length / 2 });
