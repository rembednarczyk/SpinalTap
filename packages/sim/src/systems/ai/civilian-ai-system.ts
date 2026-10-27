import { BehaviourTree, State } from "mistreevous";
import { type EntityId, factionStance } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";
import { followSchedule } from "../../world/schedule";
import { CIVILIAN_TREE } from "./civilian-tree";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];

/** Civilians run from a feared player closer than this (metres). */
export const FLEE_RADIUS = 7;
export const CIVILIAN_FLEE_SPEED = 3.4;
const CIVILIAN_WALK_SPEED = 1.4;
/** Fastest a civilian hurries to catch up with its daily plan (after fleeing, say). */
const CIVILIAN_SCHEDULE_SPEED = 1.6;
const HOME_TOLERANCE = 0.3;

type Civilian = Entity & { civilian: NonNullable<Entity["civilian"]>; velocity: NonNullable<Entity["velocity"]> };

class CivilianAgent {
  ctx: SimContext | null = null;
  self: Civilian | null = null;
  player: Entity | null = null;
  distance = Infinity;
  /** Presentation memory only: one "flee" cue per escape, never read back into the state. */
  fleeing = false;

  FearsPlayer = (): boolean => !!this.ctx && !!this.self && factionStance(this.ctx.state.domain.reputation, this.self.faction ?? "civilians") === "hostile";
  PlayerNearby = (): boolean => this.player !== null && this.distance <= FLEE_RADIUS;

  FleeFromPlayer = (): State => {
    const { ctx, self, player } = this;
    if (!ctx || !self || !player) return State.FAILED;
    const dx = self.position.x - player.position.x;
    const dz = self.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    // Standing exactly on top of each other: run along the street, away from the player's facing.
    const [ux, uz] = d < 1e-6 ? [Math.sin(player.yaw), Math.cos(player.yaw)] : [dx / d, dz / d];
    self.velocity = { x: ux * CIVILIAN_FLEE_SPEED, y: 0, z: uz * CIVILIAN_FLEE_SPEED };
    self.yaw = Math.atan2(ux, uz);
    if (!this.fleeing) {
      this.fleeing = true;
      ctx.bus.emit("NpcReacted", { entityId: self.id, faction: self.faction ?? "civilians", reaction: "flee" });
    }
    return State.SUCCEEDED;
  };

  /** Back to the spot: wherever the daily plan says right now, or the fixed home without one. */
  ReturnHome = (): State => {
    const { self, ctx } = this;
    if (!self) return State.FAILED;
    this.fleeing = false;
    const pose = self.schedule?.pose;
    if (pose && ctx) {
      followSchedule(self, pose, CIVILIAN_SCHEDULE_SPEED, ctx.dt);
      return State.SUCCEEDED;
    }
    const dx = self.civilian.home.x - self.position.x;
    const dz = self.civilian.home.z - self.position.z;
    const d = Math.hypot(dx, dz);
    if (d <= HOME_TOLERANCE) {
      self.velocity = { x: 0, y: 0, z: 0 };
      return State.SUCCEEDED;
    }
    self.velocity = { x: (dx / d) * CIVILIAN_WALK_SPEED, y: 0, z: (dz / d) * CIVILIAN_WALK_SPEED };
    self.yaw = Math.atan2(dx, dz);
    return State.SUCCEEDED;
  };
}

/**
 * Bystanders react to the street's opinion of the player: when the civilians' stance is
 * hostile they keep their distance, otherwise they stay at (or walk back to) their spot.
 * A bystander with a daily plan walks it instead of standing at one spot.
 * Uses no randomness, so it cannot shift the RNG stream of the combat systems.
 */
export const createCivilianAiSystem = (): System => {
  const brains = new Map<EntityId, { tree: BehaviourTree; agent: CivilianAgent }>();
  return {
    name: "civilian-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      for (const c of inCreationOrder(ctx.world.with("civilian", "velocity"))) {
        alive.add(c.id);
        let brain = brains.get(c.id);
        if (!brain) {
          const agent = new CivilianAgent();
          brain = { agent, tree: new BehaviourTree(CIVILIAN_TREE, agent as unknown as Agent) };
          brains.set(c.id, brain);
        }
        brain.agent.ctx = ctx;
        brain.agent.self = c;
        brain.agent.player = player;
        brain.agent.distance = player ? Math.hypot(player.position.x - c.position.x, player.position.z - c.position.z) : Infinity;
        brain.tree.step();
      }
      for (const id of [...brains.keys()]) if (!alive.has(id)) brains.delete(id);
    },
  };
};
