import { type GameCommand, type PerkRanks, angleTo, hasProgressionPerk, takedownReachBonus, takedownTimeScale } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System, TakedownRun } from "../world/context";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { isEngaged, noteViolence } from "../world/street";
import { playerHeld } from "../world/takedown";
import { freshDowned } from "../world/bodies";
import { awarenessOf } from "./ai/ganger-perception";
import { seenCommitting } from "./crime-system";
import { fillMagazine } from "../world/player-weapon";
import { noteFight } from "../world/progression-ops";

/** How close the player has to be, metres between the centres on the ground (ADR-0065). */
export const TAKEDOWN_REACH = 1.6;
/** How long the end of a takedown (the knock-out or the kill) holds the player and the target, seconds. */
export const TAKEDOWN_TIME = 1.2;
/** How long the grab waits for the player's choice before it knocks the target out (ADR-0075), seconds. */
export const GRAB_TIME = 3;
/** Half-angle of the cone behind the target's back the player can come from: 120° in all. */
export const TAKEDOWN_BACK_CONE = Math.PI / 3;
/** Most height between the feet: nobody is taken down through a floor. */
const TAKEDOWN_REACH_Y = 0.8;
/** A phase that ends within float noise of the step counts as over. */
const TIME_EPSILON = 1e-6;

type Target = Entity & { health: NonNullable<Entity["health"]> };

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
 * (reach, height, from behind or a target stunned or unaware of her), else null. A target is
 * someone with health and a weapon slot, or a civilian with health (stage 2: an assault once
 * seen), but nobody with a talk, a shop or a job to offer (`interactable`): those are left out
 * in this stage. Pure: the line of sight is the caller's. `reach` grows with Long Arms (ADR-0059).
 */
export const takedownDistance = (player: Entity, e: Target, reach = TAKEDOWN_REACH): number | null => {
  if (e.player || e.unconscious || e.passerby || e.vehicle || e.interactable || e.health.current <= 0 || !(e.combatant || e.civilian)) return null;
  const distance = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
  if (distance > reach || Math.abs(e.position.y - player.position.y) > TAKEDOWN_REACH_Y) return null;
  return behind(e, player) || stunned(e) || unaware(e) ? distance : null;
};

/** As `takedownDistance`, with nothing solid between the player's eyes and the target's chest. */
const reachOf = (ctx: SimContext, player: Entity, e: Target, perks: PerkRanks): number | null => {
  const distance = takedownDistance(player, e, TAKEDOWN_REACH + takedownReachBonus(perks));
  return distance !== null && lineOfSight(ctx.world, eyeOf(player), chestOf(e)) ? distance : null;
};

/**
 * Whom the player could take down now: the nearest NPC with a weapon (or a civilian) and health
 * in reach, from behind, or from any side when it is stunned or unaware of her. Ties go to the
 * older entity. Nobody while she cannot act, carries a body, hangs on a ladder or a ledge, or is
 * in the air.
 */
export const takedownCandidate = (ctx: SimContext, player: Entity): { target: Target; distance: number } | null => {
  // Not with a body on her shoulder either: both hands are full (stage 3).
  if (playerHeld(ctx) || ctx.session.carrying !== null || player.climb || player.mantle || player.fall !== undefined) return null;
  let best: { target: Target; distance: number } | null = null;
  const perks = ctx.state.domain.progression.perks;
  for (const e of inCreationOrder(ctx.world.with("health"))) {
    const distance = reachOf(ctx, player, e, perks);
    if (distance !== null && (!best || distance < best.distance)) best = { target: e, distance };
  }
  return best;
};

/** Holds the target still: no steps, no swing, weapon down. */
const hold = (target: Target): void => {
  if (target.velocity) target.velocity = { ...ZERO };
  if (target.combatant) target.combatant.engaged = false;
  const m = target.melee;
  if (m) {
    m.phase = "idle";
    m.timer = 0;
    m.queued = false;
    m.guard = false;
  }
};

/** The end chosen in the grab (ADR-0075): the finish starts and lasts `run.finish`. */
const choose = (ctx: SimContext, run: TakedownRun, lethal: boolean, timedOut: boolean): void => {
  run.phase = "finish";
  run.lethal = lethal;
  run.left = run.finish;
  ctx.bus.emit("TakedownChosen", { target: run.target, lethal, timedOut });
};

/**
 * The `takedown` command (ADR-0065, ADR-0075): grabs the target the HUD offers, if there still is
 * one. Without `lethal` the grab waits for the player's choice; with it the end starts at once.
 */
