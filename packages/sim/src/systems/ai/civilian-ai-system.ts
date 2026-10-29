import { BehaviourTree, State } from "mistreevous";
import { type CrowdState, type EntityId, type Vec3, factionStance } from "@seki/core";
import type { CrowdMind, Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";
import { followSchedule } from "../../world/schedule";
import { worldTimeScale } from "../ability-system";
import { CIVILIAN_TREE } from "./civilian-tree";
import { walkRoutine } from "./passerby-walk";
import { steerPoint, straightWalk } from "./steering";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];

/** Civilians run from a feared player closer than this (metres). */
export const FLEE_RADIUS = 7;
export const CIVILIAN_FLEE_SPEED = 3.4;
const CIVILIAN_WALK_SPEED = 1.4;
/** Fastest a civilian hurries to catch up with its daily plan (after fleeing, say). */
const CIVILIAN_SCHEDULE_SPEED = 1.6;
const HOME_TOLERANCE = 0.3;

/**
 * The crowd (ADR-0029). A shot this close makes a bystander cower for `COWER_SECONDS`, then run;
 * running lasts `FLEE_SECONDS` (refreshed by every new scare), watching (`alarmed`)
 * `ALARMED_SECONDS`. Then it calms down and goes back to its plan.
 */
export const COWER_RADIUS = 6;
export const COWER_SECONDS = 4;
export const FLEE_SECONDS = 8;
export const ALARMED_SECONDS = 5;
/** The running bystander heads for a point this far ahead, away from the danger, round obstacles. */
const FLEE_LOOKAHEAD = 6;
/** Turns tried, in order, when the way straight away is blocked; the probe is this long. */
const FLEE_TURNS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
const FLEE_PROBE = 2.5;

const FEAR: Readonly<Record<CrowdState, number>> = { calm: 0, alarmed: 1, fleeing: 2, cowering: 3 };

const STATE_SECONDS: Readonly<Record<CrowdState, number>> = { calm: 0, alarmed: ALARMED_SECONDS, fleeing: FLEE_SECONDS, cowering: COWER_SECONDS };

const mindOf = (c: Entity & { civilian: NonNullable<Entity["civilian"]> }): CrowdMind =>
  (c.civilian.crowd ??= { state: "calm", timer: 0, from: c.position, call: null, scared: 0 });

/**
 * Scares a bystander (ADR-0029): it moves to `state` unless it is already more afraid, and the
 * timer starts over. CrowdReacted goes out when the state changes.
 */
export const scare = (ctx: SimContext, c: Entity, state: CrowdState, from: Vec3): void => {
  if (!c.civilian) return;
  const mind = mindOf(c as Entity & { civilian: NonNullable<Entity["civilian"]> });
  if (FEAR[state] < FEAR[mind.state]) return;
  mind.from = { x: from.x, y: from.y, z: from.z };
  mind.timer = STATE_SECONDS[state];
  if (mind.state === state) return;
  mind.state = state;
  ctx.bus.emit("CrowdReacted", { entityId: c.id, state });
};

type Civilian = Entity & { civilian: NonNullable<Entity["civilian"]>; velocity: NonNullable<Entity["velocity"]> };

const hasRoutine = (c: Civilian): c is Civilian & { passerby: NonNullable<Entity["passerby"]> } => c.passerby !== undefined;

class CivilianAgent {
  ctx: SimContext | null = null;
  self: Civilian | null = null;
  player: Entity | null = null;
  distance = Infinity;
  /** Presentation memory only: one "flee" cue per escape, never read back into the state. */
  fleeing = false;

  private crowd = (): CrowdState => this.self?.civilian.crowd?.state ?? "calm";
  IsCowering = (): boolean => this.crowd() === "cowering";
  IsFleeing = (): boolean => this.crowd() === "fleeing";
  IsAlarmed = (): boolean => this.crowd() === "alarmed";

  FearsPlayer = (): boolean => !!this.ctx && !!this.self && factionStance(this.ctx.state.domain.reputation, this.self.faction ?? "civilians") === "hostile";
  PlayerNearby = (): boolean => this.player !== null && this.distance <= FLEE_RADIUS;

  /** Down on the ground, hands over the head: it stays where it is. */
  Cower = (): State => {
    if (!this.self) return State.FAILED;
    this.self.velocity = { x: 0, y: 0, z: 0 };
    return State.SUCCEEDED;
  };

  /** Runs away from what scared it, around whatever is in the way. */
  FleeFromDanger = (): State => {
    const { ctx, self } = this;
    const from = self?.civilian.crowd?.from;
    if (!ctx || !self || !from) return State.FAILED;
    this.runFrom(ctx, self, from, this.player?.yaw ?? 0);
    return State.SUCCEEDED;
  };

