import { MOST_UNSTICK_STEPS, type Vec3 } from "@seki/core";
import { aboveGround, groundOf, heightApart } from "../../world/ground";
import type { SimContext } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";
import { LEVEL_GAP, firingPosition, routeAcrossLevels } from "../../world/nav";
import { type Detour, SAME_FLOOR, chaseDetour, detourStep, followDetour, cutOffNear, planDetour, straightWalk } from "./steering";
import { CHASE_DRIFT, lentChase, planChase } from "./chase-plan";
import type { Ganger } from "./ganger-perception";
import type { WalkPlan, WalkProgress } from "../../world/components";

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
/** How far ahead the walk of a ganger waiting for its wide way must be free (G-694, m). */
const FEELER = 1.5;
/** Characters this close count as obstacles in the repath of a stuck walker. */
const CROWD_RADIUS = 8;
/** The repath is for this goal; a goal that moved further than this needs the ordinary way. */
const PLAN_DRIFT = 2;
/** At its post within this (m), as `HoldPosition` has it. */
const POST_ARRIVE = 0.3;
/** A ganger with no wide way yet: it stands and waits for one. */
const WAIT = "wait";

/** Who acts this step: the blackboard rebinds it to the current entity. */
export interface GangerBinding {
  readonly ctx: SimContext | null;
  readonly self: Ganger | null;
  /** Local time scale (the player's overdrive slows gangers down). */
  readonly timeScale: number;
}

/**
 * The way round of a repath, made again from what it is made of when not at hand (a loaded game):
 * `planDetour` is a pure function of the static solids and its inputs, so it is the same way.
 */
const detours = new WeakMap<WalkPlan, Detour | null>();

const detourOf = (ctx: SimContext, plan: WalkPlan | null): Detour | null => {
  if (!plan) return null;
  let detour = detours.get(plan);
  if (detour === undefined) {
    detour = planDetour(ctx.world, plan.from, plan.goal, plan.avoid);
    detours.set(plan, detour);
  }
  return detour;
};

/**
 * The side of its first sidestep: by its id, but a reinforcement's by which of the heat's it is,
 * since a loaded game gives it another id (G-208).
 */
const firstSide = (g: Ganger): 1 | -1 => ((g.security?.n ?? g.id) % 2 === 0 ? 1 : -1);

/** The legs of one ganger: where it walks this step and whether it gets anywhere. */
export class GangerWalk {
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
   * than wait under the target's feet, and so it does on the street when no way round leads
   * there (a yard walled in, a fence longer than the wide window, G-625): pressed against the
   * fence it would only stand there. Lifts and ladders are for the player.
   */
  pursueTo(to: Vec3): void {
    const { ctx, self } = this.at;
    if (!ctx || !self) return;
    const from = self.position;
    // Its new wide way ready: in its place before anything asks for the old one (G-643).
    const next = self.walk?.chaseNext;
    if (next && ctx.tick >= next.ready) this.keep(ctx, self, { chase: next.goal, chaseNext: null });
    const gap = heightApart(ctx.world, to, from);
    const apart = gap > LEVEL_GAP;
    const raised = aboveGround(ctx.world, from) > LEVEL_GAP || aboveGround(ctx.world, to) > LEVEL_GAP;
    if (!apart) {
      // Under the street (a vault, its heights plain y) more than a floor's height apart but less
      // than a level's: the lower end of Alchemia's car park ramp beside the deck it comes down to
      // (ADR-0074 stage 4). There is no way round on this floor there: the level graph's way.
      const ground = groundOf(ctx.world);
      const vaulted = gap > SAME_FLOOR && (ground.underStreet(to) || ground.underStreet(from));
      let step = vaulted ? null : (this.wideWay(to) ?? (this.awaiting(to) ? null : this.head(to)));
      if (!step && !vaulted) {
        const chase = this.chase(to);
        // Its first wide way being made (G-643), it walks meanwhile (G-694): along another's made one
        // (`chase`), else towards the goal so long as the walk ahead is free (`seek`). It stood there
        // for as long as all the ways asked before its own took, some 13 steps a goal; walking blind
        // up to the barrier, by the bend of the flight off Zamkowa's viaduct (G-255) or pressed against
        // a thin fence, it got where neither way led it off.
        if (chase === WAIT && !self.walk?.chaseNext) {
          self.velocity = { x: 0, y: 0, z: 0 };
          return;
        }
        if (chase === WAIT) {
          if (!this.seek(to)) self.velocity = { x: 0, y: 0, z: 0 };
          return;
        }
        step = chase;
      }
      if (step || (!raised && vaulted)) {
        this.goal = to;
        this.moveTowards((step ?? to).x, (step ?? to).z);
        return;
      }
      if (!vaulted && !raised) {
        // On the street the level graph is no way round a barrier (it never was): asked by every
        // cut-off ganger every step, at its post too, its sight lines to all nodes cost more than
        // the whole rest of the step. A way straight there that only the stuck check set aside is
        // still a way; not stuck, `head` found the straight walk blocked already.
        if (this.unsticking() && straightWalk(ctx.world, from, to)) this.moveTowards(to.x, to.z);
        else this.backToPost();
        return;
      }
    }
    const route = routeAcrossLevels(ctx.world, ctx.streamer.nav, from, to);
    const shot = self.combatant?.stats?.melee || !apart ? null : firingPosition(ctx.world, ctx.streamer.nav, from, to, self.ai.attackRange);
    const way = shot && (!route || shot.cost < route.cost) ? shot : route;
    if (way && Math.hypot(way.next.x - from.x, way.next.z - from.z) < 0.05) self.velocity = { x: 0, y: 0, z: 0 };
    else if (way) this.walkTo(way.next);
    else if (apart) this.backToPost();
    else this.moveTowards(to.x, to.z);
  }

