import { BehaviourTree, State } from "mistreevous";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];
import { angleTo, factionStance, normalize, strikeAt, sub, type EntityId, type FactionStance, type Vec3 } from "@seki/core";
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
import { type Detour, SAME_FLOOR, detourStep, followDetour, planDetour, straightWalk } from "./steering";
import { type AwarenessState } from "@seki/core";
import { noteDetected } from "../../world/street";

export const GANGER_SPEED = 3.1;
/** A ganger with a melee weapon runs at whoever it fights to close the distance (ADR-0019). */
export const MELEE_CHASE_SPEED = 3.9;
/** Pause after a melee swing's recovery before the next one, plus up to `MELEE_REST_JITTER`. */
export const MELEE_REST = 0.45;
const MELEE_REST_JITTER = 0.4;
const TURN_RATE = 6;
/** A melee fighter reaches no higher or lower than this (a brawler under the footbridge cannot hit it). */
const MELEE_REACH_Y = 1.2;
/**
 * Stuck detection (ADR-0025): a ganger that wants to move but has not got `STUCK_DISTANCE`
 * metres away from where it stood `STUCK_TIME` seconds ago takes the way around for
 * `UNSTICK_TIME` seconds, with a sidestep, even where the knee-high line looks free.
 */
export const STUCK_TIME = 1.5;
const STUCK_DISTANCE = 0.4;
const UNSTICK_TIME = 1.2;
/** Sideways share of the walk while getting unstuck. */
const SIDESTEP = 0.6;

/**
 * Transient progress memory of one walker (like the melee state, not saved): where it stood
 * when the current stretch began, and until when it is getting unstuck.
 */
interface Progress {
  x: number;
  z: number;
  since: number;
  unstickUntil: number;
  /** Side of the sidestep, flipped every time it gets stuck again. */
  side: 1 | -1;
  /** The repath made when it got stuck: round the static obstacles and the other characters. */
  plan: Detour | null;
}