  /** Stops and looks at the commotion. */
  WatchDanger = (): State => {
    const from = this.self?.civilian.crowd?.from;
    if (!this.self || !from) return State.FAILED;
    this.self.velocity = { x: 0, y: 0, z: 0 };
    this.self.yaw = Math.atan2(from.x - this.self.position.x, from.z - this.self.position.z);
    return State.SUCCEEDED;
  };

  FleeFromPlayer = (): State => {
    const { ctx, self, player } = this;
    if (!ctx || !self || !player) return State.FAILED;
    this.runFrom(ctx, self, player.position, player.yaw);
    if (!this.fleeing) {
      this.fleeing = true;
      ctx.bus.emit("NpcReacted", { entityId: self.id, faction: self.faction ?? "civilians", reaction: "flee" });
    }
    return State.SUCCEEDED;
  };

  private runFrom(ctx: SimContext, self: Civilian, from: Vec3, fallbackYaw: number): void {
    const dx = self.position.x - from.x;
    const dz = self.position.z - from.z;
    const d = Math.hypot(dx, dz);
    // Standing exactly on top of it: run along the street, away from the player's facing.
    const away = d < 1e-6 ? fallbackYaw : Math.atan2(dx, dz);
    // Straight away when the way is open, else the open way closest to it (a wall at its back).
    let ux = Math.sin(away);
    let uz = Math.cos(away);
    for (const turn of FLEE_TURNS) {
      const tx = Math.sin(away + turn);
      const tz = Math.cos(away + turn);
      const probe = { x: self.position.x + tx * FLEE_PROBE, y: self.position.y, z: self.position.z + tz * FLEE_PROBE };
      if (straightWalk(ctx.world, self.position, probe)) {
        ux = tx;
        uz = tz;
        break;
      }
    }
    const ahead = { x: self.position.x + ux * FLEE_LOOKAHEAD, y: self.position.y, z: self.position.z + uz * FLEE_LOOKAHEAD };
    const p = steerPoint(ctx.world, self.position, ahead);
    const sx = p.x - self.position.x;
    const sz = p.z - self.position.z;
    const s = Math.hypot(sx, sz);
    const [vx, vz] = s < 1e-6 ? [ux, uz] : [sx / s, sz / s];
    self.velocity = { x: vx * CIVILIAN_FLEE_SPEED, y: 0, z: vz * CIVILIAN_FLEE_SPEED };
    self.yaw = Math.atan2(vx, vz);
  }

  /** Back to the spot: wherever the daily plan says right now, or the fixed home without one. */
  ReturnHome = (): State => {
    const { self, ctx } = this;
    if (!self) return State.FAILED;
    this.fleeing = false;
    // A background passer-by goes on with its routine (ADR-0040).
    if (ctx && hasRoutine(self)) {
      walkRoutine(ctx, self, ctx.dt);
      return State.SUCCEEDED;
    }
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

/** One step of a bystander's fear: cowering turns into running, running and watching into calm. */
const calmDown = (ctx: SimContext, c: Civilian, dt: number): void => {
  const mind = c.civilian.crowd;
  if (!mind) return;
  mind.scared = Math.max(0, mind.scared - dt);
  if (mind.state === "calm") return;
  mind.timer -= dt;
  if (mind.timer > 0) return;
  const next: CrowdState = mind.state === "cowering" ? "fleeing" : "calm";
  mind.state = next;
  mind.timer = STATE_SECONDS[next];
  ctx.bus.emit("CrowdReacted", { entityId: c.id, state: next });
};

/**
 * Bystanders react to the street (ADR-0029) and to its opinion of the player: scared by a
 * disturbance they cower, run or watch, and calm down after a while; when the civilians'
 * stance is hostile they keep their distance from the player; otherwise they stay at (or walk
 * back to) their spot or follow their daily plan. Uses no randomness, so it cannot shift the
 * RNG stream of the combat systems.
 */
export const createCivilianAiSystem = (): System => {
  const brains = new Map<EntityId, { tree: BehaviourTree; agent: CivilianAgent }>();
  return {
    name: "civilian-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      const dt = ctx.dt * worldTimeScale(ctx);
      for (const c of inCreationOrder(ctx.world.with("civilian", "velocity"))) {
        alive.add(c.id);
        let brain = brains.get(c.id);
        if (!brain) {
          const agent = new CivilianAgent();
          brain = { agent, tree: new BehaviourTree(CIVILIAN_TREE, agent as unknown as Agent) };
          brains.set(c.id, brain);
        }
        calmDown(ctx, c, dt);
        brain.agent.ctx = ctx;
        brain.agent.self = c;
        brain.agent.player = player;
        brain.agent.distance = player ? Math.hypot(player.position.x - c.position.x, player.position.z - c.position.z) : Infinity;
        brain.tree.step();
        if ((c.hackFx?.crippled ?? 0) > 0) c.velocity = { x: 0, y: 0, z: 0 };
      }
      for (const id of [...brains.keys()]) if (!alive.has(id)) brains.delete(id);
    },
  };
};
