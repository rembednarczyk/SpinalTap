import { type AwarenessState, DISGUISE_FACTION, type DomainState, type FactionStance, type Vec3, angleTo, factionStance } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { LEVEL_GAP } from "../../world/nav";
import { noteDetected } from "../../world/street";
import { coveredFrom } from "../../world/disguise";
import { disguisedSight } from "./disguise-sight";

/*
 * What a ganger knows (ADR-0024, ADR-0029): sight of the player and of a victim, a guard's
 * suspicion, the last known position and the awareness the HUD shows. The behaviour tree in
 * ganger-ai-system.ts acts on it.
 */

/**
 * Sight of a corporate guard (ADR-0024). It sees in a cone in front of it, a crouching player
 * only from half as far, and anyone standing right next to it whatever the facing (unless they
 * crouch). Seeing fills its suspicion, faster the closer the player is; at 1 it raises the alarm.
 * Out of sight the suspicion drains again.
 */
export const GUARD_CONE = 1.05;
export const GUARD_CROUCH_SIGHT = 0.5;
export const GUARD_NEAR = 2.2;
const SUSPICION_RATE = 1.4;
const SUSPICION_DECAY = 0.5;

/** Whether a cone-sighted guard notices the player this step (pure; the caller keeps the meter). */
export const guardSees = (g: Entity, player: Entity, distance: number, inSight: boolean, sight: number): boolean => {
  if (!inSight) return false;
  const crouched = (player.posture?.amount ?? 0) > 0.5;
  if (distance <= GUARD_NEAR && !crouched) return true;
  if (distance > sight * (crouched ? GUARD_CROUCH_SIGHT : 1)) return false;
  return Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, player.position.x, player.position.z)) <= GUARD_CONE;
};

/**
 * Last known position (ADR-0029). For `TRACK_GRACE` seconds after losing sight an alerted AI
 * still knows where the player went (it heard them); then it heads for the last position it
 * had. Arriving there (within `LEAD_ARRIVE`) without seeing the player, or after `GIVE_UP`
 * seconds of chasing a ghost, it stops fighting and looks around for `SEARCH_SECONDS`.
 */
export const TRACK_GRACE = 1.5;
export const LEAD_ARRIVE = 1.5;
export const GIVE_UP = 20;
export const SEARCH_SECONDS = 6;
/** AwarenessChanged goes out when the state changes or the level moves this much. */
export const AWARENESS_STEP = 0.25;

/** The awareness the HUD shows for an AI (ADR-0029): state and level 0..1. */
export const awarenessOf = (ai: Ganger["ai"]): { state: AwarenessState; level: number } => {
  const suspicion = ai.suspicion ?? 0;
  if (ai.alerted) return (ai.lost ?? 0) > TRACK_GRACE ? { state: "searching", level: 0.75 } : { state: "alerted", level: 1 };
  if ((ai.search ?? 0) > 0) return { state: "searching", level: Math.max(0.5, suspicion) };
  if (ai.lastKnown) return { state: "suspicious", level: Math.max(0.4, suspicion) };
  if (suspicion > 0) return { state: "suspicious", level: suspicion };
  return { state: "unaware", level: 0 };
};

/** Where the AI is sent to look (a distraction, a camera, a trace, the heat): it walks there unless it is fighting. */
export const giveLead = (g: Entity, at: Vec3): void => {
  // Someone knocked out is told nothing (ADR-0065).
  if (!g.ai || g.ai.alerted || g.unconscious) return;
  g.ai.lastKnown = { x: at.x, y: at.y, z: at.z };
  g.ai.search = 0;
};

/** A gang that wants the player dead looks for them harder. */
export const HOSTILE_AGGRO_MULTIPLIER = 1.5;

/** Aggro range under a given Hebi stance. */
export const effectiveAggroRange = (base: number, stance: FactionStance): number =>
  stance === "hostile" ? base * HOSTILE_AGGRO_MULTIPLIER : base;

export type Ganger = Entity & { ai: NonNullable<Entity["ai"]>; velocity: NonNullable<Entity["velocity"]> };

export interface Perception {
  player: Entity | null;
  distance: number;
  visible: boolean;
}

/** What a ganger sent after an NPC knows about its victim. */
export interface VictimPerception {
  victim: Entity | null;
  distance: number;
  visible: boolean;
}

export const NO_VICTIM: VictimPerception = { victim: null, distance: Infinity, visible: false };

/**
 * Keeps the last known position and the search of one AI up to date (ADR-0029). Seen: the
 * player's position. Alerted out of sight: still tracked for `TRACK_GRACE`, then chased as it
 * was; reached (or chased for `GIVE_UP`) without contact, the AI stops fighting and searches.
 * A lead's search running out clears it.
 */
