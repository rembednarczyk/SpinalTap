import { BehaviourTree, State } from "mistreevous";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];
import { angleTo, factionStance, normalize, strikeAt, sub, type EntityId, type FactionStance } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { followSchedule } from "../../world/schedule";
import { worldTimeScale } from "../ability-system";
import { NPC_CRIT, aimSpreadOf, fireShot } from "../combat-system";
import { startSwing } from "../melee-system";
import { knockbackVelocity } from "../../world/knockback";
import { readyToFire } from "../../world/player-weapon";
import { GANGER_TREE } from "./ganger-tree";
import { WORLD_NAV } from "../../content/world-map";
import { LEVEL_GAP, firingPosition, routeAcrossLevels } from "../../world/nav";

export const GANGER_SPEED = 3.1;
/** A ganger with a melee weapon runs at whoever it fights to close the distance (ADR-0019). */
export const MELEE_CHASE_SPEED = 3.9;
/** Pause after a melee swing's recovery before the next one, plus up to `MELEE_REST_JITTER`. */
export const MELEE_REST = 0.45;
const MELEE_REST_JITTER = 0.4;
const TURN_RATE = 6;
/** A melee fighter reaches no higher or lower than this (a brawler under the footbridge cannot hit it). */
const MELEE_REACH_Y = 1.2;
/** Knee height of the "can I walk straight there" test above street level (ADR-0021). */
const WALK_TEST_HEIGHT = 0.6;

/** A gang that wants the player dead looks for them harder. */
export const HOSTILE_AGGRO_MULTIPLIER = 1.5;

/** Aggro range under a given Hebi stance. */
export const effectiveAggroRange = (base: number, stance: FactionStance): number =>
  stance === "hostile" ? base * HOSTILE_AGGRO_MULTIPLIER : base;

type Ganger = Entity & { ai: NonNullable<Entity["ai"]>; velocity: NonNullable<Entity["velocity"]> };

interface Perception {
  player: Entity | null;
  distance: number;
  visible: boolean;
}

/** What a ganger sent after an NPC knows about its victim. */
interface VictimPerception {
  victim: Entity | null;
  distance: number;
  visible: boolean;
}

const NO_VICTIM: VictimPerception = { victim: null, distance: Infinity, visible: false };

/** The blackboard the tree's conditions and actions read. Rebound to the current entity each step. */
class GangerAgent {
  ctx: SimContext | null = null;
  self: Ganger | null = null;
  /** Local time scale (the player's overdrive slows gangers down). */
  timeScale = 1;
  seen: Perception = { player: null, distance: Infinity, visible: false };
  target: VictimPerception = NO_VICTIM;
  /** Presentation memory only: the warning cue fires once per ganger, it never feeds back into the state. */
  warned = false;

  SeesPlayer = (): boolean => this.seen.visible;
  PlayerAlive = (): boolean => this.seen.player !== null;
  IsAlerted = (): boolean => this.self?.ai.alerted ?? false;
  PlayerInAttackRange = (): boolean => {
    const { self, seen } = this;
    if (!self || !seen.player || seen.distance > self.ai.attackRange) return false;
    // A blade does not reach a floor above or below.
    return !self.combatant?.stats?.melee || Math.abs(seen.player.position.y - self.position.y) <= MELEE_REACH_Y;
  };
  HasVictim = (): boolean => this.target.victim !== null;
  VictimInAttackRange = (): boolean => !!this.self && this.target.visible && this.target.distance <= this.self.ai.attackRange;

  ShootAtPlayer = (): State => (this.seen.player ? this.shootAt(this.seen.player) : State.FAILED);

  ShootAtVictim = (): State => (this.target.victim ? this.shootAt(this.target.victim) : State.FAILED);

  ChaseVictim = (): State => {
    const { self, target } = this;
    if (!self || !target.victim) return State.FAILED;
    this.moveTowards(target.victim.position.x, target.victim.position.z);
    this.face(target.victim);
    return State.SUCCEEDED;
  };

