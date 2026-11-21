import { type EntityId, terrainHeightAt, vehicleSpec } from "@seki/core";
import { surfaceLiftAt } from "../../content/lublin/roads";
import { offend } from "../street";
import type { Entity } from "../components";
import type { SimContext } from "../context";
import { solidIndexOf } from "../solid-index";
import { pushCircleOut } from "../solids";
import { type V3, attitude, dot, length, scale, sub, toWorld, v3 } from "./frame";
import { type CarState, restHeight } from "./state";
import { strike } from "./struck";
import type { CarGround } from "./suspension";

/**
 * The car in Lublin (ADR-0097 §2.7, §3): the ground it drives on (the world's, lifted where the
 * renderer draws the paving, as the street's traffic drives, `traffic-system.ts` `roadY`), and
 * its body against the city's solids and the street's vehicles.
 */
export const worldGround = (ctx: SimContext): CarGround => ({
  heightAt: (x, z) => {
    const g = ctx.streamer.ground;
    const y = g.heightAt(x, z);
    const grid = g.gridAt(x, z);
    return y + surfaceLiftAt(x, z, grid !== null && y !== terrainHeightAt(grid, x, z));
  },
});

/** Circles along the body (its half width each) standing in for its box against the solids. */
const bodyCircles = (car: CarState): { at: V3; r: number }[] => {
  const s = vehicleSpec(car.model);
  const r = s.half.x;
  const n = Math.max(2, Math.ceil((s.half.z * 2) / (r * 1.6)));
  return Array.from({ length: n }, (_, k) => {
    const z = -s.half.z + r + ((s.half.z * 2 - 2 * r) * k) / (n - 1);
    return { at: toWorld(car.q, v3(0, 0, z)), r };
  });
};

/** A solid lower than this over the car's floor is driven over (kerbs, low steps), not hit (m). */
const DRIVE_OVER = 0.25;
/** Share of the speed into a wall it keeps bouncing back. */
const BOUNCE = 0.15;

/**
 * The body against the solids (ADR-0097 §2.7): each circle pushed out of the colliders near it
 * whose height spans the body's; the car moved by the largest push, and its velocity into the
 * wall taken out (a little bounce kept). Returns the speed lost into the walls (m/s).
 */
export const collideSolids = (ctx: SimContext, car: CarState): number => {
  const spec = vehicleSpec(car.model);
  const floor = car.pos.y - restHeight(spec);
  const roof = floor + spec.half.y * 2 + 0.3;
  const index = solidIndexOf(ctx.world);
  let push = v3(0, 0, 0);
  for (const c of bodyCircles(car)) {
    const x = car.pos.x + c.at.x;
    const z = car.pos.z + c.at.z;
    for (const col of index.collidersNear(x - c.r, z - c.r, x + c.r, z + c.r)) {
      if (col.box.max.y < floor + DRIVE_OVER || col.box.min.y > roof) continue;
      const out = pushCircleOut(col, x + push.x, z + push.z, c.r);
      const d = v3(out.x - x - push.x, 0, out.z - z - push.z);
      if (length(d) > 1e-6) push = v3(push.x + d.x, 0, push.z + d.z);
    }
  }
  const p = length(push);
  if (p < 1e-6) return 0;
  car.pos = v3(car.pos.x + push.x, car.pos.y, car.pos.z + push.z);
  const n = scale(push, 1 / p);
  const into = dot(car.vel, n);
  if (into >= 0) return 0;
  car.vel = sub(car.vel, scale(n, into * (1 + BOUNCE)));
  return -into;
};

/**
 * The body against the street's vehicles (kinematic: they stop before anyone in their way, ADR-0050):
 * each of the body's circles kept out of their footprint grown by its radius, the car moved by the
 * deepest push; the speed into them lost.
 */
