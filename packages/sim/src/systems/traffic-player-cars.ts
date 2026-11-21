import { vehicleSpec } from "@seki/core";
import type { SimContext } from "../world/context";

/**
 * The player's cars with physics (ADR-0097) seen by the street's traffic: the most a vehicle of the
 * traffic at `pose`, `halfL` long and `halfW` wide, may drive to stop `gap` short of the nearest of
 * them in its way, within `reach` (m/s; Infinity with none). As the vehicle ahead going its way
 * (the safe speed of the car-following model, Gipps 1981: braking distance v²/2a), with the car's
 * footprint turned to the lane: a car left across it fills more of it than one parked along it.
 */
export const roomBeforePlayerCars = (
  ctx: SimContext,
  y: number,
  pose: { readonly x: number; readonly z: number; readonly tx: number; readonly tz: number },
  half: { readonly l: number; readonly w: number },
  reach: number,
  brake: number,
  gap0: number,
  margin: number,
): number => {
  let allowed = Infinity;
  for (const c of ctx.world.with("car")) {
    if (Math.abs(c.position.y - y) > 2) continue;
    const dx = c.position.x - pose.x;
    const dz = c.position.z - pose.z;
    const fwd = dx * pose.tx + dz * pose.tz;
    if (fwd <= 0 || fwd > reach + 6) continue;
    const h = vehicleSpec(c.car.model).half;
    const along = Math.abs(Math.sin(c.yaw) * pose.tx + Math.cos(c.yaw) * pose.tz);
    const across = Math.sqrt(Math.max(0, 1 - along * along));
    // The car's half extent along the lane and across it.
    const ext = h.z * along + h.x * across;
    const side = h.z * across + h.x * along;
    if (Math.abs(dx * pose.tz - dz * pose.tx) > half.w + side + margin) continue;
    const gap = fwd - half.l - ext;
    allowed = Math.min(allowed, gap <= gap0 ? 0 : Math.sqrt(2 * brake * (gap - gap0)));
  }
  return allowed;
};