  private shootAt(target: Entity): State {
    const { ctx, self } = this;
    if (!ctx || !self) return State.FAILED;
    self.velocity = { x: 0, y: 0, z: 0 };
    this.face(target);
    const combatant = self.combatant;
    if (combatant) combatant.engaged = true;
    const melee = combatant?.stats?.melee;
    if (melee && combatant && self.melee) {
      // Swing once it faces the target well inside the arc; the windup telegraphs the blow.
      const m = self.melee;
      const facing = Math.abs(angleTo({ x: self.position.x, z: self.position.z, yaw: self.yaw }, target.position.x, target.position.z));
      if (m.phase === "idle" && m.stagger === 0 && facing <= melee.arc * 0.5 && readyToFire(combatant, combatant.loaded)) {
        // Alternate the first two swings of the combo, so the blows read differently.
        const strike = (m.strike + 1) % Math.min(2, melee.combo.length);
        startSwing(ctx, self.id, m, melee, strike, melee.npcWindup);
        combatant.cooldown = melee.npcWindup + strikeAt(melee, strike).recovery + MELEE_REST + ctx.rng.next() * MELEE_REST_JITTER;
      }
      return State.SUCCEEDED;
    }
    if (combatant && readyToFire(combatant, combatant.loaded)) {
      const origin = eyeOf(self);
      const dir = normalize(sub(chestOf(target), origin));
      fireShot(ctx, { shooter: self, origin, dir, spread: aimSpreadOf(self, null), ...NPC_CRIT }, ctx.rng);
      // Stagger the next burst so the two gangers do not fire in lockstep.
      combatant.cooldown += ctx.rng.next() * 0.5;
    }
    return State.SUCCEEDED;
  }

  ChasePlayer = (): State => {
    const { self, seen } = this;
    if (!self || !seen.player) return State.FAILED;
    this.pursue(seen.player);
    this.face(seen.player);
    return State.SUCCEEDED;
  };

  /**
   * Goes after a target (ADR-0021). On the street with the target on the street it walks
   * straight at it, as before. With the target on another level, or up on a deck with
   * something in the way, it takes the stairs through the district's transition graph; a
   * gunner instead heads for the nearest point that gives it a shot, when that is closer than
   * the way up. With neither (a roof reached by a ladder, seen from nowhere) it goes back to
   * its post rather than wait under the target's feet. Lifts and ladders are for the player.
   */
  private pursue(target: Entity): void {
    const { ctx, self } = this;
    if (!ctx || !self) return;
    const from = self.position;
    const to = target.position;
    const apart = Math.abs(to.y - from.y) > LEVEL_GAP;
    const raised = from.y > LEVEL_GAP || to.y > LEVEL_GAP;
    const knee = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + WALK_TEST_HEIGHT, z: p.z });
    if (!apart && (!raised || lineOfSight(ctx.world, knee(from), knee(to)))) {
      this.moveTowards(to.x, to.z);
      return;
    }
    const route = routeAcrossLevels(ctx.world, WORLD_NAV, from, to);
    const shot = self.combatant?.stats?.melee || !apart ? null : firingPosition(ctx.world, WORLD_NAV, from, to, self.ai.attackRange);
    const way = shot && (!route || shot.cost < route.cost) ? shot : route;
    if (way && Math.hypot(way.next.x - from.x, way.next.z - from.z) < 0.05) self.velocity = { x: 0, y: 0, z: 0 };
    else if (way) this.moveTowards(way.next.x, way.next.z);
    else if (apart) this.moveTowards(self.ai.home.x, self.ai.home.z);
    else this.moveTowards(to.x, to.z);
  }

  /** A friendly ganger that is not provoked stops and keeps an eye on the player. */
  WatchPlayer = (): State => {
    const { ctx, self, seen } = this;
    if (!ctx || !self || !seen.player) return State.FAILED;
    self.velocity = { x: 0, y: 0, z: 0 };
    this.face(seen.player);
    if (!this.warned) {
      this.warned = true;
      ctx.bus.emit("NpcReacted", { entityId: self.id, faction: self.faction ?? "hebi", reaction: "warn" });
    }
    return State.SUCCEEDED;
  };

  /** Holds its post, or walks its daily plan (a night patrol) when it has one. */
  HoldPosition = (): State => {
    const { self, ctx } = this;
    if (!self) return State.FAILED;
    const pose = self.schedule?.pose;
    if (pose && ctx) {
      followSchedule(self, pose, GANGER_SPEED, ctx.dt * this.timeScale);
      return State.SUCCEEDED;
    }
    const d = Math.hypot(self.ai.home.x - self.position.x, self.ai.home.z - self.position.z);
    if (d > 0.3) this.moveTowards(self.ai.home.x, self.ai.home.z);
    else self.velocity = { x: 0, y: 0, z: 0 };
    return State.SUCCEEDED;
  };

  private moveTowards(x: number, z: number): void {
    const self = this.self;
    if (!self) return;
    const dx = x - self.position.x;
    const dz = z - self.position.z;
    const d = Math.hypot(dx, dz);
    const speed = self.combatant?.stats?.melee ? MELEE_CHASE_SPEED : GANGER_SPEED;
    self.velocity = d < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: (dx / d) * speed, y: 0, z: (dz / d) * speed };
  }

  private face(target: Entity): void {
    const { self, ctx } = this;
    if (!self || !ctx) return;
    const desired = Math.atan2(target.position.x - self.position.x, target.position.z - self.position.z);
    let delta = (desired - self.yaw) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const maxTurn = TURN_RATE * ctx.dt * this.timeScale;
    self.yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));
  }
}

