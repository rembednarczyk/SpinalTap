import { type VehicleSpec, magic } from "@seki/core";
import { type V3, add, cross, dot, normalize, scale, sub, toWorld, wheelAxes } from "./frame";
import type { WheelTorques } from "./drivetrain";
import { type CarState, forwardSpeed, isFront, isLeft } from "./state";

/** Slip past which ABS eases a wheel's brake and traction control its drive (ADR-0097 §2.8). */
const ABS_SLIP = -0.12;
const TC_SLIP = 0.15;

/**
 * The front wheels' steer (rad, positive left): the driver's share of the most the rack gives,
 * which falls with speed (ADR-0097 pkt 4 of the pattern), and Ackermann's inner wheel turning
 * more than the outer by the linkage's share of the geometry.
 */
export const steerAngles = (car: CarState, spec: VehicleSpec): readonly number[] => {
  const v = Math.abs(forwardSpeed(car));
  const centre = car.controls.steer * (spec.steer.max / (1 + v / 18));
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
    let drive = torques.drive[i]!;
    let brake = torques.brake[i]!;
    if (!w.contact || w.load <= 0) {
      // In the air: the drive spins it up, the brake down, the bearings a little.
      const free = w.omega + ((drive - Math.sign(w.omega) * 2) * dt) / I;
      const stop = (brake * dt) / I;
      w.omega = Math.abs(free) <= stop ? 0 : free - Math.sign(free) * stop;
      w.fx = w.fy = w.slipRatio = 0;
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
    if (brake > 0 && kappa0 < ABS_SLIP && Math.abs(vx) > 2) brake *= 0.4;
    if (drive * Math.sign(vx || 1) > 0 && kappa0 * Math.sign(vx || 1) > TC_SLIP) drive *= 0.5;
    const fx0 = magic(t.longitudinal, kappa0) * w.load * grip;
    const kw = (slope(t.longitudinal, kappa0) * w.load * grip * r) / denom;
    const inertia = I + dt * r * kw;
    let omega = w.omega + (dt * (drive - r * fx0)) / inertia;
    const stop = (brake * dt) / inertia;
    omega = Math.abs(omega) <= stop ? 0 : omega - Math.sign(omega) * stop;
    w.omega = omega;
    const kappa = (omega * r - vx) / denom;
    let fx = magic(t.longitudinal, kappa) * w.load * grip - t.rolling * w.load * Math.max(-1, Math.min(1, vx / 0.5));
    let fy = -magic(t.lateral, w.alpha) * w.load * grip;
    const mx = t.longitudinal.d * w.load * grip;
    const my = t.lateral.d * w.load * grip;
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

/** Left and front of wheel `i`, for the telemetry's labels. */
export const wheelName = (i: number): string => `${isFront(i) ? "F" : "R"}${isLeft(i) ? "L" : "R"}`;

