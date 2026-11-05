import type { EntityId, Vec3 } from "@seki/core";
import type { LaneWalk } from "../../world/activity-types";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { laneGeom, lanePoint, nearestArc, wrapArc } from "../../world/crowd-lanes";
import { LANE_HALF_GAP, crowdLane, laneTarget, realSeconds } from "../../world/crowd";
import { steerPoint } from "./steering";

export type Walker = Entity & { velocity: Vec3; passerby: NonNullable<Entity["passerby"]> & { lane: LaneWalk } };

/** Further than this from its place on the route, a walker heads back to the nearest point of it (m). */
const REJOIN_DISTANCE = 3;
/** Back on the route closer than this. */
const REJOINED = 0.8;
/** Seconds between looks for a way round obstacles on the way back. */
const REPATH_SECONDS = 0.6;
/** How hard a walker closes in on its place: speed per metre behind. */
const GAIN = 1.8;
/** A walker hurries at most this much over its pace to keep its place. */
const HURRY = 1.6;
/** Someone this far ahead (m) and closer to the line than CLEAR is walked round. */
const AHEAD = 2.4;
const BEHIND = 0.6;
const CLEAR = 0.62;
/** Furthest a walker steps aside, and how fast (m, m/s). */
const MAX_ASIDE = 1.2;
const ASIDE_RATE = 1;

interface Obstacle {
  readonly id: EntityId;
  readonly x: number;
  readonly z: number;
  /** Half the width of something wider than a body (a vehicle, ADR-0050), walked round further. */
  readonly r?: number;
}

const memo = new WeakMap<object, { tick: number; list: Obstacle[] }>();

/** Everyone with a body this step, once per step for all walkers. */
const obstacles = (ctx: SimContext): Obstacle[] => {
  const known = memo.get(ctx.world);
  if (known && known.tick === ctx.tick) return known.list;
  const list: Obstacle[] = [];
  for (const e of ctx.world.with("body")) list.push({ id: e.id, x: e.position.x, z: e.position.z });
  // A vehicle (a delivery van on the deptak, ADR-0050) as points along its length.
  for (const e of ctx.world.with("vehicle")) {
    const { w, l } = e.vehicle.half;
    const tx = Math.sin(e.yaw);
    const tz = Math.cos(e.yaw);
    for (let k = -l + w; k <= l - w + 1e-6; k += Math.max(0.5, w)) list.push({ id: e.id, x: e.position.x + tx * k, z: e.position.z + tz * k, r: w });
  }
  memo.set(ctx.world, { tick: ctx.tick, list });
  return list;
};

/**
 * How far to its left (negative: right) a walker should step to pass the people ahead of it
 * near its line: the smallest step that clears the one that needs the largest. Measured from
 * its own place on the line, so the answer holds still while it passes.
 */
export const asideFor = (others: readonly Obstacle[], self: EntityId, at: { x: number; z: number }, line: { x: number; z: number; tx: number; tz: number }): number => {
  let want = 0;
  let wide = 0;
  for (const o of others) {
    if (o.id === self) continue;
    const dx = o.x - at.x;
    const dz = o.z - at.z;
    const ahead = dx * line.tx + dz * line.tz;
    if (ahead < -BEHIND - (o.r ?? 0) || ahead > AHEAD + (o.r ?? 0)) continue;
    // Sideways from the line, to the walker's left (heading north, left is west).
    const lat = (o.x - line.x) * -line.tz + (o.z - line.z) * line.tx;
    const clear = CLEAR + (o.r ?? 0);
    if (Math.abs(lat) >= clear) continue;
    const need = lat >= 0 ? lat - clear : lat + clear;
    if (Math.abs(need) > Math.abs(want)) want = need;
    wide = Math.max(wide, o.r ?? 0);
  }
  return Math.max(-MAX_ASIDE - wide, Math.min(MAX_ASIDE + wide, want));
};

/** Back to the route after running off or being pushed: to the nearest point of it, round obstacles. */
const walkBack = (ctx: SimContext, self: Walker, dt: number, back: Vec3): void => {
  const p = self.passerby;
  p.repath -= dt;
  const w = p.waypoint;
  if (!w || p.repath <= 0 || Math.hypot(w.x - self.position.x, w.z - self.position.z) < 0.4) {
    p.waypoint = steerPoint(ctx.world, self.position, back);
    p.repath = REPATH_SECONDS;
  }
  const to = p.waypoint ?? back;
  const dx = to.x - self.position.x;
  const dz = to.z - self.position.z;
  const d = Math.hypot(dx, dz);
  const speed = p.lane.speed * 1.15;
  self.velocity = d < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: (dx / d) * speed, y: 0, z: (dz / d) * speed };
  if (d >= 1e-6) self.yaw = Math.atan2(dx, dz);
};

