import { type GameCommand, angleTo } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System, TakedownRun } from "../world/context";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { playerHeld } from "../world/takedown";
import { awarenessOf } from "./ai/ganger-perception";

/** How close the player has to be, metres between the centres on the ground (ADR-0065). */
export const TAKEDOWN_REACH = 1.6;
/** How long a takedown holds the player and the target, seconds. */
export const TAKEDOWN_TIME = 1.2;
/** Half-angle of the cone behind the target's back the player can come from: 120° in all. */
export const TAKEDOWN_BACK_CONE = Math.PI / 3;
/** Most height between the feet: nobody is taken down through a floor. */
const TAKEDOWN_REACH_Y = 0.8;
/** A phase that ends within float noise of the step counts as over. */
const TIME_EPSILON = 1e-6;

type Target = Entity & { health: NonNullable<Entity["health"]>; combatant: NonNullable<Entity["combatant"]> };

const ZERO = { x: 0, y: 0, z: 0 } as const;

/** No trace of the player in its mind (ADR-0065): not alerted, not suspicious, not searching. */
const unaware = (e: Entity): boolean => {
  if (e.ai) return awarenessOf(e.ai).state === "unaware";
  if (e.sniper) return e.sniper.phase === "idle";
  return true;
};

/** Stunned by a parry (`parryStun`) right now. */
const stunned = (e: Entity): boolean => (e.melee?.stagger ?? 0) > 0 && !!e.melee?.stunned;

/** The player stands in the cone behind the target's back. */
const behind = (target: Entity, player: Entity): boolean =>
  Math.abs(angleTo({ x: target.position.x, z: target.position.z, yaw: target.yaw }, player.position.x, player.position.z)) >= Math.PI - TAKEDOWN_BACK_CONE;

/**
 * Distance from the player to `e` when the rules let her take it down from where she stands
 * (reach, height, from behind or a target stunned or unaware of her), else null. Pure: the
 * line of sight is the caller's.
 */
export const takedownDistance = (player: Entity, e: Target): number | null => {
  if (e.player || e.unconscious || e.passerby || e.vehicle || e.health.current <= 0) return null;
  const distance = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
  if (distance > TAKEDOWN_REACH || Math.abs(e.position.y - player.position.y) > TAKEDOWN_REACH_Y) return null;
  return behind(e, player) || stunned(e) || unaware(e) ? distance : null;
};

/** As `takedownDistance`, with nothing solid between the player's eyes and the target's chest. */
const reachOf = (ctx: SimContext, player: Entity, e: Target): number | null => {
  const distance = takedownDistance(player, e);
  return distance !== null && lineOfSight(ctx.world, eyeOf(player), chestOf(e)) ? distance : null;
};

/**
 * Whom the player could take down now: the nearest NPC with a weapon and health in reach, from
 * behind, or from any side when it is stunned or unaware of her. Ties go to the older entity.
 * Nobody while she cannot act, hangs on a ladder or a ledge, or is in the air.
 */
export const takedownCandidate = (ctx: SimContext, player: Entity): { target: Target; distance: number } | null => {
  if (playerHeld(ctx) || player.climb || player.mantle || player.fall !== undefined) return null;
  let best: { target: Target; distance: number } | null = null;
  for (const e of inCreationOrder(ctx.world.with("combatant", "health"))) {
    const distance = reachOf(ctx, player, e);
    if (distance !== null && (!best || distance < best.distance)) best = { target: e, distance };
  }
  return best;
};

/** Holds the target still: no steps, no swing, weapon down. */
const hold = (target: Target): void => {
  if (target.velocity) target.velocity = { ...ZERO };
  target.combatant.engaged = false;
  const m = target.melee;
  if (m) {
    m.phase = "idle";
    m.timer = 0;
    m.queued = false;
    m.guard = false;
  }
};

