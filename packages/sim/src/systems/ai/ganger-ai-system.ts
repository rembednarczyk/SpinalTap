import { BehaviourTree, State } from "mistreevous";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];
import { WEAPONS, normalize, sub, type EntityId } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { worldTimeScale } from "../ability-system";
import { fireShot } from "../combat-system";
import { GANGER_TREE } from "./ganger-tree";

export const GANGER_SPEED = 3.1;
const TURN_RATE = 6;
const GANGER_CRIT = { critChance: 0.05, critMultiplier: 1.5, damageBonus: 0 };

type Ganger = Entity & { ai: NonNullable<Entity["ai"]>; velocity: NonNullable<Entity["velocity"]> };

interface Perception {
  player: Entity | null;
  distance: number;
  visible: boolean;
}

/** The blackboard the tree's conditions and actions read. Rebound to the current entity each step. */
class GangerAgent {
  ctx: SimContext | null = null;
  self: Ganger | null = null;
  /** Local time scale (the player's overdrive slows gangers down). */
  timeScale = 1;
  seen: Perception = { player: null, distance: Infinity, visible: false };

  SeesPlayer = (): boolean => this.seen.visible;
  PlayerAlive = (): boolean => this.seen.player !== null;
  IsAlerted = (): boolean => this.self?.ai.alerted ?? false;
  PlayerInAttackRange = (): boolean => !!this.self && this.seen.distance <= this.self.ai.attackRange;

  ShootAtPlayer = (): State => {
    const { ctx, self, seen } = this;
    if (!ctx || !self || !seen.player) return State.FAILED;
    self.velocity = { x: 0, y: 0, z: 0 };
    this.face(seen.player);
    const combatant = self.combatant;
    if (combatant && combatant.cooldown <= 0) {
      const origin = eyeOf(self);
      fireShot(ctx, { shooter: self, origin, dir: normalize(sub(chestOf(seen.player), origin)), ...GANGER_CRIT }, ctx.rng);
      // Stagger the next burst so the two gangers do not fire in lockstep.
      combatant.cooldown = WEAPONS[combatant.weapon].cooldown + ctx.rng.next() * 0.5;
    }
    return State.SUCCEEDED;
  };

  ChasePlayer = (): State => {
    const { self, seen } = this;
    if (!self || !seen.player) return State.FAILED;
    this.moveTowards(seen.player.position.x, seen.player.position.z);
    this.face(seen.player);
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

/** Drives every ganger through its behaviour tree. One tree per entity, created lazily. */
export const createGangerAiSystem = (): System => {
  const trees = new Map<EntityId, { tree: BehaviourTree; agent: GangerAgent }>();
  return {
    name: "ganger-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      const timeScale = worldTimeScale(ctx);
      for (const g of inCreationOrder(ctx.world.with("ai", "velocity"))) {
        alive.add(g.id);
        let brain = trees.get(g.id);
        if (!brain) {
          const agent = new GangerAgent();
          brain = { agent, tree: new BehaviourTree(GANGER_TREE, agent as unknown as Agent) };
          trees.set(g.id, brain);
        }
        const distance = player ? Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z) : Infinity;
        const visible = !!player && distance <= g.ai.aggroRange && lineOfSight(ctx.world, eyeOf(g), chestOf(player));
        if (visible) g.ai.alerted = true;
        brain.agent.ctx = ctx;
        brain.agent.self = g;
        brain.agent.seen = { player, distance, visible };
        brain.agent.timeScale = timeScale;
        brain.tree.step();
      }
      for (const id of [...trees.keys()]) if (!alive.has(id)) trees.delete(id);
    },
  };
};
