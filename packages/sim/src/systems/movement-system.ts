import { overFootprint, resolveCircleAabb, topAt } from "../world/collision";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { inCreationOrder } from "../world/ordering";
import { worldTimeScale } from "./ability-system";

const ITERATIONS = 2;

/** Highest ledge a character walks up without noticing (a stair, a kerb), metres. */
export const STEP_HEIGHT = 0.45;
/** Drops up to this follow the ground (walking down stairs); deeper ones are falls. */
export const SNAP_DOWN = 0.35;
export const GRAVITY = 20;
/** How far past an edge the centre may hang before the character drops. */
const EDGE_MARGIN = 0.05;

type Solid = Entity & { solid: NonNullable<Entity["solid"]> };

/** Does the solid stop a character whose feet are at `feet` (ADR-0020)? Ledges low enough are stepped onto. */
const blocks = (s: Solid, x: number, z: number, radius: number, feet: number, height: number): boolean => {
  if (s.solid.min.y >= feet + height) return false;
  const cx = Math.max(s.solid.min.x, Math.min(x, s.solid.max.x));
  const cz = Math.max(s.solid.min.z, Math.min(z, s.solid.max.z));
  const dx = x - cx;
  const dz = z - cz;
  if (dx * dx + dz * dz >= radius * radius) return false;
  return topAt(s.solid, s.slope, cx, cz) > feet + STEP_HEIGHT;
};

/** Height of the floor under a point for feet at `feet`: the street (0) or the highest top within a step up. */
export const groundAt = (solids: readonly Solid[], x: number, z: number, feet: number): number => {
  let ground = 0;
  for (const s of solids) {
    if (!overFootprint(s.solid, x, z, EDGE_MARGIN)) continue;
    const top = topAt(s.solid, s.slope, x, z);
    if (top > ground && top <= feet + STEP_HEIGHT) ground = top;
  }
  return ground;
};

/**
 * Integrates velocity, resolves character footprints against geometry and other bodies, then
 * puts the feet on the floor: stepping up ledges, following stairs down and falling off edges.
 */
export const movementSystem: System = {
  name: "movement",
  run(ctx) {
    const { world } = ctx;
    const enemyDt = ctx.dt * worldTimeScale(ctx);
    // Creation order, not world order: chunks streamed back in are appended to the world, and
    // push-out against overlapping boxes depends on the order they are visited.
    const solids = inCreationOrder(world.with("solid"));
    const bodies = inCreationOrder(world.with("body"));
    for (const e of inCreationOrder(world.with("velocity", "body"))) {
      const dt = e.player ? ctx.dt : enemyDt;
      const feet = e.position.y;
      let x = e.position.x;
      let z = e.position.z;
      if (e.velocity.x !== 0 || e.velocity.z !== 0) {
        x += e.velocity.x * dt;
        z += e.velocity.z * dt;
        for (let i = 0; i < ITERATIONS; i++) {
          for (const s of solids) if (blocks(s, x, z, e.body.radius, feet, e.body.height)) ({ x, z } = resolveCircleAabb(x, z, e.body.radius, s.solid));
          for (const other of bodies) {
            if (other === e || Math.abs(other.position.y - feet) >= e.body.height) continue;
            const dx = x - other.position.x;
            const dz = z - other.position.z;
            const min = e.body.radius + other.body.radius;
            const d = Math.hypot(dx, dz);
            if (d < min && d > 1e-6) {
              x = other.position.x + (dx / d) * min;
              z = other.position.z + (dz / d) * min;
            }
          }
        }
      }
      const ground = groundAt(solids, x, z, feet);
      let y: number;
      if (ground >= feet || (e.fall === undefined && feet - ground <= SNAP_DOWN)) {
        y = ground;
        delete e.fall;
      } else {
        const vy = (e.fall ?? 0) - GRAVITY * dt;
        y = Math.max(ground, feet + vy * dt);
        if (y === ground) delete e.fall;
        else e.fall = vy;
      }
      if (x !== e.position.x || y !== e.position.y || z !== e.position.z) e.position = { x, y, z };
    }
  },
};
