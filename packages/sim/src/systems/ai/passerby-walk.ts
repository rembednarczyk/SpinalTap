import type { Vec3 } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { followSchedule } from "../../world/schedule";
import { walkLane } from "./crowd-walk";
import { steerPoint } from "./steering";

type Walker = Entity & { velocity: Vec3; passerby: NonNullable<Entity["passerby"]> };

/** Walking speed of the passers-by, a little different for each (m/s). */
const WALK = [1.25, 1.1, 1.35] as const;
/** Closer than this the walk is straight onto the spot, slowing down and turning to its facing. */
const FINAL_APPROACH = 1.2;
/** Seconds between looks for a way round obstacles (steering is not free). */
const REPATH_SECONDS = 0.6;
/** A waypoint closer than this is reached: look for the next one. */
const WAYPOINT_REACHED = 0.4;

/**
 * One step of a passer-by's routine (ADR-0040): to its spot round the obstacles, then onto it,
 * facing the spot's way. The way round comes from the shared steering (ADR-0025), looked up
 * a few times a second, not every step.
 */
export const walkRoutine = (ctx: SimContext, self: Walker, dt: number): void => {
  const p = self.passerby;
  // A resident on a route of the crowd (ADR-0041).
  if (p.lane) {
    walkLane(ctx, self as Parameters<typeof walkLane>[1], dt);
    return;
  }
  const speed = WALK[p.index % WALK.length] ?? WALK[0];
  const dx = p.goal.x - self.position.x;
  const dz = p.goal.z - self.position.z;
  if (Math.hypot(dx, dz) <= FINAL_APPROACH) {
    p.waypoint = null;
    followSchedule(self, { stop: 0, position: p.goal, heading: p.yaw, arrived: true }, speed, dt);
    return;
  }
  p.repath -= dt;
  const w = p.waypoint;
  if (!w || p.repath <= 0 || Math.hypot(w.x - self.position.x, w.z - self.position.z) < WAYPOINT_REACHED) {
    p.waypoint = steerPoint(ctx.world, self.position, p.goal);
    p.repath = REPATH_SECONDS;
  }
  const to = p.waypoint ?? p.goal;
  const wx = to.x - self.position.x;
  const wz = to.z - self.position.z;
  const d = Math.hypot(wx, wz);
  if (d < 1e-6) {
    self.velocity = { x: 0, y: 0, z: 0 };
    return;
  }
  self.velocity = { x: (wx / d) * speed, y: 0, z: (wz / d) * speed };
  self.yaw = Math.atan2(wx, wz);
};