/** Characters this close count as obstacles in the repath of a stuck walker. */
const CROWD_RADIUS = 8;
/** The repath is for this goal; a goal that moved further than this needs the ordinary way. */
const PLAN_DRIFT = 2;

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
/** A guard on watch sweeps this far either side of its post's facing, once per `WATCH_PERIOD` seconds. */
export const WATCH_SWEEP = 0.7;
const WATCH_PERIOD = 8;

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
/** Looking around at the lead: the facing sweeps this far either side, once per `SEARCH_PERIOD`. */
const SEARCH_SWEEP = 1.4;
const SEARCH_PERIOD = 3;
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
  if (!g.ai || g.ai.alerted) return;
  g.ai.lastKnown = { x: at.x, y: at.y, z: at.z };
  g.ai.search = 0;
};

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
  progress: Progress | null = null;
  /** Set by every walk this step; read by the stuck check after the tree has run. */
  walking = false;
  /** Where the last walk this step was headed. */
  goal: Vec3 | null = null;
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
    this.pursueTo(lead);
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
    this.walkTo(target.victim.position);
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

  /**
   * Goes after the player while it sees them (or just lost them), after the last known position
   * once the trail is cold (ADR-0029).
   */
  ChasePlayer = (): State => {
    const { self, seen } = this;
    if (!self || !seen.player) return State.FAILED;
    const tracking = seen.visible || (self.ai.lost ?? 0) <= TRACK_GRACE || !self.ai.lastKnown;
    const goal = tracking ? seen.player.position : (self.ai.lastKnown ?? seen.player.position);
    this.pursueTo(goal);
    if (tracking) this.face(seen.player);
    return State.SUCCEEDED;
  };

  /**
   * Goes after a target (ADR-0021, ADR-0025). On the same floor it walks straight at it when
   * the knee-high line is free, and around the obstacle (the floor's distance field) when it
   * is not. With the target on another level, or on the same level but not reachable on this
   * floor, it takes the stairs through the district's transition graph; a gunner instead heads
   * for the nearest point that gives it a shot, when that is closer than the way up. With
   * neither (a roof reached by a ladder, seen from nowhere) it goes back to its post rather
   * than wait under the target's feet. Lifts and ladders are for the player.
   */
  private pursueTo(to: Vec3): void {
    const { ctx, self } = this;
    if (!ctx || !self) return;
    const from = self.position;
    const apart = Math.abs(to.y - from.y) > LEVEL_GAP;
    const raised = from.y > LEVEL_GAP || to.y > LEVEL_GAP;
    if (!apart) {
      const step = this.head(to);
      if (step || !raised) {
        this.goal = to;
        this.moveTowards((step ?? to).x, (step ?? to).z);
        return;
      }
    }
    const route = routeAcrossLevels(ctx.world, WORLD_NAV, from, to);
    const shot = self.combatant?.stats?.melee || !apart ? null : firingPosition(ctx.world, WORLD_NAV, from, to, self.ai.attackRange);
    const way = shot && (!route || shot.cost < route.cost) ? shot : route;
    if (way && Math.hypot(way.next.x - from.x, way.next.z - from.z) < 0.05) self.velocity = { x: 0, y: 0, z: 0 };
    else if (way) this.walkTo(way.next);
    else if (apart) this.walkTo(self.ai.home);
    else this.moveTowards(to.x, to.z);
  }

  /** Walks towards a point on its floor, around obstacles when the straight line is blocked. */
  private walkTo(goal: Vec3): void {
    const p = this.head(goal) ?? goal;
    this.goal = goal;
    this.moveTowards(p.x, p.z);
  }

  /**
   * The point to head for on the way to `goal` (ADR-0025): the goal itself when the knee-high
   * line is free (or the goal is on another floor), a point round the obstacle otherwise, the
   * repath while getting unstuck. Null when this floor does not lead there.
   */
  private head(goal: Vec3): Vec3 | null {
    const { ctx, self } = this;
    if (!ctx || !self) return null;
    const from = self.position;
    if (Math.abs(goal.y - from.y) > SAME_FLOOR) return goal;
    const plan = this.progress?.plan;
    if (this.unsticking() && plan && Math.hypot(plan.goal.x - goal.x, plan.goal.z - goal.z) < PLAN_DRIFT) {
      const p = followDetour(plan, from);
      if (p) return p;
    }
    if (!this.unsticking() && straightWalk(ctx.world, from, goal)) return goal;
    return detourStep(ctx.world, from, goal);
  }

  private unsticking(): boolean {
    const { ctx, progress } = this;
    return !!ctx && !!progress && ctx.tick < progress.unstickUntil;
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
    if (d > 0.3) this.walkTo(self.ai.home);
    else self.velocity = { x: 0, y: 0, z: 0 };
    const watch = self.ai.watch;
    if ((self.ai.suspicion ?? 0) > 0 && this.seen.player) this.face(this.seen.player);
    else if (watch && ctx && d <= 0.3) self.yaw = watch.yaw + WATCH_SWEEP * Math.sin((2 * Math.PI * ctx.tick * ctx.dt) / WATCH_PERIOD + watch.phase);
    return State.SUCCEEDED;
  };

  private moveTowards(x: number, z: number): void {
    const self = this.self;
    if (!self) return;
    const dx = x - self.position.x;
    const dz = z - self.position.z;
    const d = Math.hypot(dx, dz);
    const speed = self.combatant?.stats?.melee ? MELEE_CHASE_SPEED : GANGER_SPEED;
    if (d < 1e-6) {
      self.velocity = { x: 0, y: 0, z: 0 };
      return;
    }
    this.walking = true;
    let ux = dx / d;
    let uz = dz / d;
    const p = this.progress;
    if (p && !p.plan && this.unsticking()) {
      // Getting unstuck: lean to one side of the way, so two walkers jammed in a gap part.
      const sx = ux + -uz * p.side * SIDESTEP;
      const sz = uz + ux * p.side * SIDESTEP;
      const s = Math.hypot(sx, sz);
      ux = sx / s;
      uz = sz / s;
    }
    self.velocity = { x: ux * speed, y: 0, z: uz * speed };
  }

  /**
   * After the tree: tracks whether a walking ganger gets anywhere. Standing still (shooting,
   * holding a post) resets the stretch.
   */
  checkProgress(): void {
    const { ctx, self } = this;
    if (!ctx || !self) return;
    const { x, z } = self.position;
    const p = this.progress;
    if (!this.walking || !p) {
      this.progress = { x, z, since: ctx.tick, unstickUntil: p?.unstickUntil ?? 0, side: p?.side ?? (self.id % 2 === 0 ? 1 : -1), plan: p?.plan ?? null };
      return;
    }
    if (Math.hypot(x - p.x, z - p.z) >= STUCK_DISTANCE) {
      p.x = x;
      p.z = z;
      p.since = ctx.tick;
      return;
    }
    if ((ctx.tick - p.since) * ctx.dt * this.timeScale < STUCK_TIME || ctx.tick < p.unstickUntil) return;
    p.unstickUntil = ctx.tick + Math.ceil(UNSTICK_TIME / (ctx.dt * Math.max(this.timeScale, 1e-3)));
    p.side = p.side === 1 ? -1 : 1;
    p.since = ctx.tick;
    const crowd: Vec3[] = [];
    for (const e of inCreationOrder(ctx.world.with("body"))) {
      if (e === self || e.player || Math.hypot(e.position.x - x, e.position.z - z) > CROWD_RADIUS) continue;
      crowd.push(e.position);
    }
    p.plan = this.goal ? planDetour(ctx.world, self.position, this.goal, crowd) : null;
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

/**
 * Keeps the last known position and the search of one AI up to date (ADR-0029). Seen: the
 * player's position. Alerted out of sight: still tracked for `TRACK_GRACE`, then chased as it
 * was; reached (or chased for `GIVE_UP`) without contact, the AI stops fighting and searches.
 * A lead's search running out clears it.
 */
const track = (ctx: SimContext, g: Ganger, player: Entity | null, visible: boolean, dt: number): void => {
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

/** AwarenessChanged when the state changes or the level moves by `AWARENESS_STEP` (no spam every tick). */
const report = (ctx: SimContext, g: Ganger, agent: GangerAgent): void => {
  const now = awarenessOf(g.ai);
  const last = agent.reported;
  if (now.state === last.state && Math.abs(now.level - last.level) < AWARENESS_STEP && !(now.level === 0 && last.level > 0)) return;
  agent.reported = now;
  ctx.bus.emit("AwarenessChanged", { observerId: g.id, state: now.state, level: now.level, lastKnown: g.ai.lastKnown ? { ...g.ai.lastKnown } : null });
};

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
      const heat = ctx.state.domain.heat;
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
        const blind = (g.hackFx?.blind ?? 0) > 0;
        let visible = !blind && !!player && distance <= aggro && lineOfSight(ctx.world, eyeOf(g), chestOf(player));
        if (g.ai.cone && player && !g.ai.alerted) {
          // A corporate guard needs a moment of looking before it believes its eyes.
          const sees = guardSees(g, player, distance, visible, aggro);
          const before = g.ai.suspicion ?? 0;
          const rate = sees ? SUSPICION_RATE * (1.5 - Math.min(1, distance / aggro)) : -SUSPICION_DECAY;
          g.ai.suspicion = Math.max(0, Math.min(1, before + rate * ctx.dt * timeScale));
          visible = g.ai.suspicion >= 1;
        }
        // The district's security hunting the player (ADR-0029) attacks on sight whatever the stance.
        const hunted = heat.level > 0 && heat.faction === (g.faction ?? "hebi");
        if (visible && (stance !== "friendly" || hunted)) g.ai.alerted = true;
        g.ai.sees = visible;
        track(ctx, g, player, visible, ctx.dt * timeScale);
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
          brain.agent.walking = false;
          brain.agent.checkProgress();
          continue;
        }
        brain.agent.walking = false;
        brain.agent.goal = null;
        brain.tree.step();
        // Paralysed by `cripple_movement` (ADR-0029): it turns and shoots, but does not walk.
        if ((g.hackFx?.crippled ?? 0) > 0) g.velocity = { x: 0, y: 0, z: 0 };
        brain.agent.checkProgress();
        report(ctx, g, brain.agent);
      }
      for (const id of [...trees.keys()]) if (!alive.has(id)) trees.delete(id);
    },
  };
};