/** Living NPCs some ganger was sent after, by key. Empty (and cheap) when no wave is out. */
const victimsOf = (ctx: SimContext): Map<string, Entity> => {
  const wanted = new Set<string>();
  for (const g of ctx.world.with("ai")) if (g.ai.victim) wanted.add(g.ai.victim);
  const out = new Map<string, Entity>();
  if (wanted.size === 0) return out;
  for (const e of ctx.world.with("health")) if (e.key && wanted.has(e.key) && e.health.current > 0) out.set(e.key, e);
  return out;
};

const perceiveVictim = (ctx: SimContext, g: Entity, victim: Entity): VictimPerception => {
  const distance = Math.hypot(victim.position.x - g.position.x, victim.position.z - g.position.z);
  return { victim, distance, visible: lineOfSight(ctx.world, eyeOf(g), chestOf(victim)) };
};

/**
 * Drives every ganger through its behaviour tree. One tree per entity, created lazily.
 * Hebi's stance decides what seeing the player means: hostile and neutral gangers attack on
 * sight (hostile ones from further away), friendly ones only watch until provoked. A ganger
 * sent after an NPC (`ai.victim`) goes for it whatever the stance, and fights the player only
 * when alerted with the player in sight and range.
 */
export const createGangerAiSystem = (): System => {
  const trees = new Map<EntityId, { tree: BehaviourTree; agent: GangerAgent }>();
  return {
    name: "ganger-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      const timeScale = worldTimeScale(ctx);
      const reputation = ctx.state.domain.reputation;
      const victims = victimsOf(ctx);
      for (const g of inCreationOrder(ctx.world.with("ai", "velocity"))) {
        alive.add(g.id);
        let brain = trees.get(g.id);
        if (!brain) {
          const agent = new GangerAgent();
          brain = { agent, tree: new BehaviourTree(GANGER_TREE, agent as unknown as Agent) };
          trees.set(g.id, brain);
        }
        const distance = player ? Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z) : Infinity;
        const stance = factionStance(reputation, g.faction ?? "hebi");
        const aggro = effectiveAggroRange(g.ai.aggroRange, stance);
        const visible = !!player && distance <= aggro && lineOfSight(ctx.world, eyeOf(g), chestOf(player));
        if (visible && stance !== "friendly") g.ai.alerted = true;
        brain.agent.ctx = ctx;
        brain.agent.self = g;
        brain.agent.seen = { player, distance, visible };
        const victim = g.ai.victim ? (victims.get(g.ai.victim) ?? null) : null;
        brain.agent.target = victim ? perceiveVictim(ctx, g, victim) : NO_VICTIM;
        brain.agent.timeScale = timeScale;
        if (g.combatant) g.combatant.engaged = false;
        // Off balance or committed to a swing: it stands where it is and the tree waits.
        const m = g.melee;
        if (m && (m.stagger > 0 || m.phase !== "idle")) {
          const knock = knockbackVelocity(g);
          g.velocity = { x: knock.x, y: 0, z: knock.z };
          if (g.combatant) g.combatant.engaged = m.stagger === 0;
          continue;
        }
        brain.tree.step();
      }
      for (const id of [...trees.keys()]) if (!alive.has(id)) trees.delete(id);
    },
  };
};
