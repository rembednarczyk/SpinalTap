import type { Vec3 } from "@seki/core";
import type { System } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";

/** Mika walks a little slower than a jog, so Seki can keep up while looking around (ADR-0024). */
export const ESCORT_SPEED = 1.8;
/** She walks only while Seki is this close (metres, horizontally); otherwise she waits. */
export const ESCORT_FOLLOW_RADIUS = 9;
/** A waypoint this close is reached. */
const ARRIVE = 0.4;

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

const segmentDistance = (p: Vec3, a: Vec3, b: Vec3): number => {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2));
  return Math.hypot(a.x + abx * t - p.x, a.z + abz * t - p.z);
};

/**
 * Where to walk next along a route, or null at its end. Stateless: the segment nearest to
 * `at` (the lowest on a tie) tells how far along she is, so a loaded game picks up the route
 * from the saved position.
 */
export const nextOnRoute = (route: readonly Vec3[], at: Vec3): Vec3 | null => {
  let seg = 0;
  let best = Infinity;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (!a || !b) continue;
    const d = segmentDistance(at, a, b);
    if (d < best - 1e-9) {
      best = d;
      seg = i;
    }
  }
  for (let i = seg + 1; i < route.length; i++) {
    const p = route[i];
    if (p && flat(p, at) > ARRIVE) return p;
  }
  return null;
};

/**
 * The escorted defector (ADR-0024): walks the route towards the boat while Seki is near and
 * waits for her otherwise, facing her. Stateless, like the civilians' AI.
 */
export const escortAiSystem: System = {
  name: "escort-ai",
  run(ctx) {
    const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
    for (const e of inCreationOrder(ctx.world.with("escort", "velocity"))) {
      const next = nextOnRoute(e.escort.route, e.position);
      if (!player || !next || flat(player.position, e.position) > ESCORT_FOLLOW_RADIUS) {
        e.velocity = { x: 0, y: 0, z: 0 };
        if (player && next) e.yaw = Math.atan2(player.position.x - e.position.x, player.position.z - e.position.z);
        continue;
      }
      const dx = next.x - e.position.x;
      const dz = next.z - e.position.z;
      const d = Math.hypot(dx, dz);
      e.velocity = { x: (dx / d) * ESCORT_SPEED, y: 0, z: (dz / d) * ESCORT_SPEED };
      e.yaw = Math.atan2(dx, dz);
    }
  },
};
