import { MOST_PLAN_STEPS, type Vec3 } from "@seki/core";
import type { SimContext } from "../../world/context";
import type { WalkProgress } from "../../world/components";
import { inCreationOrder } from "../../world/ordering";
import { advanceChaseDetours, chaseWork, sameWideWindow, startChaseDetour } from "./steering";

/*
 * When a chase's new wide way round a long barrier is ready (G-625, G-643). Whole, a wide raster
 * and its field cost 50 to 100 ms, against a step's 4 (ADR-0043), and a few chases starting at
 * once paid for theirs in a step or two. Now each wide way is made a slice a step, in the order
 * they were asked for, and is ready at a step known when it is asked for: once the ways asked for
 * before it are, and the work it takes, in cells, over what a step spends. A pure function of the
 * static solids and of what a save holds (the steps the ways being made are ready at), so a step
 * waits as long on every machine and in a loaded game; what the memo holds only decides how soon
 * the slices are done.
 */

/** A chase keeps the goal of its wide way (G-625) until its target is further than this from it (m). */
export const CHASE_DRIFT = 8;

/**
 * The units of work (cells gone through) a step spends on making the wide ways of the chases: a
 * slice of twelve thousand some 1.5 to 3 ms, so that a raster and its field (some 440 000 cells)
 * are ready in some 38 steps, a field in a raster made already in some 13.
 */
export const PLAN_WORK = 12_000;

const gangersOf = (ctx: SimContext) => inCreationOrder(ctx.world.with("ai"));

/** Goes on making the wide ways of the chases this step, before the gangers ask for them; not those no ganger waits for. */
export const advanceChasePlans = (ctx: SimContext): void => {
  const wanted = new Set<Vec3>();
  for (const e of ctx.world.with("ai")) if (e.walk?.chaseNext) wanted.add(e.walk.chaseNext.goal);
  advanceChaseDetours(ctx.world, PLAN_WORK, (goal) => wanted.has(goal));
};

type ChasePatch = Pick<WalkProgress, "chase" | "chaseNext">;

const fits = (g: Vec3 | null | undefined, goal: Vec3): g is Vec3 => !!g && sameWideWindow(g, goal) && Math.hypot(g.x - goal.x, g.z - goal.z) <= CHASE_DRIFT;

/**
 * A new wide way for a ganger at `from` after `goal`. Another ganger's to a goal within
 * `CHASE_DRIFT` of it in its window, made or being made, the first in creation order: a dozen
 * gangers after the player share one and none waits for its own. Else one started now; at once
 * with nothing to make (the ganger outside its window). Null when it would be ready more than
 * `MOST_PLAN_STEPS` from now: it asks again the next step.
 */
export const planChase = (ctx: SimContext, from: Vec3, goal: Vec3): ChasePatch | null => {
  const walks = gangersOf(ctx).map((e) => e.walk);
  const made = walks.find((w) => fits(w?.chase, goal))?.chase;
  if (made) return { chase: made };
  const next = walks.find((w) => fits(w?.chaseNext?.goal, goal))?.chaseNext;
  if (next) return { chaseNext: next };
  const held = { x: goal.x, y: goal.y, z: goal.z };
  // Its window's raster made already, or being made first, for another chase in it: only the field is left.
  const raster = !walks.some((w) => [w?.chase, w?.chaseNext?.goal].some((g) => !!g && sameWideWindow(g, goal)));
  const work = chaseWork(ctx.world, from, held, raster);
  if (work === 0) return { chase: held, chaseNext: null };
  const queue = Math.max(ctx.tick, ...walks.map((w) => w?.chaseNext?.ready ?? 0));
  const ready = queue + Math.ceil(work / PLAN_WORK);
  if (ready - ctx.tick > MOST_PLAN_STEPS) return null;
  startChaseDetour(ctx.world, from, held);
  return { chaseNext: { goal: held, ready } };
};
