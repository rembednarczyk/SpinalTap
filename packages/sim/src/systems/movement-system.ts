import { applyDamage } from "@seki/core";
import type { Entity } from "../world/components";
import { type GroundField, MAX_WALK_SLOPE, groundOf } from "../world/ground";
import { type Collider, circleTouches, collidersOf, colliderTop, overCollider, pushCircleOut } from "../world/solids";
import type { SimContext, System } from "../world/context";
import { inCreationOrder } from "../world/ordering";
import { solidIndexOf } from "../world/solid-index";
import { worldTimeScale } from "./ability-system";

const ITERATIONS = 2;
/** How far around a mover's step its colliders are gathered, beyond its radius, metres. */
const REACH_MARGIN = 3;

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

const near = { x: 0, z: 0 };

/** Does the collider stop a character whose feet are at `feet` (ADR-0020)? Ledges low enough are stepped onto. */
const blocks = (c: Collider, x: number, z: number, radius: number, feet: number, height: number): boolean => {
  if (c.box.min.y >= feet + height) return false;
  if (!circleTouches(c, x, z, radius, near)) return false;
  return colliderTop(c, near.x, near.z) > feet + STEP_HEIGHT;
};

/**
 * Height of the floor under a point for feet at `feet`: the ground (the street plane, or the
 * terrain of the chunk, ADR-0043, or a bridge's deck within a step up, G-062) or the highest top
 * within a step up.
 */
export const groundAt = (solids: readonly Collider[], field: GroundField, x: number, z: number, feet: number): number => {
  let ground = field.heightAt(x, z, feet + STEP_HEIGHT);
  for (const c of solids) {
    if (!overCollider(c, x, z, EDGE_MARGIN)) continue;
    const top = colliderTop(c, x, z);
    if (top > ground && top <= feet + STEP_HEIGHT) ground = top;
  }
  return ground;
};

/** Lowest underside above a head at `head` over the point, or Infinity: a jump stops there. */
const ceilingAt = (solids: readonly Collider[], x: number, z: number, head: number): number => {
  let ceiling = Infinity;
  for (const c of solids) {
    if (c.box.min.y >= head - 1e-6 && c.box.min.y < ceiling && overCollider(c, x, z)) ceiling = c.box.min.y;
  }
  return ceiling;
};

/** Ledges the hands catch in the air: their top from a step above the feet up to this (ADR-0021 addendum). */
export const MANTLE_REACH = 1.3;
/** Seconds of a pull-up: the first part lifts, the rest steps onto the ledge. */
export const MANTLE_TIME = 0.5;
const MANTLE_LIFT = 0.65;
/** How far onto the ledge the pull-up ends, beyond the body's radius. */
const MANTLE_INSET = 0.12;

/**
 * A ledge in front of an airborne player moving into it (ADR-0021 addendum): a solid that
 * blocks at `to`, whose top is a step to MANTLE_REACH above the feet, with room to stand on it.
 * Returns where the pull-up ends, or null.
 */
const ledgeAhead = (solids: readonly Collider[], field: GroundField, e: Entity & { body: NonNullable<Entity["body"]> }, x: number, z: number, vx: number, vz: number): Entity["position"] | null => {
  const speed = Math.hypot(vx, vz);
  if (speed < 0.5) return null;
  const feet = e.position.y;
  const [dx, dz] = [vx / speed, vz / speed];
  for (const s of solids) {
    if (!blocks(s, x, z, e.body.radius, feet, e.body.height)) continue;
    // A point just over the edge, past the body's radius, in the direction of travel.
    const reach = e.body.radius + MANTLE_INSET;
    const tx = e.position.x + dx * (reach + e.body.radius);
    const tz = e.position.z + dz * (reach + e.body.radius);
    if (!overCollider(s, tx, tz)) continue;
    const top = colliderTop(s, tx, tz);
    if (top - feet <= STEP_HEIGHT || top - feet > MANTLE_REACH) continue;
    if (groundAt(solids, field, tx, tz, top) !== top || ceilingAt(solids, tx, tz, top) < top + e.body.height) continue;
    return { x: tx, y: top, z: tz };
  }
  return null;
};

/** Moves a pull-up on; at its end the character stands on the ledge. */
const stepMantle = (m: NonNullable<Entity["mantle"]>, e: Entity, dt: number): void => {
  m.t = Math.min(m.duration, m.t + dt);
  const f = m.t / m.duration;
  const lift = Math.min(1, f / MANTLE_LIFT);
  const over = Math.max(0, (f - MANTLE_LIFT) / (1 - MANTLE_LIFT));
  const ease = (v: number) => v * v * (3 - 2 * v);
  e.position = {
    x: m.from.x + (m.to.x - m.from.x) * ease(over),
    y: m.from.y + (m.to.y - m.from.y) * ease(lift),
    z: m.from.z + (m.to.z - m.from.z) * ease(over),
  };
  if (m.t >= m.duration) delete e.mantle;
};

