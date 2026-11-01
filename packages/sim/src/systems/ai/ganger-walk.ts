import type { Vec3 } from "@seki/core";
import { aboveGround, heightApart } from "../../world/ground";
import type { SimContext } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";
import { WORLD_NAV } from "../../content/world-map";
import { LEVEL_GAP, firingPosition, routeAcrossLevels } from "../../world/nav";
import { type Detour, SAME_FLOOR, detourStep, followDetour, planDetour, straightWalk } from "./steering";
import type { Ganger } from "./ganger-perception";

/*
 * How a ganger gets somewhere (ADR-0021, ADR-0025): straight or round the obstacle on its floor,
 * up the stairs to another level, and the stuck check that sends it the way around.
 */

export const GANGER_SPEED = 3.1;
/** A ganger with a melee weapon runs at whoever it fights to close the distance (ADR-0019). */
export const MELEE_CHASE_SPEED = 3.9;
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
/** Characters this close count as obstacles in the repath of a stuck walker. */
const CROWD_RADIUS = 8;
/** The repath is for this goal; a goal that moved further than this needs the ordinary way. */
const PLAN_DRIFT = 2;

/** Who acts this step: the blackboard rebinds it to the current entity. */
export interface GangerBinding {
  readonly ctx: SimContext | null;
  readonly self: Ganger | null;
  /** Local time scale (the player's overdrive slows gangers down). */
  readonly timeScale: number;
}

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

/** The legs of one ganger: where it walks this step and whether it gets anywhere. */
export class GangerWalk {
  progress: Progress | null = null;
  /** Set by every walk this step; read by the stuck check after the tree has run. */
  walking = false;
  /** Where the last walk this step was headed. */
  goal: Vec3 | null = null;

  constructor(private readonly at: GangerBinding) {}

  /**
   * Goes after a target (ADR-0021, ADR-0025). On the same floor it walks straight at it when
   * the knee-high line is free, and around the obstacle (the floor's distance field) when it
   * is not. With the target on another level, or on the same level but not reachable on this
   * floor, it takes the stairs through the district's transition graph; a gunner instead heads
   * for the nearest point that gives it a shot, when that is closer than the way up. With
   * neither (a roof reached by a ladder, seen from nowhere) it goes back to its post rather
   * than wait under the target's feet. Lifts and ladders are for the player.
   */
  pursueTo(to: Vec3): void {
    const { ctx, self } = this.at;
    if (!ctx || !self) return;
    const from = self.position;
    const apart = heightApart(ctx.world, to, from) > LEVEL_GAP;
    const raised = aboveGround(ctx.world, from) > LEVEL_GAP || aboveGround(ctx.world, to) > LEVEL_GAP;
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
  walkTo(goal: Vec3): void {
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
    const { ctx, self } = this.at;
    if (!ctx || !self) return null;
    const from = self.position;
    if (heightApart(ctx.world, goal, from) > SAME_FLOOR) return goal;
    const plan = this.progress?.plan;
    if (this.unsticking() && plan && Math.hypot(plan.goal.x - goal.x, plan.goal.z - goal.z) < PLAN_DRIFT) {
      const p = followDetour(plan, from);
      if (p) return p;
    }
    if (!this.unsticking() && straightWalk(ctx.world, from, goal)) return goal;
    return detourStep(ctx.world, from, goal);
  }

  private unsticking(): boolean {
    const { ctx } = this.at;
    const progress = this.progress;
    return !!ctx && !!progress && ctx.tick < progress.unstickUntil;
  }

  private moveTowards(x: number, z: number): void {
    const self = this.at.self;
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
    const { ctx, self, timeScale } = this.at;
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
    if ((ctx.tick - p.since) * ctx.dt * timeScale < STUCK_TIME || ctx.tick < p.unstickUntil) return;
    p.unstickUntil = ctx.tick + Math.ceil(UNSTICK_TIME / (ctx.dt * Math.max(timeScale, 1e-3)));
    p.side = p.side === 1 ? -1 : 1;
    p.since = ctx.tick;
    const crowd: Vec3[] = [];
    for (const e of inCreationOrder(ctx.world.with("body"))) {
      if (e === self || e.player || e.passerby || Math.hypot(e.position.x - x, e.position.z - z) > CROWD_RADIUS) continue;
      crowd.push(e.position);
    }
    p.plan = this.goal ? planDetour(ctx.world, self.position, this.goal, crowd) : null;
  }
}