export const startTakedown = (ctx: SimContext, cmd: Extract<GameCommand, { type: "takedown" }>): void => {
  const player = ctx.world.with("player").first;
  if (!player?.health || ctx.session.takedown) return;
  const found = takedownCandidate(ctx, player);
  if (!found) return;
  // Only the takedown that holds the prompt (the interaction system's choice of the last step).
  if (ctx.session.takedownTarget?.id !== found.target.id) return;
  // Quick Takedown (ADR-0059) shortens the end, not the time to choose.
  const finish = TAKEDOWN_TIME * takedownTimeScale(ctx.state.domain.progression.perks);
  const chosen = cmd.lethal !== undefined;
  ctx.session.takedown = { target: found.target.id, phase: chosen ? "finish" : "grab", left: chosen ? finish : GRAB_TIME, lethal: cmd.lethal ?? null, finish, health: player.health.current };
  if (player.velocity) player.velocity = { ...ZERO };
  hold(found.target);
  ctx.bus.emit("TakedownStarted", { target: found.target.id, duration: finish, window: chosen ? 0 : GRAB_TIME });
};

/** The `takedown-choose` command (ADR-0075): the knock-out or the kill, while the grab waits for it. */
export const chooseTakedown = (ctx: SimContext, cmd: Extract<GameCommand, { type: "takedown-choose" }>): void => {
  const run = ctx.session.takedown;
  if (run?.phase === "grab") choose(ctx, run, cmd.lethal, false);
};

/** The target broke free: it fights the player from where she stood. */
const breakFree = (target: Target, player: Entity): void => {
  if (!target.ai) return;
  target.ai.alerted = true;
  target.ai.lastKnown = { ...player.position };
};

/**
 * Knocked out: down until an NPC finds it and wakes it (the body watch), knowing where the player
 * stood. Its mind is wiped: it no longer counts as fighting (the RAM, the activities, the
 * contract's alarm read `alerted`). `fought`: it was fighting her, so its body is no crime.
 */
const knockOut = (ctx: SimContext, target: Target, player: Entity, fought: boolean): void => {
  // A fight of her style (ADR-0059 stage 6): an enemy defeated by stealth, unless it already was one.
  if (target.enemy) noteFight(ctx, target, "stealth");
  ctx.world.addComponent(target, "unconscious", true);
  ctx.world.addComponent(target, "downed", freshDowned(player.position, fought));
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

/**
 * Killed: the death system takes it from here, as after a blow in a fight, but leaves its body
 * lying (stage 3): `downed` tells it so, with where she stood, for whoever finds the body.
 */
const kill = (ctx: SimContext, target: Target, player: Entity, fought: boolean): void => {
  ctx.world.addComponent(target, "downed", freshDowned(player.position, fought, true));
  const amount = target.health.current;
  target.health = { current: 0, max: target.health.max };
  target.lastHitBy = player.id;
  target.lastHitStyle = "stealth";
  ctx.bus.emit("DamageDealt", { sourceId: player.id, targetId: target.id, amount, critical: false, zone: "torso", at: chestOf(target) });
};

const advance = (ctx: SimContext, run: TakedownRun, player: Entity | null): void => {
  const target = [...ctx.world.with("health")].find((e) => e.id === run.target);
  if (!player || ctx.session.gameOver || !target || target.health.current <= 0) {
    ctx.session.takedown = null;
    ctx.bus.emit("TakedownBroken", { target: run.target, reason: "gone" });
    return;
  }
  if ((player.health?.current ?? 0) < run.health) {
    ctx.session.takedown = null;
    ctx.session.attackLock = ctx.input.fire;
    breakFree(target, player);
    ctx.bus.emit("TakedownBroken", { target: run.target, reason: "damage" });
    return;
  }
  hold(target);
  run.left -= ctx.dt;
  if (run.left > TIME_EPSILON) return;
  // Nothing chosen in time: the grab ends the gentle way (ADR-0075), and the end starts now.
  if (run.phase === "grab") {
    choose(ctx, run, false, true);
    return;
  }
  ctx.session.takedown = null;
  const lethal = run.lethal === true;
  // The attack button that chose the kill fires nothing until it is let go.
  ctx.session.attackLock = ctx.input.fire;
  const engaged = isEngaged(target);
  if (lethal) kill(ctx, target, player, engaged);
  else knockOut(ctx, target, player, engaged);
  // On someone not fighting her it is an assault (ADR-0029), a crime once a witness sees it; a
  // kill's death is then a murder. The crime system finds the witnesses at the end of the step
  // and marks the body reported once the report is made (a civilian's call can be cut off).
  noteViolence(ctx, target, engaged, target.position, target.id);
  const witnessed = seenCommitting(ctx, player, target.position);
  ctx.bus.emit("TakedownDone", { target: target.id, lethal, witnessed });
  // Ghost Reload (ADR-0059, ADR-0065): a takedown with no alarm (the target was not fighting her) and no witness reloads the weapon in hand.
  if (!engaged && !witnessed && hasProgressionPerk(ctx.state.domain.progression.perks, "shadow_ghost_reload")) fillMagazine(ctx, player);
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
