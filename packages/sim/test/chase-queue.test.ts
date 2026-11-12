import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { SIM_DT, Simulation, gangerEntity, ground } from "../src";
import { PLAN_WORK, advanceChasePlans, planChase } from "../src/systems/ai/chase-plan";
import { chaseDetour, wideBuilds } from "../src/systems/ai/steering";
import type { Entity, WalkProgress } from "../src/world/components";
import type { SimContext } from "../src/world/context";
import { off, pieceAt } from "./barrier-standoff";
import { teleportPlayer } from "./helpers";

/**
 * The queue of the wide ways being made (G-694). A ganger with no way at all waits standing, or
 * walks blind, until its own is ready; one with an old way walks that meanwhile. So the first
 * goes before the second, as a queue of path requests serves an agent with no path first.
 */

/** A slice runs past `PLAN_WORK` by less than two rows of the wide window (384 cells each). */
const SLICE = PLAN_WORK + 2 * 384;

/** Two gangers before the fence at (2359, 445), with no walk yet; the city round them streamed in. */
const scene = () => {
  const { chunk, item } = pieceAt(2359.33, 445.19);
  const sim = Simulation.create({ seed: 2 });
  teleportPlayer(sim, ground(2300, 432));
  sim.step();
  const at = off(item, -4);
  const [a, b] = [0, 1].map((i) => {
    const g = gangerEntity(9201 + i, { key: `g694-q${i}`, position: ground(at.x + i, at.z), yaw: 0 }, null, 200, chunk);
    sim.world.add(g);
    return g;
  }) as [Entity, Entity];
  const ctx = (tick: number) => ({ world: sim.world, tick, dt: SIM_DT }) as unknown as SimContext;
  const walk = (g: Entity, patch: Partial<WalkProgress>) => {
    g.walk = { x: g.position.x, z: g.position.z, since: 0, unstickUntil: 0, side: 1, plan: null, ...(g.walk ?? {}), ...patch };
  };
  return { sim, a, b, ctx, walk };
};

describe("the queue of the wide ways being made (G-694)", () => {
  it("puts a ganger with no way before one walking its old way, and makes both by the steps they were told", () => {
    const { sim, a, b, ctx, walk } = scene();
    const tick = sim.tick;
    // A walks an old way to a goal it left behind; its target is now behind the fence.
    walk(a, { chase: ground(2290, 470) });
    const goalA: Vec3 = ground(2352, 426);
    const goalB: Vec3 = ground(2366, 438);
    walk(a, planChase(ctx(tick), a.position, goalA, false) ?? {});
    const asked = a.walk!.chaseNext!.ready;
    walk(b, planChase(ctx(tick), b.position, goalB, true) ?? {});
    const readyB = b.walk!.chaseNext!.ready;
    const readyA = a.walk!.chaseNext!.ready;
    expect(readyB, "the roadless one first").toBeLessThanOrEqual(asked);
    expect(readyB).toBeLessThan(readyA);
    // The other one is ready later by as much as the roadless one's way takes.
    expect(readyA).toBe(asked + (readyB - tick));
    // Made a slice a step in that order: each is whole by its step, nothing left to make then.
    for (let t = tick + 1; t <= readyA; t++) {
      const before = wideBuilds(sim.world).units;
      advanceChasePlans(ctx(t));
      for (const [g, goal, ready] of [[b, b.walk!.chaseNext!.goal, readyB], [a, a.walk!.chaseNext!.goal, readyA]] as const) {
        if (t === ready) chaseDetour(sim.world, g.position, goal);
      }
      expect(wideBuilds(sim.world).units - before, `step ${t}`).toBeLessThanOrEqual(SLICE);
    }
  }, 120_000);

  it("leaves the queue as it was for a ganger with an old way, and drops its stale next way for one made", () => {
    const { sim, a, b, ctx, walk } = scene();
    const tick = sim.tick;
    walk(a, planChase(ctx(tick), a.position, ground(2352, 426), true) ?? {});
    const first = a.walk!.chaseNext!.ready;
    walk(b, { chase: ground(2290, 470) });
    walk(b, planChase(ctx(tick), b.position, ground(2366, 438), false) ?? {});
    expect(a.walk!.chaseNext!.ready).toBe(first);
    expect(b.walk!.chaseNext!.ready).toBeGreaterThan(first);
    // A made way within reach of b's goal: b takes it, and its own next way, now stale, goes.
    walk(a, { chase: ground(2290, 470), chaseNext: null });
    expect(planChase(ctx(tick), b.position, ground(2291, 471), false)).toEqual({ chase: a.walk!.chase, chaseNext: null });
  }, 120_000);
});
