import { type AwarenessState, DISGUISE_FACTION, type DomainState, type FactionStance, type SightProfile, type Vec3, angleTo, factionStance, sightOf } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { LEVEL_GAP } from "../../world/nav";
import { noteDetected } from "../../world/street";
import { coveredFrom } from "../../world/disguise";
import { disguisedSight } from "./disguise-sight";
import { difficultyOf } from "../../world/difficulty";

/*
 * What a ganger knows (ADR-0024, ADR-0029): sight of the player and of a victim, a guard's
 * suspicion, the last known position and the awareness the HUD shows. The behaviour tree in
 * ganger-ai-system.ts acts on it.
 */

/**
 * Sight of an enemy with the AI of a ganger (ADR-0069, from ADR-0024's guard): the profile of its
 * type (`ENEMY_TYPES[type].vision`). Unalerted it sees in a cone in front of it, a crouching
 * player only from `crouchSight` of its range, and anyone standing within `near` whatever its
 * facing (unless they crouch). Seeing fills its suspicion, faster the closer the player is; at 1
 * it raises the alarm. Out of sight the suspicion drains again. Alerted it sees all round.
 */
const SUSPICION_DECAY = 0.5;

/** The sight profile of an AI (a Hebi ganger's for anything untyped). */
export const visionOf = (g: Entity): SightProfile => sightOf(g.enemy?.type);

/** Whether a point `distance` m off is in the cone of `g` or close enough to be seen whatever its facing. */
export const inSightCone = (g: Entity, x: number, z: number, distance: number): boolean => {
  const v = visionOf(g);
  return distance <= v.near || Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, x, z)) <= v.cone;
};

/**
 * Whether an enemy notices the player this step (pure; the caller keeps the meter). `inSight` is
 * a clear line within `sight`, the range under the faction's stance. Alerted it needs no more.
 */
export const enemySees = (g: Entity, player: Entity, distance: number, inSight: boolean, sight: number): boolean => {
  if (!inSight) return false;
  if (g.ai?.alerted) return true;
  const v = visionOf(g);
  const crouched = (player.posture?.amount ?? 0) > 0.5;
  if (distance <= v.near && !crouched) return true;
  if (distance > sight * (crouched ? v.crouchSight : 1)) return false;
  return Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, player.position.x, player.position.z)) <= v.cone;
};

/** Fills or drains the suspicion of `g` for this step; returns whether it believes its eyes (full). */
const suspect = (ctx: SimContext, g: Ganger, sees: boolean, distance: number, sight: number, timeScale: number): boolean => {
  // It fills at the difficulty's pace (`awareness`, ADR-0066) and drains as ever.
  const rate = sees ? visionOf(g).suspicionRate * difficultyOf(ctx).awareness * (1.5 - Math.min(1, distance / sight)) : -SUSPICION_DECAY;
  g.ai.suspicion = Math.max(0, Math.min(1, (g.ai.suspicion ?? 0) + rate * ctx.dt * timeScale));
  return g.ai.suspicion >= 1;
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
 * What a ganger makes of the player this step: how far they are and whether it sees them. An
 * unalerted one fills its suspicion first and believes its eyes only at 1 (ADR-0069); one that
 * would not attack her anyway (friendly, a tolerant patrol) just watches what it sees. Seeing a
 * player its faction dislikes alerts it, and so does being the security that hunts them
 * (ADR-0029). In a disguise of its faction (ADR-0033) it sees one of its own until the disguise
 * is blown.
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
  const inSight = !blind && !!player && distance <= aggro && lineOfSight(ctx.world, eyeOf(g), chestOf(player));
  // The district's security hunting the player (ADR-0029) attacks on sight whatever the stance.
  const hunted = heat.level > 0 && heat.faction === (g.faction ?? "hebi");
  const lenient = (stance === "friendly" && !hunted) || tolerates(ctx, g, stance, hunted);
  let visible = inSight;
  if (player) {
    const sees = enemySees(g, player, distance, inSight, aggro);
    if (coveredFrom(ctx, g.faction)) visible = disguisedSight(ctx, g, player, sees, distance, aggro, timeScale);
    else if (g.ai.alerted) visible = sees;
    else if (lenient) {
      // It only watches her: no meter to fill, and what was in it drains away.
      g.ai.suspicion = Math.max(0, (g.ai.suspicion ?? 0) - SUSPICION_DECAY * ctx.dt * timeScale);
      visible = sees;
    } else visible = suspect(ctx, g, sees, distance, aggro, timeScale);
  }
  if (visible && !lenient) g.ai.alerted = true;
  g.ai.sees = visible;
  return { player, distance, visible };
};
