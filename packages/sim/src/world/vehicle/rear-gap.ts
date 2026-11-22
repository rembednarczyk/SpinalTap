import { vehicleSpec } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../components";
import { rayGeometry } from "../hitscan";
import { toWorld, v3 } from "./frame";
import type { CarState } from "./state";

/** How far behind its bumper a car's parking sensor sees (m). */
export const SENSOR_RANGE = 1.8;
/** The sensors across the rear bumper, from its middle (m): the middle one and two at its corners. */
const SENSORS = [-0.6, 0, 0.6] as const;
/** Their height over the centre of mass (m, negative under it): the bumper's. */
const BUMPER = -0.15;

/**
 * The gap behind a car's rear bumper to the nearest wall, post or parked car (m), or null with none
 * within `SENSOR_RANGE`: the reading of its parking sensors (ultrasonic park distance control, three
 * across the bumper, the nearest echo wins), for their beeps as she backs up (22.11).
 */
export const rearGap = (world: World<Entity>, car: CarState): number | null => {
  const spec = vehicleSpec(car.model);
  const back = toWorld(car.q, v3(0, 0, -1));
  const dir = v3(back.x, 0, back.z);
  const len = Math.hypot(dir.x, dir.z);
  if (len < 1e-6) return null;
  const d = v3(dir.x / len, 0, dir.z / len);
  let best: number | null = null;
  for (const x of SENSORS) {
    const at = toWorld(car.q, v3(x, BUMPER, -spec.half.z));
    const t = rayGeometry(world, v3(car.pos.x + at.x, car.pos.y + at.y, car.pos.z + at.z), d, SENSOR_RANGE);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
};
