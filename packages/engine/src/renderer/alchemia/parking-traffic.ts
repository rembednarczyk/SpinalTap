import { P1, P1_CABINS, P1_RAMP, groundY, p1RampY } from "@seki/sim";

/**
 * The cars of Alchemia's P-1 on the move (ADR-0074 §4, stage 4), for the eye only: one comes down
 * the ramp from Bajkowskiego on the east lane, turns onto the apron and drives into the south
 * hand-over cabin, whose shutter goes up before it and down behind it; half a cycle later another
 * comes out of the north cabin and drives up the west lane onto the car park. Since stage 7 they come
 * from the street and go back to it (G-491): the one going in drives east along Bajkowskiego (one way,
 * from the junction with Świętoduska) and turns left across the footway onto the driveway, the one
 * going out turns left, east, onto Bajkowskiego and on north up Lubartowska, as the traffic there
 * goes. They join the street only for the eye: the simulation's traffic has no lane into the ramp.
 * The robots of P-2
 * (stage 5) take the cars from the cabins and bring them. A fixed cycle of the renderer's own clock,
 * as the drones' (ADR-0058 stage 7): nobody's state, no solid. Pure: poses at a time.
 */

/** A point of a car's way on the map. */
type P = readonly [number, number];

/** In: east along Bajkowskiego from Świętoduska, left onto the driveway, down the east lane, round onto the apron, west into the south cabin. */
const IN_WAY: readonly P[] = [
  [374.5, -14.6],
  [381.4, -17.0],
  [407.5, -16.5],
  [410.6, -15.7],
  [413.3, -13.9],
  [414.6, -11.6],
  [414.9, P1_RAMP.top - 3.5],
  [414.9, P1_RAMP.foot - 0.5],
  [414.6, 25.4],
  [413.8, 26.2],
  [412.5, 26.6],
  [404.6, 26.6],
  [400.8, 26.6],
];
/** Out: east out of the north cabin, round onto the west lane, up it onto the car park. */
const OUT_WAY: readonly P[] = [
  [400.8, 30.0],
  [409.0, 30.0],
  [410.5, 29.6],
  [411.3, 28.6],
  [411.6, 27.2],
  [411.6, P1_RAMP.top - 3.5],
  [411.6, -11.4],
  [412.5, -13.7],
  [414.6, -15.6],
  [417.6, -16.3],
  [440.4, -15.85],
  [442.5, -14.3],
  [442.9, -9.9],
  [447.2, 16.4],
  [450.0, 26.0],
];

/** How fast they drive (m/s), how long a cycle is, when the second car leaves its cabin (s). */
const SPEED = 2.5;
export const CYCLE = 100;
const OUT_AT = 45;
/** A shutter rises and falls over this long (s), this high (m). */
const SHUTTER_TIME = 2;
export const SHUTTER_RISE = 2.3;

export interface CarPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing (its front), radians from +z towards +x, and its nose up (radians). */
  readonly yaw: number;
  readonly pitch: number;
}

const lengthOf = (way: readonly P[]): number => way.slice(1).reduce((s, b, i) => s + Math.hypot(b[0] - way[i]![0], b[1] - way[i]![1]), 0);
const IN_LENGTH = lengthOf(IN_WAY);
const OUT_LENGTH = lengthOf(OUT_WAY);
/** When the car coming in stands in its cabin, and when the one going out is gone up the ramp. */
const IN_ARRIVES = IN_LENGTH / SPEED;
const OUT_GONE = OUT_AT + OUT_LENGTH / SPEED;

/** The floor under a point of the ways: the ramp's surface over its length, P-1's floor past its foot, the street's ground elsewhere. */
export const floorAt = (x: number, z: number): number => {
  if (z > P1_RAMP.top && x > P1_RAMP.minX && x < P1_RAMP.maxX && z < P1_RAMP.foot) return p1RampY(z);
  return x >= P1.minX && x <= P1.maxX && z >= P1.minZ && z <= P1.maxZ ? P1.floor : groundY(x, z);
};

/** The point `s` metres along a way, its heading, and its nose's pitch over its own length. */
const along = (way: readonly P[], s: number): CarPose => {
  let rest = Math.max(0, s);
  for (let i = 1; i < way.length; i++) {
    const [a, b] = [way[i - 1]!, way[i]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rest <= len || i === way.length - 1) {
      const t = len > 0 ? Math.min(1, rest / len) : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
      const pitch = Math.atan2(floorAt(x + fx, z + fz) - floorAt(x - fx, z - fz), 2);
      return { x, y: floorAt(x, z), z, yaw, pitch };
    }
    rest -= len;
  }
  const last = way[way.length - 1]!;
  return { x: last[0], y: P1.floor, z: last[1], yaw: 0, pitch: 0 };
};

/** The two cars at `time` seconds: null while one is not to be seen (in its cabin behind the shutter, or gone). */
export const carPoses = (time: number): readonly [CarPose | null, CarPose | null] => {
  const t = ((time % CYCLE) + CYCLE) % CYCLE;
  // In from the start of the cycle, seen until its shutter is down behind it.
  const inCar = t <= IN_ARRIVES + SHUTTER_TIME * 2 + 1 ? along(IN_WAY, t * SPEED) : null;
  // Out from its cabin once its shutter is up, seen in the cabin while it rises.
  const outCar = t >= OUT_AT - SHUTTER_TIME - 1 && t <= OUT_GONE ? along(OUT_WAY, (t - OUT_AT) * SPEED) : null;
  return [inCar, outCar];
};

/** 0..1 over a window of `SHUTTER_TIME` from `from`. */
const rise = (t: number, from: number): number => Math.max(0, Math.min(1, (t - from) / SHUTTER_TIME));

/**
 * How far each cabin's shutter is up at `time` (0 shut .. 1 open): the south one before the car
 * coming in reaches it and down once it stands inside, the north one before the car going out
 * leaves and down once it is out on the apron.
 */
export const shutterLifts = (time: number): readonly [number, number] => {
  const t = ((time % CYCLE) + CYCLE) % CYCLE;
  const south = rise(t, IN_ARRIVES - 6) - rise(t, IN_ARRIVES + 1);
  const north = rise(t, OUT_AT - SHUTTER_TIME - 1) - rise(t, OUT_AT + 4);
  return [Math.max(0, south), Math.max(0, north)];
};

/** The cabins' shutters: the box each one fills shut (its doorway on the apron). */
export const SHUTTERS = P1_CABINS.map((c) => ({ x0: c.maxX - 0.1, x1: c.maxX, z0: c.minZ + 0.2, z1: c.maxZ - 0.2, y0: P1.floor, y1: P1.floor + SHUTTER_RISE + 0.2 }));