export const collideTraffic = (ctx: SimContext, car: CarState, self: EntityId): { speed: number; other: EntityId | null } => {
  let hit = { speed: 0, other: null as EntityId | null };
  const circles = bodyCircles(car);
  for (const v of ctx.world.with("vehicle")) {
    if (v.id === self || Math.abs(car.pos.y - v.position.y) > 3) continue;
    const st = v.vehicle;
    const tx = Math.sin(v.yaw);
    const tz = Math.cos(v.yaw);
    let best: { n: V3; depth: number } | null = null;
    for (const c of circles) {
      const dx = car.pos.x + c.at.x - v.position.x;
      const dz = car.pos.z + c.at.z - v.position.z;
      const fwd = dx * tx + dz * tz;
      const lat = dx * tz - dz * tx;
      const inFwd = st.half.l + c.r - Math.abs(fwd);
      const inLat = st.half.w + c.r - Math.abs(lat);
      if (inFwd <= 0 || inLat <= 0) continue;
      const depth = Math.min(inLat, inFwd);
      const n = inLat < inFwd ? v3(tz * Math.sign(lat || 1), 0, -tx * Math.sign(lat || 1)) : v3(tx * Math.sign(fwd || 1), 0, tz * Math.sign(fwd || 1));
      if (!best || depth > best.depth) best = { n, depth };
    }
    if (!best) continue;
    car.pos = v3(car.pos.x + best.n.x * best.depth, car.pos.y, car.pos.z + best.n.z * best.depth);
    const into = dot(car.vel, best.n);
    if (into < 0) {
      car.vel = sub(car.vel, scale(best.n, into * (1 + BOUNCE)));
      if (-into > hit.speed) hit = { speed: -into, other: v.id };
    }
  }
  return hit;
};

/** The entity's transform from the car: on the ground under it (the renderer's models stand there), its heading and tilt. */
export const placeEntity = (e: Entity, car: CarState): void => {
  const a = attitude(car.q);
  const spec = vehicleSpec(car.model);
  e.position = { x: car.pos.x, y: car.pos.y - restHeight(spec), z: car.pos.z };
  e.yaw = a.yaw;
  e.pitch = a.pitch;
  e.velocity = { x: car.vel.x, y: car.vel.y, z: car.vel.z };
};

/** The car's tilt for the renderer (pitch nose down, roll over to the right, ADR-0097 §2a). */
export const carTilt = (car: CarState): { pitch: number; roll: number } => {
  const a = attitude(car.q);
  return { pitch: a.pitch, roll: a.roll };
};

/** Speed over which a car shoving someone aside runs them over (m/s): a crime, and the event for the sound and the HUD. */
const RUN_OVER = 4;

/**
 * People on foot against the car (ADR-0097 §2.7): nobody stands in its body, the background
 * passers-by neither; each is pushed out of its footprint the shorter way. Someone hit faster than
 * `RUN_OVER` is run over (an assault in the crime's rules, ADR-0029/0091) and, unless armed and
 * hostile (they take the push and fight on), thrown onto the road with the user's clip and gets up
 * (`struck.ts`). Someone already down is not hit again.
 */
export const collideBodies = (ctx: SimContext, car: CarState, self: EntityId): void => {
  const half = vehicleSpec(car.model).half;
  const f = toWorld(car.q, v3(0, 0, 1));
  const speed = Math.hypot(car.vel.x, car.vel.z);
  for (const b of ctx.world.with("body")) {
    if (b.player || b.struck) continue;
    const r = b.body.radius;
    const dx = b.position.x - car.pos.x;
    const dz = b.position.z - car.pos.z;
    const fwd = dx * f.x + dz * f.z;
    const lat = dx * f.z - dz * f.x;
    const inFwd = half.z + r - Math.abs(fwd);
    const inLat = half.x + r - Math.abs(lat);
    if (inFwd <= 0 || inLat <= 0 || Math.abs(b.position.y - (car.pos.y - 0.5)) > 2) continue;
    b.position =
      inLat < inFwd
        ? { x: b.position.x + f.z * Math.sign(lat || 1) * inLat, y: b.position.y, z: b.position.z - f.x * Math.sign(lat || 1) * inLat }
        : { x: b.position.x + f.x * Math.sign(fwd || 1) * inFwd, y: b.position.y, z: b.position.z + f.z * Math.sign(fwd || 1) * inFwd };
    // A background passer-by (ADR-0040) steps out of the way: no crime, it never changes the saved state.
    if (speed > RUN_OVER && !b.passerby) {
      ctx.bus.emit("VehicleRanOver", { vehicleId: self, victim: b.id, speed });
      offend(ctx, "assault", b.position, undefined, b.id);
      if (!b.enemy) strike(ctx.world, b, { x: car.vel.x / speed, z: car.vel.z / speed });
    }
  }
};
