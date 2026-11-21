import { VEHICLE_SIZE, type VehicleModel } from "../ports/types";

/**
 * A drivable car's data (ADR-0097 §1): what the simulation's vehicle system integrates, one table
 * per body. Units SI (kg, m, N, N·m, rad, s). The car's own frame (`world/vehicle/frame.ts` of the
 * simulation): y up, z forward, x to the driver's right; positive steer turns left (ADR-0097 §2a).
 *
 * The numbers follow a light rear-driven sports coupe (about 1350 kg, 280 kW), the street's car
 * (`veh-cyber`, decision of 19.11), and published magnitudes for such a car: Pacejka's "magic
 * formula" coefficients of a road tyre (B ≈ 10–12, C ≈ 1.9 laterally, 1.65 longitudinally, E ≈ 0.97 laterally and 0.2 longitudinally, peaks at some 9° and 12%),
 * a springs' natural frequency of 1.5-1.8 Hz, dampers at a quarter to a third of critical.
 */
export interface PacejkaCoefficients {
  readonly b: number;
  readonly c: number;
  /** Peak friction coefficient on dry asphalt, times the load. */
  readonly d: number;
  readonly e: number;
}

export interface VehicleSpec {
  readonly mass: number;
  /** Half extents of the body's box (collision and inertia), m. */
  readonly half: { readonly x: number; readonly y: number; readonly z: number };
  /** The centre of mass over the floor of the body's box (m). */
  readonly comHeight: number;
  /** Distance between the axles and between the wheels of an axle (m). */
  readonly wheelbase: number;
  readonly track: number;
  /** Share of the wheelbase the front axle lies ahead of the centre of mass (0..1). */
  readonly frontShare: number;
  readonly wheelRadius: number;
  /** A wheel's rotational inertia (kg·m²). */
  readonly wheelInertia: number;
  /** The suspension: rest length of the spring under the mount, its travel, rate (N/m), damping in bump and rebound (N·s/m), bump stop rate. */
  readonly suspension: {
    readonly rest: number;
    readonly travel: number;
    readonly spring: readonly [front: number, rear: number];
    readonly bump: number;
    readonly rebound: number;
    readonly stop: number;
  };
  /** Anti-roll bars' rates, front and rear (N/m of difference in compression). */
  readonly antiRoll: readonly [front: number, rear: number];
  readonly tyre: { readonly lateral: PacejkaCoefficients; readonly longitudinal: PacejkaCoefficients; readonly relaxation: number; readonly lowSpeed: number; readonly rolling: number };
  /** Engine torque by rpm (points, linear between), idle and limiter rpm, engine braking (N·m at the limiter). */
  readonly engine: { readonly torque: readonly (readonly [rpm: number, nm: number])[]; readonly idle: number; readonly limiter: number; readonly braking: number; readonly inertia: number };
  /** Forward ratios, reverse ratio, final drive, shift time (s), the automatic's up- and downshift rpm. */
  readonly gearbox: { readonly ratios: readonly number[]; readonly reverse: number; readonly final: number; readonly shiftTime: number; readonly up: number; readonly down: number; readonly efficiency: number };
  readonly drive: "rear" | "front" | "all";
  /** Limited-slip differential: preload (N·m), locking share under power and on the overrun (0..1). */
  readonly diff: { readonly preload: number; readonly power: number; readonly coast: number };
  /** Brakes: most torque per wheel (N·m), share of it on the front, the handbrake's torque on the rear. */
  readonly brakes: { readonly torque: number; readonly front: number; readonly handbrake: number };
  /** Drag area (Cd·A, m²), downforce areas front and rear (Cl·A, m²). */
  readonly aero: { readonly drag: number; readonly front: number; readonly rear: number };
  /** Largest steer of the front wheels (rad) and how much of Ackermann's geometry the linkage gives (0..1). */
  readonly steer: { readonly max: number; readonly ackermann: number };
}

/** The street's sports car (`veh-cyber`). */
export const CYBER_SPEC: VehicleSpec = {
  mass: 1350,
  half: { x: 0.91, y: 0.6, z: 2.25 },
  comHeight: 0.48,
  wheelbase: 2.65,
  track: 1.58,
  frontShare: 0.47,
  wheelRadius: 0.33,
  wheelInertia: 1.2,
  suspension: { rest: 0.34, travel: 0.16, spring: [48000, 52000], bump: 2600, rebound: 3800, stop: 250000 },
  antiRoll: [14000, 9000],
  tyre: {
    lateral: { b: 11, c: 1.9, d: 1.05, e: 0.97 },
    longitudinal: { b: 12, c: 1.65, d: 1.1, e: 0.2 },
    relaxation: 0.35,
    lowSpeed: 1.5,
    rolling: 0.012,
  },
  engine: {
    torque: [
      [800, 200],
      [1500, 280],
      [3000, 360],
      [4500, 410],
      [6000, 420],
      [7000, 380],
      [7400, 340],
    ],
    idle: 900,
    limiter: 7200,
    braking: 55,
    inertia: 0.2,
  },
  gearbox: { ratios: [3.4, 2.2, 1.6, 1.25, 1.0, 0.82], reverse: 3.3, final: 3.6, shiftTime: 0.18, up: 6600, down: 2600, efficiency: 0.9 },
  drive: "rear",
  diff: { preload: 80, power: 0.35, coast: 0.2 },
  brakes: { torque: 2600, front: 0.64, handbrake: 1800 },
  aero: { drag: 0.62, front: 0.12, rear: 0.18 },
  steer: { max: 0.58, ackermann: 0.8 },
};

/** The bodies a player can drive: every street car (they all wear the sports car), not the trolleybus. */
export const isDrivable = (model: VehicleModel): boolean => model !== "trolleybus";

/** The spec of a body: the sports car's, sized to the body's box (`VEHICLE_SIZE`). */
export const vehicleSpec = (model: VehicleModel): VehicleSpec => {
  const size = VEHICLE_SIZE[model];
  return {
    ...CYBER_SPEC,
    half: { x: size.width / 2, y: Math.min(size.height, 1.5) / 2 - 0.05, z: size.length / 2 },
    wheelbase: Math.round(size.length * 0.59 * 100) / 100,
    track: Math.round((size.width - 0.24) * 100) / 100,
  };
};

/** The engine's torque at `rpm` (N·m at full throttle), linear between the table's points, flat past its ends. */
export const engineTorque = (spec: VehicleSpec, rpm: number): number => {
  const t = spec.engine.torque;
  if (rpm <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [r1, n1] = t[i]!;
    const [r0, n0] = t[i - 1]!;
    if (rpm <= r1) return n0 + ((n1 - n0) * (rpm - r0)) / (r1 - r0);
  }
  return t[t.length - 1]![1];
};

/** Pacejka's magic formula: the force share (of the load times D) at slip `x` (κ or α). */
export const magic = (p: PacejkaCoefficients, x: number): number => {
  const bx = p.b * x;
  return p.d * Math.sin(p.c * Math.atan(bx - p.e * (bx - Math.atan(bx))));
};
