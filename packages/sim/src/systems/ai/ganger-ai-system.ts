import { BehaviourTree, State } from "mistreevous";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];
import { angleTo, normalize, strikeAt, sub, type EntityId } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { chestOf, eyeOf } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { incapacitated } from "../../world/takedown";
import { followSchedule } from "../../world/schedule";
import { worldTimeScale } from "../ability-system";
import { NPC_CRIT, fireShot, npcSpreadOf } from "../combat-system";
import { startSwing } from "../melee-system";
import { knockbackVelocity } from "../../world/knockback";
import { readyToFire } from "../../world/player-weapon";
import { GANGER_TREE } from "./ganger-tree";
import { GANGER_SPEED, GangerWalk } from "./ganger-walk";
import { type AwarenessState } from "@seki/core";
import {
  AWARENESS_STEP,
  type Ganger,
  NO_VICTIM,
  type Perception,
  TRACK_GRACE,
  type VictimPerception,
  awarenessOf,
  perceivePlayer,
  perceiveVictim,
  track,
  victimsOf,
} from "./ganger-perception";

export { GANGER_SPEED, MELEE_CHASE_SPEED, STUCK_TIME } from "./ganger-walk";

/** Pause after a melee swing's recovery before the next one, plus up to `MELEE_REST_JITTER`. */
export const MELEE_REST = 0.45;
const MELEE_REST_JITTER = 0.4;
const TURN_RATE = 6;
/** A melee fighter reaches no higher or lower than this (a brawler under the footbridge cannot hit it). */
const MELEE_REACH_Y = 1.2;
/** A guard on watch sweeps this far either side of its post's facing, once per `WATCH_PERIOD` seconds. */
export const WATCH_SWEEP = 0.7;
const WATCH_PERIOD = 8;

/** Looking around at the lead: the facing sweeps this far either side, once per `SEARCH_PERIOD`. */
const SEARCH_SWEEP = 1.4;
const SEARCH_PERIOD = 3;

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
  /** Where it walks this step and whether it gets anywhere. */
  readonly walk = new GangerWalk(this);
  /** Presentation memory: the awareness last reported (AwarenessChanged with hysteresis). */
  reported: { state: AwarenessState; level: number } = { state: "unaware", level: 0 };

  HasLead = (): boolean => !!this.self?.ai.lastKnown;

  /** Walks to the lead and looks around there; the search running out sends it back to its post. */
  Investigate = (): State => {
    const { self, ctx } = this;
    const lead = self?.ai.lastKnown;
    if (!self || !ctx || !lead) return State.FAILED;
    if ((self.ai.search ?? 0) > 0) {
      self.velocity = { x: 0, y: 0, z: 0 };
      // Looks around, centred on the way it came (from its post towards the lead).
      const home = self.ai.home;
      const base = Math.atan2(lead.x - home.x, lead.z - home.z);
      self.yaw = base + SEARCH_SWEEP * Math.sin((2 * Math.PI * ctx.tick * ctx.dt) / SEARCH_PERIOD);
      return State.SUCCEEDED;
    }
    this.walk.pursueTo(lead);
    return State.SUCCEEDED;
  };

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
    this.walk.walkTo(target.victim.position);
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
      fireShot(ctx, { shooter: self, origin, dir, spread: npcSpreadOf(ctx, self), ...NPC_CRIT }, ctx.rng);
      // Stagger the next burst so the two gangers do not fire in lockstep.
      combatant.cooldown += ctx.rng.next() * 0.5;
    }
    return State.SUCCEEDED;
  }

  /**
   * Goes after the player while it sees them (or just lost them), after the last known position
   * once the trail is cold (ADR-0029).
   */
  ChasePlayer = (): State => {
    const { self, seen } = this;
    if (!self || !seen.player) return State.FAILED;
    const tracking = seen.visible || (self.ai.lost ?? 0) <= TRACK_GRACE || !self.ai.lastKnown;
    const goal = tracking ? seen.player.position : (self.ai.lastKnown ?? seen.player.position);
    this.walk.pursueTo(goal);
    if (tracking) this.face(seen.player);
    return State.SUCCEEDED;
  };

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

  /**
   * Holds its post, or walks its daily plan (a night patrol) when it has one. A guard on watch
   * looks around its post; one that half saw something turns towards it instead.
   */
  HoldPosition = (): State => {
    const { self, ctx } = this;
    if (!self) return State.FAILED;
    const pose = self.schedule?.pose;
    if (pose && ctx) {
      followSchedule(self, pose, GANGER_SPEED, ctx.dt * this.timeScale);
      return State.SUCCEEDED;
    }
    const d = Math.hypot(self.ai.home.x - self.position.x, self.ai.home.z - self.position.z);
    if (d > 0.3) this.walk.walkTo(self.ai.home);
    else self.velocity = { x: 0, y: 0, z: 0 };
    const watch = self.ai.watch;
    if ((self.ai.suspicion ?? 0) > 0 && this.seen.player) this.face(this.seen.player);
    else if (watch && ctx && d <= 0.3) self.yaw = watch.yaw + WATCH_SWEEP * Math.sin((2 * Math.PI * ctx.tick * ctx.dt) / (watch.period ?? WATCH_PERIOD) + watch.phase);
    return State.SUCCEEDED;
  };

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

