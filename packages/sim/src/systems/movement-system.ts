import { applyDamage } from "@seki/core";
import { overFootprint, resolveCircleAabb, topAt } from "../world/collision";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
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

/** Falls from up to this height (feet, from the highest point) do no harm (ADR-0021). */
export const FALL_SAFE_HEIGHT = 4;
/** Damage per metre of fall above FALL_SAFE_HEIGHT. */
export const FALL_DAMAGE_PER_METRE = 10;
/** Landings from this high are hard: a short slow walk, and a heavier sound. */
export const HARD_LANDING_HEIGHT = 2.5;
/** Seconds of slow walk after a hard landing, and after one that hurt. */
export const HARD_LANDING_SLOW = 0.35;
export const HURT_LANDING_SLOW = 0.6;

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

/** Lowest underside above a head at `head` over the point, or Infinity: a jump stops there. */
const ceilingAt = (solids: readonly Solid[], x: number, z: number, head: number): number => {
  let ceiling = Infinity;
  for (const s of solids) {
    if (s.solid.min.y >= head - 1e-6 && s.solid.min.y < ceiling && overFootprint(s.solid, x, z)) ceiling = s.solid.min.y;
  }
  return ceiling;
};

/** Fall damage for a drop of `drop` metres (ADR-0021): none up to FALL_SAFE_HEIGHT, then linear. */
export const fallDamage = (drop: number): number => (drop > FALL_SAFE_HEIGHT ? Math.round((drop - FALL_SAFE_HEIGHT) * FALL_DAMAGE_PER_METRE) : 0);

/**
 * Back on the ground at `ground` after time in the air (ADR-0021). A long drop hurts through
 * the usual damage path (`DamageDealt`, zone "leg", the faller as its own source) and slows
 * the next steps.
 */
const land = (ctx: SimContext, e: Entity, ground: number): void => {
  const drop = Math.max(0, (e.airPeak ?? ground) - ground);
  delete e.airPeak;
  const hard = drop >= HARD_LANDING_HEIGHT;
  const damage = e.health ? fallDamage(drop) : 0;
  const at = { x: e.position.x, y: ground, z: e.position.z };
  if (hard) e.landing = damage > 0 ? HURT_LANDING_SLOW : HARD_LANDING_SLOW;
  if (damage > 0 && e.health) {
    e.health = applyDamage(e.health, damage);
    // Nobody pushed: a fatal fall is not held against the player (death system).
    e.lastHitBy = e.id;
    ctx.bus.emit("DamageDealt", { sourceId: e.id, targetId: e.id, amount: damage, critical: false, zone: "leg", at });
  }
  ctx.bus.emit("Landed", { entityId: e.id, drop, hard, damage, at });
};

/**
 * Integrates velocity, resolves character footprints against geometry and other bodies, then
 * puts the feet on the floor: stepping up ledges, following stairs down, falling off edges and
 * flying a jump (ADR-0021). Characters on a ladder are moved by the ladder system instead.
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
      if (e.climb) continue;
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
      const rising = (e.fall ?? 0) > 0;
      let y: number;
      if (!rising && (ground >= feet || (e.fall === undefined && feet - ground <= SNAP_DOWN))) {
        y = ground;
        if (e.fall !== undefined) land(ctx, e, ground);
        delete e.fall;
      } else {
        let vy = (e.fall ?? 0) - GRAVITY * dt;
        let next = feet + vy * dt;
        if (vy > 0) {
          // Head against an underside: the jump stops rising there.
          const ceiling = ceilingAt(solids, x, z, feet + e.body.height);
          if (next + e.body.height > ceiling) {
            next = Math.max(feet, ceiling - e.body.height);
            vy = 0;
          }
        }
        y = Math.max(ground, next);
        // Leaving the ground without a jump: the fall is measured from here.
        e.airPeak = e.fall === undefined ? Math.max(feet, y) : Math.max(e.airPeak ?? feet, y);
        if (y === ground) {
          land(ctx, e, ground);
          delete e.fall;
        } else e.fall = vy;
      }
      if (x !== e.position.x || y !== e.position.y || z !== e.position.z) e.position = { x, y, z };
    }
  },
};