  /** Back to its post, and stops there (`HoldPosition`'s rule), not pacing round the point. */
  private backToPost(): void {
    const self = this.at.self;
    if (!self) return;
    const home = self.ai.home;
    if (Math.hypot(home.x - self.position.x, home.z - self.position.z) > POST_ARRIVE) this.walkTo(home);
    else self.velocity = { x: 0, y: 0, z: 0 };
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
    const plan = this.unsticking() ? detourOf(ctx, self.walk?.plan ?? null) : null;
    if (plan && Math.hypot(plan.goal.x - goal.x, plan.goal.z - goal.z) < PLAN_DRIFT) {
      const p = followDetour(plan, from);
      if (p) return p;
    }
    if (!this.unsticking() && straightWalk(ctx.world, from, goal)) return goal;
    return detourStep(ctx.world, from, goal);
  }

  /**
   * A chase the near window does not lead (G-625): the step along the wide way to the goal it
   * keeps (`WalkProgress.chase`, saved), planned anew when its target moved `CHASE_DRIFT` away
   * (`planChase`); along the old way until the new one is ready (`chaseNext`), or with none along
   * another's that brings it nearer (`lentChase`, G-694), or it waits. Null when the wide way does not lead there either. Only a chase: a walk home or to a node
   * keeps to the near window, which got it there so far; the wide way of a calm guard's walk home
   * in the docks ran onto the end of a pier, a step the raster takes for level ground and the legs
   * do not climb (as G-339), and it stood there for good.
   */
  private chase(goal: Vec3): Vec3 | null | typeof WAIT {
    const { ctx, self } = this.at;
    if (!ctx || !self) return null;
    const drifted = (g: Vec3 | null | undefined) => !g || Math.hypot(g.x - goal.x, g.z - goal.z) > CHASE_DRIFT;
    if (drifted(self.walk?.chase) && drifted(self.walk?.chaseNext?.goal)) {
      const patch = planChase(ctx, self.position, goal, !self.walk?.chase);
      if (patch) this.keep(ctx, self, patch);
    }
    const way = self.walk?.chase ?? null;
    if (!way) {
      // Its own being made (G-694): meanwhile along another's made way that brings it nearer.
      const lent = lentChase(ctx, self.position, goal);
      const detour = lent ? chaseDetour(ctx.world, self.position, lent) : null;
      return (detour && followDetour(detour, self.position)) ?? WAIT;
    }
    const detour = chaseDetour(ctx.world, self.position, way);
    return detour ? followDetour(detour, self.position) : null;
  }

  private keep(ctx: SimContext, self: Ganger, patch: Pick<WalkProgress, "chase" | "chaseNext">): void {
    const { x, z } = self.position;
    self.walk = { ...(self.walk ?? { x, z, since: ctx.tick, unstickUntil: 0, side: firstSide(self), plan: null }), ...patch };
  }

  /**
   * The step along the wide way of the chase it keeps, while `goal` is cut off from it in the
   * near window by that way (`cutOffNear`, G-644): there the near window does not lead either, and
   * asked every step by a dozen gangers after a dozen goals it made its rasters again every step.
   * Null for `head` to decide: no such way, a free straight walk, getting unstuck, a goal come to
   * its side of the barrier, or the way's end in the window.
   */
  private wideWay(goal: Vec3): Vec3 | null {
    const { ctx, self } = this.at;
    const held = self?.walk?.chase;
    if (!ctx || !self || !held || this.unsticking() || Math.hypot(held.x - goal.x, held.z - goal.z) > CHASE_DRIFT) return null;
    const detour = chaseDetour(ctx.world, self.position, held);
    if (!detour || !cutOffNear(detour, self.position, goal) || straightWalk(ctx.world, self.position, goal)) return null;
    return followDetour(detour, self.position);
  }