/** AwarenessChanged when the state changes or the level moves by `AWARENESS_STEP` (no spam every tick). */
const report = (ctx: SimContext, g: Ganger, agent: GangerAgent): void => {
  const now = awarenessOf(g.ai);
  const last = agent.reported;
  if (now.state === last.state && Math.abs(now.level - last.level) < AWARENESS_STEP && !(now.level === 0 && last.level > 0)) return;
  agent.reported = now;
  ctx.bus.emit("AwarenessChanged", { observerId: g.id, state: now.state, level: now.level, lastKnown: g.ai.lastKnown ? { ...g.ai.lastKnown } : null });
};

interface Brain {
  readonly tree: BehaviourTree;
  readonly agent: GangerAgent;
}

/** The ganger's tree and blackboard, created on first sight. */
const brainOf = (trees: Map<EntityId, Brain>, id: EntityId): Brain => {
  let brain = trees.get(id);
  if (!brain) {
    const agent = new GangerAgent();
    brain = { agent, tree: new BehaviourTree(GANGER_TREE, agent as unknown as Agent) };
    trees.set(id, brain);
  }
  return brain;
};

/**
 * Runs the tree on what the ganger perceives. Off balance or committed to a swing, it stands
 * where it is and the tree waits.
 */
const think = (ctx: SimContext, g: Ganger, { tree, agent }: Brain, seen: Perception, target: VictimPerception, timeScale: number): void => {
  agent.ctx = ctx;
  agent.self = g;
  agent.seen = seen;
  agent.target = target;
  agent.timeScale = timeScale;
  if (g.combatant) g.combatant.engaged = false;
  const m = g.melee;
  if (m && (m.stagger > 0 || m.phase !== "idle")) {
    const knock = knockbackVelocity(g);
    g.velocity = { x: knock.x, y: 0, z: knock.z };
    if (g.combatant) g.combatant.engaged = m.stagger === 0;
    agent.walk.walking = false;
    agent.walk.checkProgress();
    return;
  }
  agent.walk.walking = false;
  agent.walk.goal = null;
  tree.step();
  // Paralysed by `cripple_movement` (ADR-0029): it turns and shoots, but does not walk.
  if ((g.hackFx?.crippled ?? 0) > 0) g.velocity = { x: 0, y: 0, z: 0 };
  agent.walk.checkProgress();
  report(ctx, g, agent);
};

/**
 * Drives every ganger through its behaviour tree. One tree per entity, created lazily.
 * Hebi's stance decides what seeing the player means: hostile and neutral gangers attack on
 * sight (hostile ones from further away), friendly ones only watch until provoked. A ganger
 * sent after an NPC (`ai.victim`) goes for it whatever the stance, and fights the player only
 * when alerted with the player in sight and range.
 */
export const createGangerAiSystem = (): System => {
  const trees = new Map<EntityId, Brain>();
  return {
    name: "ganger-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      const timeScale = worldTimeScale(ctx);
      const { reputation, heat } = ctx.state.domain;
      const victims = victimsOf(ctx);
      for (const g of inCreationOrder(ctx.world.with("ai", "velocity"))) {
        alive.add(g.id);
        // Knocked out or held in a takedown (ADR-0065): it sees, hears and does nothing.
        if (incapacitated(ctx, g)) {
          g.velocity = { x: 0, y: 0, z: 0 };
          g.ai.sees = false;
          continue;
        }
        const brain = brainOf(trees, g.id);
        const seen = perceivePlayer(ctx, g, player, { reputation, heat }, timeScale);
        track(ctx, g, player, seen.visible, ctx.dt * timeScale);
        const victim = g.ai.victim ? (victims.get(g.ai.victim) ?? null) : null;
        think(ctx, g, brain, seen, victim ? perceiveVictim(ctx, g, victim) : NO_VICTIM, timeScale);
      }
      for (const id of [...trees.keys()]) if (!alive.has(id)) trees.delete(id);
    },
  };
};