/** The `takedown` command (ADR-0065): grabs the target the HUD offers, if there still is one. */
export const startTakedown = (ctx: SimContext, cmd: Extract<GameCommand, { type: "takedown" }>): void => {
  const player = ctx.world.with("player").first;
  if (!player?.health || ctx.session.takedown) return;
  const found = takedownCandidate(ctx, player);
  if (!found) return;
  // Only the takedown that holds the prompt (the interaction system's choice of the last step).
  if (ctx.session.takedownTarget?.id !== found.target.id) return;
  ctx.session.takedown = { target: found.target.id, left: TAKEDOWN_TIME, lethal: cmd.lethal, health: player.health.current };
  if (player.velocity) player.velocity = { ...ZERO };
  hold(found.target);
  ctx.bus.emit("TakedownStarted", { target: found.target.id, duration: TAKEDOWN_TIME });
};

/** The target broke free: it fights the player from where she stood. */
const breakFree = (target: Target, player: Entity): void => {
  if (!target.ai) return;
  target.ai.alerted = true;
  target.ai.lastKnown = { ...player.position };
};

/**
 * Knocked out: down for good until stage 2 of the ADR brings the waking. Its mind is wiped: it
 * no longer counts as fighting (the RAM, the activities, the contract's alarm read `alerted`).
 */
const knockOut = (ctx: SimContext, target: Target): void => {
  ctx.world.addComponent(target, "unconscious", true);
  hold(target);
  if (target.ai) {
    target.ai.alerted = false;
    target.ai.lastKnown = null;
    target.ai.search = 0;
    target.ai.lost = 0;
    target.ai.suspicion = 0;
    target.ai.sees = false;
    // The HUD drops its awareness marker.
    ctx.bus.emit("AwarenessChanged", { observerId: target.id, state: "unaware", level: 0, lastKnown: null });
  }
};

/** Killed: the death system takes it from here, as after a blow in a fight. */
const kill = (ctx: SimContext, target: Target, player: Entity): void => {
  const amount = target.health.current;
  target.health = { current: 0, max: target.health.max };
  target.lastHitBy = player.id;
  ctx.bus.emit("DamageDealt", { sourceId: player.id, targetId: target.id, amount, critical: false, zone: "torso", at: chestOf(target) });
};

const advance = (ctx: SimContext, run: TakedownRun, player: Entity | null): void => {
  const target = [...ctx.world.with("combatant", "health")].find((e) => e.id === run.target);
  if (!player || ctx.session.gameOver || !target || target.health.current <= 0) {
    ctx.session.takedown = null;
    ctx.bus.emit("TakedownBroken", { target: run.target, reason: "gone" });
    return;
  }
  if ((player.health?.current ?? 0) < run.health) {
    ctx.session.takedown = null;
    breakFree(target, player);
    ctx.bus.emit("TakedownBroken", { target: run.target, reason: "damage" });
    return;
  }
  hold(target);
  run.left -= ctx.dt;
  if (run.left > TIME_EPSILON) return;
  ctx.session.takedown = null;
  // Holding the attack button to the end turns it into a kill.
  const lethal = run.lethal || ctx.input.fire;
  if (lethal) kill(ctx, target, player);
  else knockOut(ctx, target);
  ctx.bus.emit("TakedownDone", { target: target.id, lethal, witnessed: false });
};

/**
 * Takedowns (ADR-0065), after combat (a blow or a shot that hurt the player this step breaks the
 * hold) and before interaction (its prompt) and death (a lethal takedown dies in the same step).
 * Advances the takedown under way and picks whom the interact key would take down next. Uses
 * no randomness: the target and the outcome follow from the rules.
 */
export const takedownSystem: System = {
  name: "takedown",
  run(ctx) {
    const player = ctx.world.with("player").first ?? null;
    const run = ctx.session.takedown;
    if (run) advance(ctx, run, player);
    const found = player ? takedownCandidate(ctx, player) : null;
    ctx.session.takedownTarget = found ? { id: found.target.id, distance: found.distance } : null;
  },
};
