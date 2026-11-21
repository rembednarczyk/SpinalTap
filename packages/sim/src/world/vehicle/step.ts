import { type DriveInput, type InputFrame, type VehicleSpec, vehicleSpec } from "@seki/core";
import { type V3, add, cross, length, scale, sub, toBody, toWorld, integrate, v3 } from "./frame";
import { automatic, wheelTorques } from "./drivetrain";
import { type CarState, forwardSpeed, mountOf } from "./state";
import { type CarGround, suspensionForces } from "./suspension";
import { tyreForces } from "./tyre";

/** Substeps of a 60 Hz step: 240 Hz (ADR-0097 §2, pkt 2 of the pattern). */
export const SUBSTEPS = 4;
const GRAVITY = 9.81;
const AIR = 1.2;

/** How fast the keyboard's controls follow the keys (1/s): steer in and back, throttle and brake on and off. */
const EASE = { steerIn: 2.6, steerBack: 4.5, pedalOn: 4, pedalOff: 8 } as const;

const toward = (from: number, to: number, rate: number, dt: number): number => {
  const d = to - from;
  const step = rate * dt;
  return Math.abs(d) <= step ? to : from + Math.sign(d) * step;
};

/** The controls of a car nobody drives: the handbrake alone (a held brake pedal at a standstill selects reverse, `automatic`). */
const PARKED: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: true };

/**
 * The driver's input as the car takes it (ADR-0097 §1): a device's own axes as they are; else the
 * movement axes (forward throttle, back brake, strafe the steer with left positive) eased at the
 * keyboard's rates, and `jump` the handbrake.
 */
export const easeControls = (car: CarState, input: InputFrame | DriveInput | null, dt: number): void => {
  const c = car.controls;
  if (input && "throttle" in input) {
    c.throttle = input.throttle;
    c.brake = input.brake;
    c.steer = input.steer;
    c.handbrake = input.handbrake;
    return;
  }
  // Nobody at the wheel: left in park, on the handbrake, as a driver leaves a car (it rolls only when pushed).
  if (!input) return easeControls(car, PARKED, dt);
  const f = input as InputFrame;
  const drive = f.drive;
  if (drive) return easeControls(car, drive, dt);
  const z = f.moveZ;
  const steer = -f.moveX;
  c.throttle = toward(c.throttle, Math.max(0, z), z > 0 ? EASE.pedalOn : EASE.pedalOff, dt);
  c.brake = toward(c.brake, Math.max(0, -z), z < 0 ? EASE.pedalOn : EASE.pedalOff, dt);
  c.steer = toward(c.steer, steer, steer !== 0 && Math.sign(steer) === Math.sign(c.steer || steer) ? EASE.steerIn : EASE.steerBack, dt);
  c.handbrake = f.jump === true;
};

/** The body's inertia (diagonal, its own frame) from its box: m/3·(b² + c²) of the half extents. */
const inertia = (spec: VehicleSpec): V3 => {
  const { x, y, z } = spec.half;
  const m = spec.mass / 3;
  return v3(m * (y * y + z * z), m * (x * x + z * z), m * (x * x + y * y));
};

/** Aerodynamic drag against the velocity and downforce at the axles (ADR-0097 §2.5). */
const aeroForces = (car: CarState, spec: VehicleSpec): { at: V3; force: V3 }[] => {
  const v = length(car.vel);
  const drag = scale(car.vel, -0.5 * AIR * spec.aero.drag * v);
  const down = toWorld(car.q, v3(0, -1, 0));
  const q = 0.5 * AIR * v * v;
  return [
    { at: car.pos, force: drag },
    { at: add(car.pos, toWorld(car.q, mountOf(spec, 0))), force: scale(down, q * spec.aero.front) },
    { at: add(car.pos, toWorld(car.q, mountOf(spec, 2))), force: scale(down, q * spec.aero.rear) },
  ];
};

/**
 * One substep (ADR-0097 §2.6): suspension, drive and tyres, aero, then the rigid body by
 * semi-implicit Euler (velocities first, then the position and the rotation by the quaternion,
 * renormalized), the inertia in the body's frame with the gyroscopic term.
 */
