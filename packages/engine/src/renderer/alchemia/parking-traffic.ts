import { P1, P1_CABINS, groundY, p1DriveFloor } from "@seki/sim";

/**
 * The cars of Alchemia's P-1 on the move (ADR-0074 §4), for the eye: since G-491 they are the
 * simulation's traffic (`traffic-ramp.ts` in the simulation), drawn with the rest of it
 * (`vehicle-views.ts`); one comes along Bajkowskiego, down the ramp's east lane and into the south
 * hand-over cabin, another out of the north cabin, up the west lane and away north up Lubartowska.
 * What is left here is P-1's own: the cabins' shutters going up before a car and down behind it,
 * and the pitch of a car on the ramp. Pure: lifts from the cars round the cabins, a pitch at a place.
 */

/** A car on the move as the renderer has it: where it is and its heading (radians from +z towards +x). */
export interface CarAt {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** A shutter rises and falls over this long (s), this high (m). */
const SHUTTER_TIME = 1.2;
export const SHUTTER_RISE = 2.3;
/** A car on the apron this far in front of a cabin's doorway, within this much of its width either side (m), heading in, has its shutter up. */
const BEFORE_DOOR = 9;
const BESIDE_DOOR = 1.2;
/** A car leaving a cabin keeps its shutter up until its tail is out: its middle this far past the doorway (m). */
const PAST_DOOR = 3;

/** The cabins' shutters: the box each one fills shut (its doorway on the apron). */
export const SHUTTERS = P1_CABINS.map((c) => ({ x0: c.maxX - 0.1, x1: c.maxX, z0: c.minZ + 0.2, z1: c.maxZ - 0.2, y0: P1.floor, y1: P1.floor + SHUTTER_RISE + 0.2 }));

/** Is a car in cabin `c`, coming up to its doorway (heading west, into it), or just out of it? */
const atDoor = (c: (typeof P1_CABINS)[number], car: CarAt): "in" | "door" | null => {
  if (car.x >= c.minX && car.x <= c.maxX && car.z >= c.minZ && car.z <= c.maxZ) return "in";
  if (car.z < c.minZ - BESIDE_DOOR || car.z > c.maxZ + BESIDE_DOOR || car.x < c.maxX || car.x > c.maxX + BEFORE_DOOR) return null;
  return car.x <= c.maxX + PAST_DOOR || Math.sin(car.yaw) < -0.3 ? "door" : null;
};

/**
 * How far each cabin's shutter is up (0 shut .. 1 open) `dt` seconds after `lifts`: up at once
 * with a car inside (it comes up from the garage below, the shutter already opening), rising
 * before a car heading in and while one leaves, falling once none is by its doorway.
 */
export const shutterLifts = (lifts: readonly number[], cars: Iterable<CarAt>, dt: number): number[] => {
  const want = P1_CABINS.map(() => 0);
  for (const car of cars) {
    P1_CABINS.forEach((c, i) => {
      const at = atDoor(c, car);
      if (at === "in") want[i] = 2;
      else if (at === "door") want[i] = Math.max(want[i]!, 1);
    });
  }
  const step = dt / SHUTTER_TIME;
  return want.map((w, i) => {
    const now = lifts[i] ?? 0;
    if (w === 2) return 1;
    return w > now ? Math.min(w, now + step) : Math.max(w, now - step);
  });
};

/** The floor under (x, z): down the ramp and on P-1 theirs, the map's ground elsewhere. */
const floorAt = (x: number, z: number): number => p1DriveFloor(x, z) ?? groundY(x, z);

/** The nose-up pitch (radians) of a car at (x, z) heading `yaw` with a metre of it either way on the ramp; none elsewhere. */
export const rampPitch = (x: number, z: number, yaw: number): number => {
  const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
  if (p1DriveFloor(x + fx, z + fz) === null && p1DriveFloor(x - fx, z - fz) === null) return 0;
  return Math.atan2(floorAt(x + fx, z + fz) - floorAt(x - fx, z - fz), 2);
};
