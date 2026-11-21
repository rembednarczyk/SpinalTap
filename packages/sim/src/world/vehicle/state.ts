import { type DrivingAssist, type VehicleModel, type VehicleSpec, vehicleSpec } from "@seki/core";
import { type Quat, type V3, fromYaw, toWorld, v3 } from "./frame";

/** The wheels in order: front left, front right, rear left, rear right. */
export const WHEELS = 4;
export const isFront = (i: number): boolean => i < 2;
export const isLeft = (i: number): boolean => i % 2 === 0;

/** One wheel's state (ADR-0097 §2): spin, suspension, the tyre's relaxed slip, and what the last substep measured (telemetry). */
export interface WheelState {
  /** Spin (rad/s), positive rolling forward. */
  omega: number;
  /** Spring compression (m), 0 with the wheel in the air. */
  compression: number;
  /** The slip angle the tyre carries (rad), relaxed towards the kinematic one. */
  alpha: number;
  /** Measured each substep. */
  load: number;
  contact: V3 | null;
  normal: V3;
  slipRatio: number;
  slipAngle: number;
  fx: number;
  fy: number;
  /** The assist that eased this wheel in the last substep (ABS its brake, traction control its drive), for the HUD's lamps. */
  eased: "abs" | "tc" | null;
  /** How far its tread has rolled (m, forward positive), for the picture's wheels; not saved. */
  rolled: number;
}

/** The driver's controls as the car feels them (eased from the input, ADR-0097 §1). */
export interface Controls {
  throttle: number;
  brake: number;
  /** -1..1, positive to the left. */
  steer: number;
  handbrake: boolean;
}

/** A drivable car (ADR-0097): a rigid body, four wheels, the engine and the box. */
export interface CarState {
  readonly model: VehicleModel;
  /** The centre of mass in the world. */
  pos: V3;
  q: Quat;
  vel: V3;
  /** Angular velocity in the world (rad/s). */
  ang: V3;
  wheels: WheelState[];
  rpm: number;
  /** Gear: 1.. forward, -1 reverse, 0 neutral. */
  gear: number;
  /** Seconds left of a gear change (no drive meanwhile). */
  shift: number;
  controls: Controls;
  /** Settled and alone: no substeps until something wakes it (ADR-0097 §2). */
  asleep: boolean;
  /** Seconds it has stood still. */
  still: number;
  /** Where a braked, all but stopped car is held (static friction the tyres' slip model lacks at a standstill), or null. */
  hold: V3 | null;
  /** The driver's assists (ADR-0097 §4): her setting while she drives, all of them otherwise. */
  assist: DrivingAssist;
  /** 0 whole .. 1 a wreck (`damage.ts`). */
  damage: number;
  /** The driver's door, 0 shut .. 1 up (`car-act.ts`, the picture only). Not saved: a loaded car stands shut. */
  door: number;
}

const wheel = (): WheelState => ({ omega: 0, compression: 0, alpha: 0, load: 0, contact: null, normal: v3(0, 1, 0), slipRatio: 0, slipAngle: 0, fx: 0, fy: 0, eased: null, rolled: 0 });

/** The height of the centre of mass over flat ground with the springs at their static sag. */
export const restHeight = (spec: VehicleSpec): number => spec.suspension.rest + spec.wheelRadius - (spec.mass * 9.81) / 4 / spec.suspension.spring[0];

/** A car standing on its wheels at ground height `groundY` under (x, z), heading `yaw`, still. */
export const newCar = (model: VehicleModel, x: number, groundY: number, z: number, yaw: number): CarState => {
  const spec = vehicleSpec(model);
  return {
    model,
    pos: v3(x, groundY + restHeight(spec), z),
    q: fromYaw(yaw),
    vel: v3(0, 0, 0),
    ang: v3(0, 0, 0),
    wheels: Array.from({ length: WHEELS }, wheel),
    rpm: spec.engine.idle,
    gear: 1,
    shift: 0,
    controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    asleep: false,
    still: 0,
    hold: null,
    assist: "full",
    damage: 0,
    door: 0,
  };
};

/** The mount of wheel `i` in the body's frame: at the height of the centre of mass, over the wheel. */
export const mountOf = (spec: VehicleSpec, i: number): V3 => {
  const a = spec.wheelbase * spec.frontShare;
  const b = spec.wheelbase - a;
  return v3((isLeft(i) ? -1 : 1) * (spec.track / 2), 0, isFront(i) ? a : -b);
};

/** The car's speed along its heading (m/s, negative backwards). */
export const forwardSpeed = (car: CarState): number => {
  const f = toWorld(car.q, v3(0, 0, 1));
  return car.vel.x * f.x + car.vel.y * f.y + car.vel.z * f.z;
};
