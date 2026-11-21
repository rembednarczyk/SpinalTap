import { type VehicleSpec, magic } from "@seki/core";
import { type V3, add, cross, dot, normalize, scale, sub, toWorld, wheelAxes } from "./frame";
import type { WheelTorques } from "./drivetrain";
import { type CarState, forwardSpeed, isFront, isLeft } from "./state";

/** Slip past which ABS eases a wheel's brake and traction control its drive (ADR-0097 §2.8). */
const ABS_SLIP = -0.12;
const TC_SLIP = 0.12;
/**
 * Traction control's span: past `TC_SLIP` the drive falls in proportion to the slip, none left this far
 * over it (a proportional TCS, as a car's ECU cuts the torque; user's notes of 21.11). Halving the
 * drive, as before, left first gear's torque several times the grip of the inside wheel in a turn:
 * it spun at a slip of 5 and the tail came round.
 */
const TC_SPAN = 0.2;
/**
 * The share of the tyres' grip the steering asks for at most, and the small angle over the turn's own
 * the front may slip by (rad): in a steady turn the steer is the turn's angle `L/R` and the difference
 * of the axles' slips, not a tyre's whole slip, so a car steered to its tyres' peak slip on top turns
 * past its grip (13 m/s² asked of 10, and the tail goes).
 */
const STEER_GRIP = 0.85;
const STEER_MARGIN = 0.03;
const GRAVITY = 9.81;

/**
 * The most the front wheels steer at speed `v` (m/s): speed-sensitive steering, the assist arcade and
 * sim-cade games give a keyboard and a pad (a key is all or nothing). The angle of the tightest turn the
 * tyres hold at most of their grip (the wheelbase over the radius of a circle at `STEER_GRIP`·μg,
 * `L·μg/v²`) and a little over, never past the rack's lock; at walking pace the full lock. Before, the lock only fell as
 * `1/(1 + v/18)`: 13° at 100 km/h where some 8° is all the tyres hold, the front at 30° of slip and the
 * car round in a second and a half without any throttle (user's notes of 21.11).
 */
export const steerLimit = (spec: VehicleSpec, v: number): number =>
  Math.min(spec.steer.max, (spec.wheelbase * STEER_GRIP * spec.tyre.lateral.d * GRAVITY) / Math.max(v * v, 1e-6) + STEER_MARGIN);

/**
 * The front wheels' steer (rad, positive left): the driver's share of the most the rack gives,
 * which falls with speed as the tyres' grip allows (`steerLimit`, ADR-0097 pkt 4 of the pattern), and Ackermann's inner wheel turning
 * more than the outer by the linkage's share of the geometry.
 */
export const steerAngles = (car: CarState, spec: VehicleSpec): readonly number[] => {
  const v = Math.abs(forwardSpeed(car));
  const centre = car.controls.steer * steerLimit(spec, v);
  if (Math.abs(centre) < 1e-6) return [0, 0, 0, 0];
  const radius = spec.wheelbase / Math.tan(Math.abs(centre));
  const inner = Math.atan(spec.wheelbase / Math.max(radius - spec.track / 2, 0.5));
  const outer = Math.atan(spec.wheelbase / (radius + spec.track / 2));
  const blend = (a: number) => Math.sign(centre) * (Math.abs(centre) + spec.steer.ackermann * (a - Math.abs(centre)));
  // Turning left the left wheel is the inner one.
  const left = centre > 0 ? blend(inner) : blend(outer);
  const right = centre > 0 ? blend(outer) : blend(inner);
  return [left, right, 0, 0];
};

/** The slope of the magic formula at `x` (finite difference), never below a tenth of its slope at 0. */
const slope = (p: VehicleSpec["tyre"]["longitudinal"], x: number): number => {
  const e = 1e-4;
  const d = (magic(p, x + e) - magic(p, x - e)) / (2 * e);
  return Math.max(d, 0.1 * p.b * p.c * p.d);
};

/**
 * The tyres (ADR-0097 §2.2–2.3): the contact's velocity in the wheel's frame on the ground; slip
 * ratio `κ = (ωr − vx)/max(|vx|, v₀)` and the slip angle relaxed towards `atan(vy/max(|vx|, v₀))`
 * over the relaxation length; Pacejka's forces for the load, the friction ellipse, rolling
 * resistance. The wheel's spin is integrated semi-implicitly on the tyre's slope (the stiff
 * equation of a light wheel on a stiff tyre would blow up explicitly at 240 Hz), the brake
 * clamping it to zero, never past. Returns the forces (world) at the contacts.
 */