export const track = (ctx: SimContext, g: Ganger, player: Entity | null, visible: boolean, dt: number): void => {
  const ai = g.ai;
  if (ai.alerted) {
    if (visible && player) noteDetected(ctx);
    if (!player) return;
    ai.search = 0;
    if (visible) {
      ai.lost = 0;
      ai.lastKnown = { ...player.position };
      return;
    }
    ai.lost = (ai.lost ?? 0) + dt;
    // Alerted without having seen the player (a hit, a shot, the hack's wave): it knows roughly where.
    if (ai.lost <= TRACK_GRACE || !ai.lastKnown) ai.lastKnown = { ...player.position };
    const lead = ai.lastKnown;
    const there = Math.hypot(lead.x - g.position.x, lead.z - g.position.z) < LEAD_ARRIVE && Math.abs(lead.y - g.position.y) < LEVEL_GAP;
    if (ai.lost > TRACK_GRACE && (there || ai.lost > GIVE_UP) && !ai.victim) {
      ai.alerted = false;
      ai.lost = 0;
      ai.search = SEARCH_SECONDS;
    }
    return;
  }
  ai.lost = 0;
  const lead = ai.lastKnown;
  if (!lead) return;
  if ((ai.search ?? 0) > 0) {
    ai.search = Math.max(0, (ai.search ?? 0) - dt);
    if (ai.search === 0) ai.lastKnown = null;
    return;
  }
  if (Math.hypot(lead.x - g.position.x, lead.z - g.position.z) < LEAD_ARRIVE) ai.search = SEARCH_SECONDS;
};

/** Living NPCs some ganger was sent after, by key. Empty (and cheap) when no wave is out. */
export const victimsOf = (ctx: SimContext): Map<string, Entity> => {
  const wanted = new Set<string>();
  for (const g of ctx.world.with("ai")) if (g.ai.victim) wanted.add(g.ai.victim);
  const out = new Map<string, Entity>();
  if (wanted.size === 0) return out;
  // Someone knocked out is nobody's target (ADR-0065).
  for (const e of ctx.world.with("health")) if (e.key && wanted.has(e.key) && e.health.current > 0 && !e.unconscious) out.set(e.key, e);
  return out;
};

export const perceiveVictim = (ctx: SimContext, g: Entity, victim: Entity): VictimPerception => {
  const distance = Math.hypot(victim.position.x - g.position.x, victim.position.z - g.position.z);
  return { victim, distance, visible: lineOfSight(ctx.world, eyeOf(g), chestOf(victim)) };
};

/**
 * A street patrol (ADR-0048) lets a neutral player walk its ground: it only watches her, unless
 * the heat sends it after her or she was caught in its own colours (a blown disguise).
 */
const tolerates = (ctx: SimContext, g: Ganger, stance: FactionStance, hunted: boolean): boolean => {
  if (!g.ai.patrol || stance !== "neutral" || hunted) return false;
  const d = ctx.state.domain.disguise;
  return !(d.blown && d.role !== null && DISGUISE_FACTION[d.role] === g.faction);
};

/**
 * What a ganger makes of the player this step: how far they are and whether it sees them. A
 * cone-sighted guard fills its suspicion first and believes its eyes only at 1. Seeing a player
 * its faction dislikes alerts it, and so does being the security that hunts them (ADR-0029).
 * In a disguise of its faction (ADR-0033) it sees one of its own until the disguise is blown.
 */
export const perceivePlayer = (
  ctx: SimContext,
  g: Ganger,
  player: Entity | null,
  { reputation, heat }: Pick<DomainState, "reputation" | "heat">,
  timeScale: number,
): Perception => {
  const distance = player ? Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z) : Infinity;
  const stance = factionStance(reputation, g.faction ?? "hebi");
  const aggro = effectiveAggroRange(g.ai.aggroRange, stance);
  const blind = (g.hackFx?.blind ?? 0) > 0;
  let visible = !blind && !!player && distance <= aggro && lineOfSight(ctx.world, eyeOf(g), chestOf(player));
  if (player && coveredFrom(ctx, g.faction)) {
    const sees = g.ai.cone && !g.ai.alerted ? guardSees(g, player, distance, visible, aggro) : visible;
    visible = disguisedSight(ctx, g, player, sees, distance, aggro, timeScale);
  } else if (!g.ai.cone && (g.ai.suspicion ?? 0) > 0) {
    // Suspicion of a disguise that is gone (blown, or taken off) drains away.
    g.ai.suspicion = Math.max(0, (g.ai.suspicion ?? 0) - SUSPICION_DECAY * ctx.dt * timeScale);
  } else if (g.ai.cone && player && !g.ai.alerted) {
    // A corporate guard needs a moment of looking before it believes its eyes.
    const sees = guardSees(g, player, distance, visible, aggro);
    const before = g.ai.suspicion ?? 0;
    const rate = sees ? SUSPICION_RATE * (1.5 - Math.min(1, distance / aggro)) : -SUSPICION_DECAY;
    g.ai.suspicion = Math.max(0, Math.min(1, before + rate * ctx.dt * timeScale));
    visible = g.ai.suspicion >= 1;
  }
  // The district's security hunting the player (ADR-0029) attacks on sight whatever the stance.
  const hunted = heat.level > 0 && heat.faction === (g.faction ?? "hebi");
  if (visible && (stance !== "friendly" || hunted) && !tolerates(ctx, g, stance, hunted)) g.ai.alerted = true;
  g.ai.sees = visible;
  return { player, distance, visible };
};
