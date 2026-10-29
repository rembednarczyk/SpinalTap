import type { ActivityId, GameClock, Vec3 } from "@seki/core";
import { ACTOR_ACTIVITIES } from "../content/actor-activities";
import { planActivity } from "./activity-types";
import type { Entity } from "./components";

/** Faster than this (m/s) a character is walking, not doing anything where it stands. */
export const ACTIVITY_STILL_SPEED = 0.3;
/** A character this close to its place (the stop, the spot, home) is at it. */
export const ACTIVITY_REACH = 0.35;

const near = (a: Vec3, b: Vec3, reach = ACTIVITY_REACH): boolean => Math.hypot(a.x - b.x, a.z - b.z) <= reach;

/** Busy with something that is not a routine: fear, a fight, a hack, looking for the player. */
const interrupted = (e: Entity): boolean => {
  if (e.health && e.health.current <= 0) return true;
  if (e.civilian?.crowd && e.civilian.crowd.state !== "calm") return true;
  const ai = e.ai;
  if (ai && (ai.alerted || ai.victim !== undefined || !!ai.lastKnown || (ai.search ?? 0) > 0)) return true;
  if (e.combatant?.engaged || e.sniper || e.escort) return true;
  return !!e.hackFx && (e.hackFx.blind > 0 || e.hackFx.crippled > 0);
};

/** From the daily plan: the activity of the stop it stands at, once it got there. */
const scheduledActivity = (e: Entity, clock: GameClock): ActivityId | null => {
  const s = e.schedule;
  const pose = s?.pose;
  if (!s || !pose) return null;
  if (!pose.arrived || !near(e.position, pose.position)) return null;
  const stop = s.def.stops[pose.stop];
  const plan = stop?.activity ?? (e.key ? ACTOR_ACTIVITIES[e.key] : undefined);
  return plan === undefined ? null : planActivity(plan, clock, stop?.at ?? 0);
};

/**
 * What a character does this step (ADR-0040), or null while it walks, runs, fights or has
 * nothing to do. A pure function of the entity and the clock: the passer-by's routine, the
 * stop of a daily plan, the character's own habit, a guard's post. Talking to the player
 * (the open dialogue's partner) overrides them all.
 */
export const activityOf = (e: Entity, clock: GameClock, talking = false): ActivityId | null => {
  if (interrupted(e)) return null;
  if (talking) return "talk";
  const v = e.velocity;
  if (v && Math.hypot(v.x, v.z) > ACTIVITY_STILL_SPEED) return null;
  if (e.passerby) return near(e.position, e.passerby.goal) ? e.passerby.activity : null;
  if (e.schedule) return scheduledActivity(e, clock);
  // A bystander pushed off its spot does nothing until it is back.
  if (e.civilian && !near(e.position, e.civilian.home)) return null;
  const own = e.key ? ACTOR_ACTIVITIES[e.key] : undefined;
  if (own !== undefined) return planActivity(own, clock);
  // A guard on a post (ADR-0024) stands watch.
  if (e.ai?.cone && e.ai.watch) return "guard";
  return null;
};