/** Bounds of neighbouring districts may leave a seam this wide between them (ADR-0024). */
const SEAM = 0.5;

/**
 * A move from inside a district to a point outside every district (ADR-0021 addendum). The
 * seam towards a neighbouring district is not outside: it is crossed on the way there.
 */
const leavesWorld = (ctx: SimContext, from: Entity["position"], to: Entity["position"]): boolean => {
  const here = ctx.streamer.chunkIdAt(from);
  return here !== "" && ctx.streamer.chunkIdAt(to) === "" && !ctx.streamer.nearOtherChunk(to, SEAM, here);
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

const slope = { x: 0, z: 0 };

/** Rises by less than this per step do not count as climbing (rounding on the contour). */
const RISE_EPS = 1e-3;

/**
 * A step up terrain steeper than MAX_WALK_SLOPE is a wall (ADR-0043): the uphill part of the
 * move is dropped, so the character slides along the bank's contour; when even that climbs
 * steeply, it stays. Feet above the terrain there (a jump, a roof) are not stopped.
 */
const offTheBank = (field: GroundField, from: Entity["position"], x: number, z: number, feet: number): { x: number; z: number } => {
  // A bridge's deck high overhead is no bank for feet under it (G-062).
  const reach = feet + STEP_HEIGHT;
  if (field.heightAt(x, z, reach) <= feet + RISE_EPS || !field.steepAt(x, z, reach)) return { x, z };
  const g = field.gradientAt(x, z, slope, reach);
  const len = Math.hypot(g.x, g.z);
  const dx = x - from.x;
  const dz = z - from.z;
  const up = (dx * g.x + dz * g.z) / len;
  const sx = from.x + dx - (g.x / len) * Math.max(0, up);
  const sz = from.z + dz - (g.z / len) * Math.max(0, up);
  const rise = field.heightAt(sx, sz, reach) - feet;
  if (rise <= RISE_EPS || rise <= MAX_WALK_SLOPE * Math.hypot(sx - from.x, sz - from.z) || !field.steepAt(sx, sz, reach)) return { x: sx, z: sz };
  return { x: from.x, z: from.z };
};

type Body = Entity & { body: NonNullable<Entity["body"]> };
type Mover = Body & { velocity: NonNullable<Entity["velocity"]> };

/** Where the colliders handed to a mover are complete: a footprint centred outside it may touch others. */
interface Reach {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

const within = (r: Reach | null, x: number, z: number): boolean => !r || (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);

/** A push-out that left the reach of its colliders: done again with every solid. */
const FAR = { x: NaN, z: NaN } as const;

/**
 * Pushes a footprint at (x, z) out of the solids it bumps into and the bodies it overlaps.
 * Returns FAR when a push carried it out of `reach` (the colliders near the mover).
 */
const pushOut = (solids: readonly Collider[], bodies: readonly Body[], e: Mover, x: number, z: number, feet: number, reach: Reach | null): { x: number; z: number } => {
  for (let i = 0; i < ITERATIONS; i++) {
    for (const s of solids) {
      if (!blocks(s, x, z, e.body.radius, feet, e.body.height)) continue;
      ({ x, z } = pushCircleOut(s, x, z, e.body.radius));
      if (!within(reach, x, z)) return FAR;
    }
    for (const other of bodies) {
      if (other === e || Math.abs(other.position.y - feet) >= e.body.height) continue;
      const dx = x - other.position.x;
      const dz = z - other.position.z;
      const min = e.body.radius + other.body.radius;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-6) {
        x = other.position.x + (dx / d) * min;
        z = other.position.z + (dz / d) * min;
        if (!within(reach, x, z)) return FAR;
      }
    }
  }
  return { x, z };
};

/**
 * The horizontal part of a step: velocity, then push-out. Returns where the feet end up, or
 * null when the player caught a ledge in the air and starts a pull-up instead.
 */
const moveAcross = (
  ctx: SimContext,
  e: Mover,
  solids: readonly Collider[],
  field: GroundField,
  bodies: readonly Body[],
  dt: number,
  reach: Reach | null,
): { x: number; z: number } | null => {
  const feet = e.position.y;
  let x = e.position.x;
  let z = e.position.z;
  if (e.velocity.x !== 0 || e.velocity.z !== 0) {
    x += e.velocity.x * dt;
    z += e.velocity.z * dt;
    if (field.hasTerrain) ({ x, z } = offTheBank(field, e.position, x, z, feet));
    // In the air, pressing into a ledge within reach: pull up onto it instead of sliding down.
    // Not with a body on her shoulder (ADR-0065): both hands are full.
    if (e.player && e.fall !== undefined && ctx.session.carrying === null) {
      const to = ledgeAhead(solids, field, e, x, z, e.velocity.x, e.velocity.z);
      if (to && !leavesWorld(ctx, e.position, to)) {
        e.mantle = { from: e.position, to, duration: MANTLE_TIME, t: 0 };
        delete e.fall;
        delete e.airPeak;
        ctx.bus.emit("Mantled", { entityId: e.id, at: to });
        return null;
      }
    }
    ({ x, z } = pushOut(solids, bodies, e, x, z, feet, reach));
    if (Number.isNaN(x)) return FAR;
  }
  // The edge of the world is a wall: a jump over a parapet or an outer wall never lands
  // outside every district (the street plane y = 0 runs on beyond them).
  if (e.player && leavesWorld(ctx, e.position, { x, y: feet, z })) {
    x = e.position.x;
    z = e.position.z;
  }
  return { x, z };
};

/**
 * The vertical part of a step at (x, z): on the floor (stepping up, following stairs down),
 * or in the air (falling, or flying a jump up to a ceiling). Returns the new height of the feet.
 */
const moveVertically = (ctx: SimContext, e: Mover, solids: readonly Collider[], field: GroundField, x: number, z: number, dt: number): number => {
  const feet = e.position.y;
  const ground = groundAt(solids, field, x, z, feet);
  const rising = (e.fall ?? 0) > 0;
  if (!rising && (ground >= feet || (e.fall === undefined && feet - ground <= SNAP_DOWN))) {
    if (e.fall !== undefined) land(ctx, e, ground);
    delete e.fall;
    return ground;
  }
  let vy = (e.fall ?? 0) - GRAVITY * dt;
  let next = feet + vy * dt;
  if (vy > 0) {
    // Head against an underside: the jump stops rising there.
    const ceiling = Math.min(ceilingAt(solids, x, z, feet + e.body.height), field.ceilingAt(x, z, feet + e.body.height));
    if (next + e.body.height > ceiling) {
      next = Math.max(feet, ceiling - e.body.height);
      vy = 0;
    }
  }
  const y = Math.max(ground, next);
  // Leaving the ground without a jump: the fall is measured from here.
  e.airPeak = e.fall === undefined ? Math.max(feet, y) : Math.max(e.airPeak ?? feet, y);
  if (y === ground) {
    land(ctx, e, ground);
    delete e.fall;
  } else e.fall = vy;
  return y;
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
    // push-out against overlapping boxes depends on the order they are visited. Each mover gets
    // the colliders near it from the index (ADR-0043), in that order; a push that carries it
    // beyond them is done again against every solid, so the outcome is the full scan's.
    const index = solidIndexOf(world);
    let all: Collider[] | null = null;
    const everything = (): Collider[] => (all ??= collidersOf(inCreationOrder(world.with("solid"))));
    const field = groundOf(world);
    // Background passers-by (ADR-0040) give way to everyone and push nobody: they never change the saved state.
    const bodies = inCreationOrder(world.with("body")).filter((b) => !b.passerby);
    for (const e of inCreationOrder(world.with("velocity", "body"))) {
      if (e.climb) continue;
      const dt = e.player ? ctx.dt : enemyDt;
      if (e.mantle) {
        stepMantle(e.mantle, e, dt);
        continue;
      }
      const m = e.body.radius + REACH_MARGIN;
      const tx = e.position.x + e.velocity.x * dt;
      const tz = e.position.z + e.velocity.z * dt;
      const q = { minX: Math.min(e.position.x, tx) - m, minZ: Math.min(e.position.z, tz) - m, maxX: Math.max(e.position.x, tx) + m, maxZ: Math.max(e.position.z, tz) + m };
      let solids: readonly Collider[] = index.collidersNear(q.minX, q.minZ, q.maxX, q.maxZ);
      const inset = e.body.radius + 0.1;
      let across = moveAcross(ctx, e, solids, field, bodies, dt, { minX: q.minX + inset, minZ: q.minZ + inset, maxX: q.maxX - inset, maxZ: q.maxZ - inset });
      if (across === FAR) {
        solids = everything();
        across = moveAcross(ctx, e, solids, field, bodies, dt, null);
      }
      if (!across) continue;
      const { x, z } = across;
      const y = moveVertically(ctx, e, solids, field, x, z, dt);
      if (x !== e.position.x || y !== e.position.y || z !== e.position.z) e.position = { x, y, z };
    }
  },
};
