import { type DriveInput, type Vec3, driverSeat, vehicleSpec } from "@seki/core";
import { add, toWorld, v3 } from "./frame";
import { type CarState, restHeight } from "./state";

/*
 * Getting into and out of the car with the user's clips (ADR-0097, Mixamo clips of 21.11). The
 * simulation keeps the clip's time and plays the part that matters, faster than the clip: getting
 * in starts at the door (the clip's first second and a half walks up to it) and ends seated;
 * getting out ends once she stands clear of the door (the rest of the clip turns about). The
 * renderer lays the clip from the time (`Transform.car`).
 */

/** The span of each clip played (seconds of the clip) and how many clip seconds pass in one second. */
export const CAR_ACT = {
  enter: { from: 1.4, to: 5.45, rate: 1.5 },
  exit: { from: 0, to: 3.2, rate: 1.4 },
} as const;

export type CarActKind = keyof typeof CAR_ACT;

/** Getting in or out: which, and the clip's time now (s). */
export interface CarActState {
  readonly kind: CarActKind;
  t: number;
}

export const startAct = (kind: CarActKind): CarActState => ({ kind, t: CAR_ACT[kind].from });

/** Plays the act on by `dt` seconds; true once its clip is through. */
export const stepAct = (act: CarActState, dt: number): boolean => {
  const span = CAR_ACT[act.kind];
  act.t = Math.min(span.to, act.t + dt * span.rate);
  return act.t >= span.to;
};

/** The car held still while she gets in or out: the brake on, the handbrake pulled. */
export const HELD: DriveInput = { throttle: 0, brake: 1, steer: 0, handbrake: true };

/** The driver's hips in the world, carried with the body's tilt (`driverSeat` over the ground under the car). */
export const seatInWorld = (car: CarState): Vec3 => {
  const spec = vehicleSpec(car.model);
  const s = driverSeat(spec);
  const p = add(car.pos, toWorld(car.q, v3(s.x, s.y - restHeight(spec), s.z)));
  return { x: p.x, y: p.y, z: p.z };
};