/** The point of the route a walker heads back to (`w.rejoin`), on its own side of the line. */
const rejoinPoint = (g: ReturnType<typeof laneGeom>, w: LaneWalk, rejoin: number, y: number): Vec3 => {
  const p = lanePoint(g, rejoin);
  const off = LANE_HALF_GAP * w.dir;
  return { x: p.x - p.tz * off, y, z: p.z + p.tx * off };
};

/**
 * Where a walker of a route is headed this step: back to the route after running off, or its
 * place on it. The spot it waits for in the dead zone of a feared player (ADR-0070).
 */
export const laneSpot = (ctx: SimContext, self: Walker): Vec3 | null => {
  const w = self.passerby.lane;
  const lane = crowdLane(w.lane);
  if (!lane) return null;
  if (w.rejoin !== null) return rejoinPoint(laneGeom(lane), w, w.rejoin, self.position.y);
  const t = laneTarget(lane, w, ctx.state.domain.clock, w.avoid);
  return { x: t.x, y: self.position.y, z: t.z };
};

/**
 * Holds a walker's way round its route where it stands (ADR-0070): its place stops moving on
 * with the clock and it picks the walk up from the nearest point of the route once it goes on.
 * Kept in `rejoin`, which the walk already has, so nothing new is hidden.
 */
export const holdLanePlace = (self: Walker): void => {
  const w = self.passerby.lane;
  const lane = crowdLane(w.lane);
  if (!lane || w.rejoin !== null) return;
  w.rejoin = nearestArc(laneGeom(lane), self.position.x, self.position.z);
  self.passerby.waypoint = null;
};

/**
 * One step of a resident's walk round its route (ADR-0041): to where the clock says it is, on
 * its own side of the line, stepping aside for anyone in the way. Off the route (it ran from a
 * shot, someone pushed it) it walks back to the nearest point and carries on from there.
 */
export const walkLane = (ctx: SimContext, self: Walker, dt: number): void => {
  const w = self.passerby.lane;
  const lane = crowdLane(w.lane);
  if (!lane) {
    self.velocity = { x: 0, y: 0, z: 0 };
    return;
  }
  const g = laneGeom(lane);
  const clock = ctx.state.domain.clock;
  const base = w.phase + w.dir * w.speed * realSeconds(clock);
  if (w.rejoin === null) {
    const t = laneTarget(lane, w, clock, w.avoid);
    if (Math.hypot(t.x - self.position.x, t.z - self.position.z) > REJOIN_DISTANCE) w.rejoin = nearestArc(g, self.position.x, self.position.z);
  }
  if (w.rejoin !== null) {
    const back = rejoinPoint(g, w, w.rejoin, self.position.y);
    if (Math.hypot(back.x - self.position.x, back.z - self.position.z) > REJOINED) {
      walkBack(ctx, self, dt, back);
      return;
    }
    // On the route again: its place is here now; the walk goes on from it.
    let shift = wrapArc(g, w.rejoin - base);
    if (shift > g.length / 2) shift -= g.length;
    w.shift = shift;
    w.rejoin = null;
    self.passerby.waypoint = null;
  }
  const line = laneTarget(lane, w, clock);
  const want = asideFor(obstacles(ctx), self.id, self.position, line);
  const step = ASIDE_RATE * dt;
  w.avoid += Math.max(-step, Math.min(step, want - w.avoid));
  const t = laneTarget(lane, w, clock, w.avoid);
  let vx = t.tx * w.speed + (t.x - self.position.x) * GAIN;
  let vz = t.tz * w.speed + (t.z - self.position.z) * GAIN;
  const v = Math.hypot(vx, vz);
  const max = w.speed * HURRY;
  if (v > max) {
    vx = (vx / v) * max;
    vz = (vz / v) * max;
  }
  self.velocity = { x: vx, y: 0, z: vz };
  if (v > 1e-6) self.yaw = Math.atan2(vx, vz);
};
