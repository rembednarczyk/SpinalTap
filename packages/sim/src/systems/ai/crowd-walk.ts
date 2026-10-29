import type { EntityId, Vec3 } from "@seki/core";
import type { LaneWalk } from "../../world/activity-types";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { laneGeom, lanePoint, nearestArc, wrapArc } from "../../world/crowd-lanes";
import { LANE_HALF_GAP, crowdLane, laneTarget, realSeconds } from "../../world/crowd";
import { steerPoint } from "./steering";

type Walker = Entity & { velocity: Vec3; passerby: NonNullable<Entity["passerby"]> & { lane: LaneWalk } };

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
}

const memo = new WeakMap<object, { tick: number; list: Obstacle[] }>();

/** Everyone with a body this step, once per step for all walkers. */
const obstacles = (ctx: SimContext): Obstacle[] => {
  const known = memo.get(ctx.world);
  if (known && known.tick === ctx.tick) return known.list;
  const list: Obstacle[] = [];
  for (const e of ctx.world.with("body")) list.push({ id: e.id, x: e.position.x, z: e.position.z });
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
  for (const o of others) {
    if (o.id === self) continue;
    const dx = o.x - at.x;
    const dz = o.z - at.z;
    const ahead = dx * line.tx + dz * line.tz;
    if (ahead < -BEHIND || ahead > AHEAD) continue;
    // Sideways from the line, to the walker's left (heading north, left is west).
    const lat = (o.x - line.x) * -line.tz + (o.z - line.z) * line.tx;
    if (Math.abs(lat) >= CLEAR) continue;
    const need = lat >= 0 ? lat - CLEAR : lat + CLEAR;
    if (Math.abs(need) > Math.abs(want)) want = need;
  }
  return Math.max(-MAX_ASIDE, Math.min(MAX_ASIDE, want));
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
    const p = lanePoint(g, w.rejoin);
    const off = LANE_HALF_GAP * w.dir;
    const back = { x: p.x - p.tz * off, y: self.position.y, z: p.z + p.tx * off };
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
