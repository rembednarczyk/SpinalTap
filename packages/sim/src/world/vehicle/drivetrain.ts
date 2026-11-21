import { type VehicleSpec, engineTorque } from "@seki/core";
import { type CarState, forwardSpeed, isFront } from "./state";

/** Torques on each wheel's axle this substep (N·m): the drive (signed, forward positive) and the brake (≥ 0, against the spin). */
export interface WheelTorques {
  readonly drive: readonly number[];
  readonly brake: readonly number[];
}

const RPM = 60 / (2 * Math.PI);

/** The gear's ratio from the engine to the wheels (signed: reverse negative), 0 in neutral. */
export const gearRatio = (spec: VehicleSpec, gear: number): number => {
  const g = spec.gearbox;
  if (gear === 0) return 0;
  return (gear < 0 ? -g.reverse : g.ratios[gear - 1]!) * g.final;
};

const driven = (spec: VehicleSpec, i: number): boolean => spec.drive === "all" || (spec.drive === "rear") === !isFront(i);

/**
 * The automatic box and the arcade's reverse (ADR-0097 §2.4): up past `up` rpm, down under
 * `down`; nearly stopped with the brake held and no throttle it takes reverse (the brake pedal
 * then drives it), and nearly stopped with throttle it takes first. A change cuts the drive for
 * `shiftTime`. Returns the throttle and brake as the car takes them (in reverse they swap).
 */
export const automatic = (car: CarState, spec: VehicleSpec, dt: number): { throttle: number; brake: number; shifted: boolean } => {
  const c = car.controls;
  const v = forwardSpeed(car);
  const box = spec.gearbox;
  let shifted = false;
  const change = (gear: number) => {
    if (gear === car.gear) return;
    car.gear = gear;
    car.shift = box.shiftTime;
    shifted = true;
  };
  if (Math.abs(v) < 1) {
    if (c.brake > 0.1 && c.throttle < 0.05 && car.gear > 0 && v < 0.3) change(-1);
    else if (c.throttle > 0.1 && car.gear < 0 && v > -0.3) change(1);
  }
  if (car.gear > 0 && car.shift <= 0) {
    // The box reads the road speed, not the driven wheels' spin: a wheel spinning in a slide or on
    // a loose surface would shift it up to a gear the car cannot pull (seen at 29 km/h in fifth).
    const rpm = (Math.abs(v) / spec.wheelRadius) * Math.abs(gearRatio(spec, car.gear)) * RPM;
    if (rpm > box.up && car.gear < box.ratios.length) change(car.gear + 1);
    else if (rpm < box.down && car.gear > 1) change(car.gear - 1);
  }
  car.shift = Math.max(0, car.shift - dt);
  return car.gear < 0 ? { throttle: c.brake, brake: c.throttle, shifted } : { throttle: c.throttle, brake: c.brake, shifted };
};

/**
 * The engine and the driveline (ADR-0097 §2.4): the engine turns with the driven wheels through
 * the box while the clutch holds, never under idle (a slipping clutch, as a torque converter at
 * stall, gives the throttle's torque from idle up); torque from the curve times the throttle,
 * engine braking off the throttle, cut at the limiter and during a change; the limited-slip
 * differential moves torque from the faster wheel of the axle to the slower, up to
 * `preload + lock·|T|`. Brakes: the pedal's torque split front and rear, the handbrake on the rear.
 */
export const wheelTorques = (car: CarState, spec: VehicleSpec, pedals: { throttle: number; brake: number }): WheelTorques => {
  const ratio = gearRatio(spec, car.gear);
  const wheelsDriven = car.wheels.filter((_, i) => driven(spec, i));
  const spin = wheelsDriven.reduce((s, w) => s + w.omega, 0) / wheelsDriven.length;
  const fromWheels = Math.abs(spin * ratio) * RPM;
  car.rpm = Math.max(spec.engine.idle, Math.min(fromWheels, spec.engine.limiter * 1.05));
  const cut = car.shift > 0 || ratio === 0 || car.rpm >= spec.engine.limiter;
  const throttle = cut ? 0 : pedals.throttle;
  const engine = engineTorque(spec, car.rpm) * throttle - (1 - throttle) * spec.engine.braking * (car.rpm / spec.engine.limiter);
  // Engine braking only while the clutch holds (the wheels turn the engine over idle).
  const torque = throttle === 0 && fromWheels <= spec.engine.idle ? 0 : engine;
  const axle = torque * ratio * spec.gearbox.efficiency;
  const drive = car.wheels.map(() => 0);
  const pairs = spec.drive === "all" ? [[0, 1], [2, 3]] : spec.drive === "rear" ? [[2, 3]] : [[0, 1]];
  for (const [l, r] of pairs) {
    const share = axle / pairs.length;
    const lock = spec.diff.preload + (share * Math.sign(ratio) >= 0 ? spec.diff.power : spec.diff.coast) * Math.abs(share);
    // The faster wheel hands torque to the slower, a viscous coupling clamped to the lock.
    const moved = Math.max(-lock, Math.min(lock, (car.wheels[l!]!.omega - car.wheels[r!]!.omega) * 400));
    drive[l!] = share / 2 - moved / 2;
    drive[r!] = share / 2 + moved / 2;
  }
  const b = spec.brakes;
  const brake = car.wheels.map((_, i) => {
    const pedal = pedals.brake * b.torque * (isFront(i) ? 1 : (1 - b.front) / b.front);
    return pedal + (car.controls.handbrake && !isFront(i) ? b.handbrake : 0);
  });
  return { drive, brake };
};
