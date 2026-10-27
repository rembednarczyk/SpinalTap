import { BehaviourTree, State } from "mistreevous";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];
import { WEAPONS, factionStance, normalize, sub, type EntityId, type FactionStance } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { worldTimeScale } from "../ability-system";
import { aimSpreadOf, fireShot } from "../combat-system";
import { GANGER_TREE } from "./ganger-tree";

export const GANGER_SPEED = 3.1;
const TURN_RATE = 6;
const GANGER_CRIT = { critChance: 0.05, critMultiplier: 1.5, damageBonus: 0 };
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
  PlayerInAttackRange = (): boolean => !!this.self && this.seen.distance <= this.self.ai.attackRange;
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
    if (combatant && combatant.cooldown <= 0) {
      const origin = eyeOf(self);
      const dir = normalize(sub(chestOf(target), origin));
      fireShot(ctx, { shooter: self, origin, dir, spread: aimSpreadOf(self, null), ...GANGER_CRIT }, ctx.rng);
      // Stagger the next burst so the two gangers do not fire in lockstep.
      combatant.cooldown = WEAPONS[combatant.weapon].cooldown + ctx.rng.next() * 0.5;
    }
    return State.SUCCEEDED;
  }

  ChasePlayer = (): State => {
    const { self, seen } = this;
    if (!self || !seen.player) return State.FAILED;
    this.moveTowards(seen.player.position.x, seen.player.position.z);
    this.face(seen.player);
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

  HoldPosition = (): State => {
    const { self } = this;
    if (!self) return State.FAILED;
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
    self.velocity = d < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: (dx / d) * GANGER_SPEED, y: 0, z: (dz / d) * GANGER_SPEED };
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
        brain.tree.step();
      }
      for (const id of [...trees.keys()]) if (!alive.has(id)) trees.delete(id);
    },
  };
};
