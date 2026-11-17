import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { SIM_HZ, Simulation, w3 } from "../src";
import { FAR, FLEE_WINDOW, grow, memoOf } from "../src/systems/ai/nav-field";
import { followDetour, planDetour } from "../src/systems/ai/steering";
import { teleportPlayer } from "./helpers";

/**
 * The fields of the runners' window grown only as far as they ask (G-928): a runner's goal 6 m
 * ahead moves with it, and a field of the whole window for each half metre it ran was most of a
 * fight's step. On W-3's hall floor, among the line's racks and stations: the same point to run
 * to as the whole field gives, from every side of a goal and in any order of asking, at a part of
 * the work.
 */

/** Goals along the hall's aisle and by the line. */
const GOALS = [w3(2519, 0, 421.8), w3(2530, 0, 423), w3(2537, 0, 414.2), w3(2545, 0, 421.5), w3(2512, 0, 425)];
/** Where runners ask from round a goal, `r` metres off, every 30°. */
const around = (g: Vec3, r: number): Vec3[] => Array.from({ length: 12 }, (_, i) => ({ x: g.x + r * Math.sin((i * Math.PI) / 6), y: g.y, z: g.z + r * Math.cos((i * Math.PI) / 6) }));

describe("the runners' fields, grown as far as asked (G-928)", () => {
  it("lead every runner round the hall's racks where the whole field does, at a part of its work", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, w3(2530, 0, 420), 0);
    for (let i = 0; i < SIM_HZ; i++) sim.step();
    const built = memoOf(sim.world, FLEE_WINDOW).built;
    // The goals' rasters made first, for the middles of their windows: what is counted after is the goals' fields alone.
    const { snap } = FLEE_WINDOW;
    for (const g of GOALS) planDetour(sim.world, g, { ...g, x: Math.round(g.x / snap) * snap, z: Math.round(g.z / snap) * snap }, [], FLEE_WINDOW);
    const rasters = built.rasters;
    const reached = new Map<object, number>();
    let led = 0;
    const ask = (goal: Vec3, from: Vec3) => {
      const lazy = planDetour(sim.world, from, goal, [], FLEE_WINDOW);
      const way = lazy && followDetour(lazy, from);
      const whole = lazy && { goal, field: grow(lazy.field.raster, lazy.field.source) };
      expect(way, `from ${from.x.toFixed(1)}, ${from.z.toFixed(1)} to ${goal.x}, ${goal.z}`).toEqual(whole && followDetour(whole, from));
      if (way) led++;
      if (whole) reached.set(lazy.field, whole.field.dist.filter((d) => d < FAR).length);
    };
    // First as the runners ask, 6 m ahead (`FLEE_LOOKAHEAD`): the work is that of these fields alone.
    const start = built.units;
    for (const goal of GOALS) for (const from of around(goal, 6)) ask(goal, from);
    const runners = built.units - start;
    const whole = [...reached.values()].reduce((a, b) => a + b, 0);
    // Then nearer, farther and back again: a field grown farther stays right for the nearer ones.
    for (const goal of GOALS) for (const from of [...around(goal, 3), ...around(goal, 9), ...around(goal, 3).reverse(), ...around(goal, 6).reverse()]) ask(goal, from);
    expect(built.rasters).toBe(rasters);
    expect(reached.size).toBe(GOALS.length);
    expect(led).toBeGreaterThan(GOALS.length * 12 * 2);
    // The whole fields reach 17,825 cells, every one they can: the runners asked for some half of them.
    expect(runners).toBeLessThan((2 / 3) * whole);
  });
});