  /**
   * Is the wide way to about `goal` being made for it, with the straight walk blocked (G-643)? It
   * waits for it on the way it has, or standing, without asking the near window, which found the
   * goal cut off when it asked for it: a dozen of them after a dozen goals, asking it every step
   * while they wait, pushed its rasters out of the memo (G-644). With no way yet, getting unstuck
   * too, it walks as `chase` has it: on the sidestep it took for those steps, by the bend of the
   * flight off Zamkowa's viaduct (G-255), it pressed itself into a corner that neither way leads out of.
   */
  private awaiting(goal: Vec3): boolean {
    const { ctx, self } = this.at;
    const next = self?.walk?.chaseNext;
    if (!ctx || !self || !next || next.ready <= ctx.tick || (this.unsticking() && self.walk?.chase)) return false;
    return Math.hypot(next.goal.x - goal.x, next.goal.z - goal.z) <= CHASE_DRIFT && !straightWalk(ctx.world, self.position, goal);
  }

  /**
   * With no way yet to walk while its own is made (G-694): towards `goal`, leaning to its side as
   * when it gets unstuck, or to the other, so long as the straight walk `FEELER` ahead is free. Not
   * up to the barrier: pressed against a thin fence the near window takes a cell behind it for its
   * own, and neither way led it off there. False, standing, with both sides blocked.
   */
  private seek(goal: Vec3): boolean {
    const { ctx, self } = this.at;
    if (!ctx || !self) return false;
    const from = self.position;
    const d = Math.hypot(goal.x - from.x, goal.z - from.z);
    if (d < 1e-6) return false;
    const [dx, dz] = [(goal.x - from.x) / d, (goal.z - from.z) / d];
    const side = self.walk?.side ?? firstSide(self);
    for (const s of [side, -side]) {
      const [x, z] = [dx - dz * s * SIDESTEP, dz + dx * s * SIDESTEP];
      const k = FEELER / Math.hypot(x, z);
      const ahead = { x: from.x + x * k, y: from.y, z: from.z + z * k };
      if (!straightWalk(ctx.world, from, ahead)) continue;
      this.goal = goal;
      this.moveTowards(ahead.x, ahead.z, false);
      return true;
    }
    return false;
  }

  private unsticking(): boolean {
    const { ctx, self } = this.at;
    const progress = self?.walk;
    return !!ctx && !!progress && ctx.tick < progress.unstickUntil;
  }

  private moveTowards(x: number, z: number, sidestep = true): void {
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
    const p = self.walk;
    if (sidestep && p && !p.plan && this.unsticking()) {
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
    const p = self.walk;
    if (!this.walking || !p) {
      self.walk = { x, z, since: ctx.tick, unstickUntil: p?.unstickUntil ?? 0, side: p?.side ?? firstSide(self), plan: p?.plan ?? null, chase: p?.chase ?? null, chaseNext: p?.chaseNext ?? null };
      return;
    }
    if (Math.hypot(x - p.x, z - p.z) >= STUCK_DISTANCE) {
      p.x = x;
      p.z = z;
      p.since = ctx.tick;
      return;
    }
    if ((ctx.tick - p.since) * ctx.dt * timeScale < STUCK_TIME || ctx.tick < p.unstickUntil) return;
    // Capped so that a save holds it (G-208): far past the slowest time an NPC walks in.
    p.unstickUntil = ctx.tick + Math.min(Math.ceil(UNSTICK_TIME / (ctx.dt * Math.max(timeScale, 1e-3))), MOST_UNSTICK_STEPS);
    p.side = p.side === 1 ? -1 : 1;
    p.since = ctx.tick;
    const crowd: Vec3[] = [];
    for (const e of inCreationOrder(ctx.world.with("body"))) {
      if (e === self || e.player || e.passerby || Math.hypot(e.position.x - x, e.position.z - z) > CROWD_RADIUS) continue;
      crowd.push({ ...e.position });
    }
    const plan = this.goal ? { from: { ...self.position }, goal: { ...this.goal }, avoid: crowd } : null;
    const detour = plan ? planDetour(ctx.world, plan.from, plan.goal, plan.avoid) : null;
    // Only a repath that leads somewhere is kept: without one it leans to the side instead.
    p.plan = detour ? plan : null;
    if (plan && detour) detours.set(plan, detour);
  }
}