export const substep = (car: CarState, spec: VehicleSpec, ground: CarGround, grip: number, dt: number): { shifted: boolean } => {
  const pedals = automatic(car, spec, dt);
  const forces = [...suspensionForces(car, spec, ground, dt)];
  forces.push(...tyreForces(car, spec, wheelTorques(car, spec, pedals), grip, dt));
  forces.push(...aeroForces(car, spec));
  let f = v3(0, -GRAVITY * spec.mass, 0);
  let torque = v3(0, 0, 0);
  for (const p of forces) {
    f = add(f, p.force);
    torque = add(torque, cross(sub(p.at, car.pos), p.force));
  }
  car.vel = add(car.vel, scale(f, dt / spec.mass));
  const I = inertia(spec);
  const wb = toBody(car.q, car.ang);
  const tb = toBody(car.q, torque);
  const gyro = cross(wb, v3(I.x * wb.x, I.y * wb.y, I.z * wb.z));
  const wb2 = v3(wb.x + ((tb.x - gyro.x) / I.x) * dt, wb.y + ((tb.y - gyro.y) / I.y) * dt, wb.z + ((tb.z - gyro.z) / I.z) * dt);
  car.ang = toWorld(car.q, wb2);
  car.pos = add(car.pos, scale(car.vel, dt));
  car.q = integrate(car.q, car.ang, dt);
  return { shifted: pedals.shifted };
};

/** Speed and spin under which a car with no driver and no throttle counts as still (m/s, rad/s). */
const STILL = { v: 0.05, w: 0.05, seconds: 1 } as const;

/**
 * A 60 Hz step of a car: the controls eased once, four substeps. A car nobody drives settles and
 * falls asleep after a second still; it wakes when driven or pushed (`wake`).
 */
export const driveCar = (car: CarState, input: InputFrame | DriveInput | null, ground: CarGround, dt: number, grip = 1): { shifted: boolean } => {
  if (car.asleep && !input) return { shifted: false };
  car.asleep = false;
  easeControls(car, input, dt);
  const spec = vehicleSpec(car.model);
  const h = dt / SUBSTEPS;
  let shifted = false;
  for (let k = 0; k < SUBSTEPS; k++) shifted = substep(car, spec, ground, grip, h).shifted || shifted;
  holdStill(car);
  const idle = !input && length(car.vel) < STILL.v && length(car.ang) < STILL.w;
  car.still = idle ? car.still + dt : 0;
  if (car.still >= STILL.seconds) {
    car.asleep = true;
    car.vel = v3(0, 0, 0);
    car.ang = v3(0, 0, 0);
    for (const w of car.wheels) w.omega = 0;
  }
  return { shifted };
};

/** Speed and spin under which a braked car holds (m/s, rad/s). */
const HOLD = { v: 0.2, w: 0.2 } as const;

/**
 * Static friction at a standstill: the slip model gives a force in proportion to the creep (κ and
 * α over `v₀`), so a car braked on a slope would creep a few centimetres a second. A braked car
 * all but stopped is held where it stopped, on the ground plane (its springs still work), until
 * the brakes let go or the throttle pulls; the tyres hold far more than a road's slope asks.
 */
const holdStill = (car: CarState): void => {
  const c = car.controls;
  // In reverse the pedals swap (`automatic`): the brake pedal drives it.
  const [throttle, brake] = car.gear < 0 ? [c.brake, c.throttle] : [c.throttle, c.brake];
  const braked = (c.handbrake || brake > 0.3) && throttle < 0.05;
  if (!braked || Math.hypot(car.vel.x, car.vel.z) > HOLD.v || length(car.ang) > HOLD.w) {
    car.hold = null;
    return;
  }
  if (!car.hold) {
    car.hold = { ...car.pos };
    return;
  }
  car.pos = v3(car.hold.x, car.pos.y, car.hold.z);
  car.vel = v3(0, car.vel.y, 0);
};

/** Wakes a sleeping car (a hit, someone getting in). */
export const wake = (car: CarState): void => {
  car.asleep = false;
  car.still = 0;
};

/** Speed in km/h along the heading, for the HUD. */
export const kmh = (car: CarState): number => forwardSpeed(car) * 3.6;

/** The gear for the HUD: "R", "N" or its number. */
export const gearName = (car: CarState): string => (car.gear < 0 ? "R" : car.gear === 0 ? "N" : String(car.gear));
