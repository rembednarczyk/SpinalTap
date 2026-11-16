import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../../world/components";
import { groundOf, heightApart } from "../../world/ground";
import { collidersOf } from "../../world/solids";
import { STEP_HEIGHT } from "../movement-system";
import { type Detour, type Field, WIDE_WINDOW, fieldFor, fieldSteps, memoOf, outsideWindow, windowAt } from "./nav-field";
import { type Slices, finish, rasterWork } from "./nav-raster";
import { SAME_FLOOR, deckReach, floorOf } from "./straight-walk";

/** The wide ways of the chases (G-625, G-643): planned in `WIDE_WINDOW`, made a slice a step. */

/** The wide ways of the chases, kept with their goals: by the floor and the decks' reach they were made for. */
const chases = new WeakMap<Vec3, { readonly key: string; readonly detour: Detour | null }>();

/** The floor and the decks' reach of a walker at `from` after `goal`: what its wide way is kept by. */
const chaseKey = (world: World<Entity>, from: Vec3, goal: Vec3) => {
  const ground = groundOf(world);
  const floor = floorOf(from.y, ground.heightAt(from.x, from.z, from.y + STEP_HEIGHT));
  const reach = deckReach(ground, from, goal);
  return { floor, reach, key: `${floor}|${reach}` };
};

/** A wide way being made a slice a step (G-643), for its goal and key. */
interface WideJob {
  readonly goal: Vec3;
  readonly key: string;
  readonly steps: Slices<Field | null>;
}

/** The wide ways started in a world and not made yet, in the order they were started. */
const jobs = new WeakMap<World<Entity>, WideJob[]>();

const keep = (goal: Vec3, key: string, field: Field | null): Detour | null => {
  const detour = field ? { goal, field } : null;
  chases.set(goal, { key, detour });
  return detour;
};

/**
 * The way round to the goal of a chase in `WIDE_WINDOW` (G-625), or null when it has none from
 * this floor. Kept with the goal object itself, not only in the memo: a ganger holds its goal
 * (`WalkProgress.chase`) for many steps, and a few of them round a corner of the window grid
 * would otherwise push each other's rasters out of the memo and make them again every step. A
 * pure function of the static solids, the floor and the goal, as `planDetour`; one started by
 * `startChaseDetour` and not made yet is finished now.
 */
export const chaseDetour = (world: World<Entity>, from: Vec3, goal: Vec3): Detour | null => {
  if (heightApart(world, goal, from) > SAME_FLOOR || outsideWindow(WIDE_WINDOW, from, goal)) return null;
  const { floor, reach, key } = chaseKey(world, from, goal);
  const held = chases.get(goal);
  if (held?.key === key) return held.detour;
  const started = jobs.get(world) ?? [];
  const i = started.findIndex((j) => j.goal === goal && j.key === key);
  const job = started[i];
  if (job) {
    started.splice(i, 1);
    return keep(goal, key, finish(job.steps, memoOf(world, WIDE_WINDOW).built));
  }
  return keep(goal, key, fieldFor(world, WIDE_WINDOW, floor, reach, goal));
};

/**
 * At most how many units of work the wide way of a chase to `goal` for a walker at `from` takes
 * (G-643): its field's, and with `raster` its raster's; 0 when it has nothing to make
 * (`chaseDetour` null at no cost). A pure function of the static solids, the floor and the goal,
 * whatever the memo holds.
 */
export const chaseWork = (world: World<Entity>, from: Vec3, goal: Vec3, raster: boolean): number => {
  if (heightApart(world, goal, from) > SAME_FLOOR || outsideWindow(WIDE_WINDOW, from, goal)) return 0;
  const { cells } = WIDE_WINDOW;
  if (!raster) return cells * cells;
  const at = windowAt(world, WIDE_WINDOW, goal);
  return rasterWork(collidersOf(at.solids), chaseKey(world, from, goal).floor, at.x0, at.z0, groundOf(world), cells) + cells * cells;
};

/**
 * Starts making the wide way of a chase to `goal` for a walker at `from` (G-643), which
 * `advanceChaseDetours` goes on with a slice a step; `chaseDetour` asked for it before it is made
 * makes the rest at once. Before the first started one that `before` holds for (G-694), else last.
 */
export const startChaseDetour = (world: World<Entity>, from: Vec3, goal: Vec3, before: (goal: Vec3) => boolean = () => false): void => {
  const { floor, reach, key } = chaseKey(world, from, goal);
  let started = jobs.get(world);
  if (!started) jobs.set(world, (started = []));
  const at = started.findIndex((j) => before(j.goal));
  started.splice(at < 0 ? started.length : at, 0, { goal, key, steps: fieldSteps(world, WIDE_WINDOW, floor, reach, goal) });
};

/** Would walkers at `a` and at `b` after `goal` share its wide way (the floor and the decks' reach it is kept by)? */
export const sameChaseKey = (world: World<Entity>, a: Vec3, b: Vec3, goal: Vec3): boolean => chaseKey(world, a, goal).key === chaseKey(world, b, goal).key;

/**
 * Makes up to about `budget` units of the wide ways started (G-643), the first started first, two
 * rows past it at most; those no walker waits for any more (`wanted` false) are dropped.
 */
export const advanceChaseDetours = (world: World<Entity>, budget: number, wanted: (goal: Vec3) => boolean): void => {
  const started = jobs.get(world);
  const built = memoOf(world, WIDE_WINDOW).built;
  let spent = 0;
  while (started && started.length > 0 && spent < budget) {
    const job = started[0] as WideJob;
    const s = wanted(job.goal) ? job.steps.next() : null;
    if (!s || s.done) {
      started.shift();
      if (s) keep(job.goal, job.key, s.value);
    } else {
      spent += s.value;
      built.units += s.value;
    }
  }
};

/** Do two goals share the window of their wide ways (one raster)? */
export const sameWideWindow = (a: Vec3, b: Vec3): boolean => {
  const { snap } = WIDE_WINDOW;
  return Math.round(a.x / snap) === Math.round(b.x / snap) && Math.round(a.z / snap) === Math.round(b.z / snap);
};
