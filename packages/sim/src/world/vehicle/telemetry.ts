import { type TelemetryWheel, vehicleSpec } from "@seki/core";
import { add, cross, normalize, scale, toWorld, wheelAxes } from "./frame";
import { type CarState, mountOf } from "./state";
import { steerAngles } from "./tyre";

/*
 * The car's telemetry (ADR-0097 §3, as the apps of sim-racing games show it): each wheel's mount and
 * contact (the suspension's ray), the force the ground puts on the car there (the tyre's along and
 * across from the last substep, the spring's load up the ground's normal) and how hard it slides.
 * Read by the app behind `?telemetry=1`; nothing of the game's own uses it.
 */

/** How far a wheel slides for the telemetry's colour: 0 gripping .. 1 at a slip of 0.3 either way. */
const SLIDE = 0.3;

export const carTelemetry = (car: CarState): TelemetryWheel[] => {
  const spec = vehicleSpec(car.model);
  const steer = steerAngles(car, spec);
  return car.wheels.map((w, i) => {
    const mount = add(car.pos, toWorld(car.q, mountOf(spec, i)));
    const forward = normalize(toWorld(car.q, wheelAxes(steer[i] ?? 0).forward));
    const right = normalize(cross(w.normal, forward));
    const force = add(add(scale(forward, w.fx), scale(right, w.fy)), scale(w.normal, w.contact ? w.load : 0));
    return {
      mount: { x: mount.x, y: mount.y, z: mount.z },
      contact: w.contact ? { x: w.contact.x, y: w.contact.y, z: w.contact.z } : null,
      force: { x: force.x, y: force.y, z: force.z },
      slip: Math.min(1, Math.max(Math.abs(w.slipRatio), Math.abs(w.slipAngle)) / SLIDE),
    };
  });
};