export const tyreForces = (car: CarState, spec: VehicleSpec, torques: WheelTorques, grip: number, dt: number): { at: V3; force: V3 }[] => {
  const t = spec.tyre;
  const r = spec.wheelRadius;
  const I = spec.wheelInertia;
  const steer = steerAngles(car, spec);
  const out: { at: V3; force: V3 }[] = [];
  car.wheels.forEach((w, i) => {
    const g = isFront(i) ? grip : grip * t.rearGrip;
    let drive = torques.drive[i]!;
    let brake = torques.brake[i]!;
    if (!w.contact || w.load <= 0) {
      // In the air: the drive spins it up, the brake down, the bearings a little.
      const free = w.omega + ((drive - Math.sign(w.omega) * 2) * dt) / I;
      const stop = (brake * dt) / I;
      w.omega = Math.abs(free) <= stop ? 0 : free - Math.sign(free) * stop;
      w.rolled += w.omega * r * dt;
      w.fx = w.fy = w.slipRatio = 0;
      w.eased = null;
      return;
    }
    const n = w.normal;
    const axes = wheelAxes(steer[i]!);
    const fw0 = toWorld(car.q, axes.forward);
    const fw = normalize(sub(fw0, scale(n, dot(fw0, n))));
    const rw = normalize(cross(n, fw));
    const vc = add(car.vel, cross(car.ang, sub(w.contact, car.pos)));
    const vx = dot(vc, fw);
    const vy = dot(vc, rw);
    const denom = Math.max(Math.abs(vx), t.lowSpeed);
    const alphaK = Math.atan2(vy, denom);
    w.alpha += (alphaK - w.alpha) * Math.min(1, ((Math.abs(vx) + t.lowSpeed) * dt) / t.relaxation);
    const kappa0 = (w.omega * r - vx) / denom;
    // Assists: ease the brake of a locking wheel, the drive of a spinning one.
    w.eased = null;
    if (brake > 0 && kappa0 < ABS_SLIP && Math.abs(vx) > 2) {
      brake *= 0.4;
      w.eased = "abs";
    }
    if (drive * Math.sign(vx || 1) > 0 && kappa0 * Math.sign(vx || 1) > TC_SLIP) {
      drive *= Math.max(0, 1 - (kappa0 * Math.sign(vx || 1) - TC_SLIP) / TC_SPAN);
      w.eased = "tc";
    }
    const fx0 = magic(t.longitudinal, kappa0) * w.load * g;
    const kw = (slope(t.longitudinal, kappa0) * w.load * g * r) / denom;
    const inertia = I + dt * r * kw;
    let omega = w.omega + (dt * (drive - r * fx0)) / inertia;
    const stop = (brake * dt) / inertia;
    omega = Math.abs(omega) <= stop ? 0 : omega - Math.sign(omega) * stop;
    w.omega = omega;
    w.rolled += omega * r * dt;
    const kappa = (omega * r - vx) / denom;
    let fx = magic(t.longitudinal, kappa) * w.load * g - t.rolling * w.load * Math.max(-1, Math.min(1, vx / 0.5));
    let fy = -magic(t.lateral, w.alpha) * w.load * g;
    const mx = t.longitudinal.d * w.load * g;
    const my = t.lateral.d * w.load * g;
    const e = (fx / mx) ** 2 + (fy / my) ** 2;
    if (e > 1) {
      const k = 1 / Math.sqrt(e);
      fx *= k;
      fy *= k;
    }
    w.slipRatio = kappa;
    w.slipAngle = w.alpha;
    w.fx = fx;
    w.fy = fy;
    out.push({ at: w.contact, force: add(scale(fw, fx), scale(rw, fy)) });
  });
  return out;
};

/** The skid's strength for the sound and the HUD: the largest slip over the wheels (0 grip, 1 sliding). */
export const skid = (car: CarState): number =>
  Math.min(1, Math.max(0, ...car.wheels.map((w) => (w.load > 0 ? Math.max(Math.abs(w.slipRatio) / 0.3, Math.abs(w.slipAngle) / 0.3) : 0))));

/** Whether ABS or traction control eased any wheel in the last substep (the HUD's lamps). */
export const assists = (car: CarState): { readonly abs: boolean; readonly tc: boolean } => ({
  abs: car.wheels.some((w) => w.eased === "abs"),
  tc: car.wheels.some((w) => w.eased === "tc"),
});

/** Left and front of wheel `i`, for the telemetry's labels. */
export const wheelName = (i: number): string => `${isFront(i) ? "F" : "R"}${isLeft(i) ? "L" : "R"}`;

