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
  /** Seconds it waits at the start first: at the door while the driver is pulled out. */
  hold: number;
}

export const startAct = (kind: CarActKind, hold = 0): CarActState => ({ kind, t: CAR_ACT[kind].from, hold });

/** Plays the act on by `dt` seconds; true once its clip is through. */
export const stepAct = (act: CarActState, dt: number): boolean => {
  if (act.hold > 0) {
    act.hold = Math.max(0, act.hold - dt);
    return false;
  }
  const span = CAR_ACT[act.kind];
  act.t = Math.min(span.to, act.t + dt * span.rate);
  return act.t >= span.to;
};

/** How long she waits at the door while the driver is pulled out of a taken car (s). */
export const JACK_WAIT = 1.5;

/** The car held still while she gets in or out: the brake on, the handbrake pulled. */
export const HELD: DriveInput = { throttle: 0, brake: 1, steer: 0, handbrake: true };

/** The driver's hips in the world, carried with the body's tilt (`driverSeat` over the ground under the car). */
export const seatInWorld = (car: CarState): Vec3 => {
  const spec = vehicleSpec(car.model);
  const s = driverSeat(spec);
  const p = add(car.pos, toWorld(car.q, v3(s.x, s.y - restHeight(spec), s.z)));
  return { x: p.x, y: p.y, z: p.z };
};

/**
 * The driver's door (user's request of 21.11: doors opening upward, scissor doors as on the
 * Lamborghini Countach, so she and a driver thrown out pass through an open side with the clips as
 * they are). Up while she gets in, until she is sat and pulls it down for the clip's last part, and
 * while she gets out; down otherwise. Seconds of the clip before the end of getting in it comes down.
 */
const DOOR_SHUT_BEFORE = 0.9;
/** How fast it goes up or down (share of its travel per second): some half a second each way. */
const DOOR_RATE = 2.2;

/** Where the door of a car is heading: up for the act played at it (`act`, null for a car nobody is at). */
export const doorTarget = (act: CarActState | null): number => {
  if (!act) return 0;
  if (act.kind === "exit") return 1;
  return act.t < CAR_ACT.enter.to - DOOR_SHUT_BEFORE ? 1 : 0;
};

/** Moves the door `dt` seconds toward `target`. */
export const stepDoor = (car: CarState, target: number, dt: number): void => {
  const step = DOOR_RATE * dt;
  car.door = target > car.door ? Math.min(target, car.door + step) : Math.max(target, car.door - step);
};
