import { GAME_SECONDS_PER_REAL_SECOND, type GameClock, type Vec3, angleDelta, minuteOfDay, secondsSince } from "@seki/core";
import type { Entity, Interactable, ScheduleDef, SchedulePose, ScheduleStop } from "./components";

/** Index of the stop in force at the clock's minute; before the first stop of the day, yesterday's last. */
export const currentStopIndex = (def: ScheduleDef, clock: GameClock): number => {
  const m = minuteOfDay(clock);
  let index = def.stops.length - 1;
  def.stops.forEach((s, i) => {
    if (s.at <= m) index = i;
  });
  return index;
};

/** Where the NPC rests once a stop is over: the end of its path, or the start of a patrol loop. */
const restPoint = (stop: ScheduleStop): Vec3 => (stop.loop ? stop.path[0] : (stop.path[stop.path.length - 1] ?? stop.path[0]));

const segmentLength = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.z - a.z);

const polylineLength = (points: readonly Vec3[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += segmentLength(points[i - 1] as Vec3, points[i] as Vec3);
  return total;
};

/** The point `distance` metres along the polyline, with the direction of its segment; null past the end. */
const pointAlong = (points: readonly Vec3[], distance: number): { position: Vec3; heading: number } | null => {
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec3;
    const b = points[i] as Vec3;
    const len = segmentLength(a, b);
    if (len < 1e-9) continue;
    if (left < len) {
      const t = left / len;
      return { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, heading: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    left -= len;
  }
  return null;
};

export const scheduledPose = (def: ScheduleDef, clock: GameClock): SchedulePose => {
  const stop = currentStopIndex(def, clock);
  const current = def.stops[stop] ?? def.stops[0];
  const previous = def.stops[(stop - 1 + def.stops.length) % def.stops.length] ?? current;
  const walked = (def.speed * secondsSince(clock, current.at)) / GAME_SECONDS_PER_REAL_SECOND;
  const origin = restPoint(previous);
  if (current.loop) {
    const leadIn = [origin, current.path[0]];
    const onLeadIn = pointAlong(leadIn, walked);
    if (onLeadIn) return { stop, ...onLeadIn, arrived: false };
    const ring = [...current.path, current.path[0]];
    const length = polylineLength(ring);
    const onRing = length > 1e-9 ? pointAlong(ring, (walked - polylineLength(leadIn)) % length) : null;
    return onRing ? { stop, ...onRing, arrived: false } : { stop, position: current.path[0], heading: current.yaw, arrived: true };
  }
  const walking = pointAlong([origin, ...current.path], walked);
  if (walking) return { stop, ...walking, arrived: false };
  return { stop, position: restPoint(current), heading: current.yaw, arrived: true };
};

/** The interaction an NPC offers at its current stop. */
export const scheduledInteraction = (def: ScheduleDef, stop: number, own: Interactable | null): Interactable | null => {
  const s = def.stops[stop];
  return s?.interaction === undefined ? own : s.interaction;
};

/** Puts an NPC exactly where its plan says (a chunk streaming back in, a skipped stretch of time). */
export const placeOnSchedule = (e: Entity, def: ScheduleDef, clock: GameClock): void => {
  const pose = scheduledPose(def, clock);
  e.position = pose.position;
  e.prevPosition = pose.position;
  e.yaw = pose.heading;
  e.prevYaw = pose.heading;
  if (e.velocity) e.velocity = { x: 0, y: 0, z: 0 };
};

/** Close enough to the plan to stand still. */
export const ON_SCHEDULE = 0.05;
/** Speed per metre of lag: an NPC walking a path trails its pose by speed / FOLLOW_GAIN. */
const FOLLOW_GAIN = 3;
const TURN_RATE = 5;

/**
 * Steers an NPC after its pose, as fast as `maxSpeed` allows. Smooth both ways: it slows down
 * as it closes in, and once at its stop it turns to the stop's facing.
 */
export const followSchedule = (self: Entity & { velocity: Vec3 }, pose: SchedulePose, maxSpeed: number, dt: number): void => {
  const dx = pose.position.x - self.position.x;
  const dz = pose.position.z - self.position.z;
  const d = Math.hypot(dx, dz);
  if (d <= ON_SCHEDULE) {
    self.velocity = { x: 0, y: 0, z: 0 };
    if (pose.arrived) {
      const turn = angleDelta(self.yaw, pose.heading);
      const max = TURN_RATE * dt;
      self.yaw += Math.max(-max, Math.min(max, turn));
    }
    return;
  }
  const speed = Math.min(maxSpeed, d * FOLLOW_GAIN);
  self.velocity = { x: (dx / d) * speed, y: 0, z: (dz / d) * speed };
  self.yaw = Math.atan2(dx, dz);
};
