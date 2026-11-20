import type { Vec3 } from "@seki/core";
import { World } from "miniplex";
import { describe, expect, it } from "vitest";
import { HANA_SPOT, STALL_KEEPERS, Simulation, WORLD_NAV, ground } from "../src";
import { type Segment, rememberedAt } from "../src/world/attach-memo";
import type { Entity } from "../src/world/components";
import { levelSearch, routeAcrossLevels } from "../src/world/nav";
import { solidIndexOf } from "../src/world/solid-index";
import { run, teleportPlayer } from "./helpers";

/**
 * Where a chase's target joins the level graph, remembered (Game Programming Patterns, "Dirty
 * Flag"): every ganger after the player asked it every step, each with a sight line to every node
 * in reach, for her standing still (Alchemia's car park, ADR-0046 20.11: half of the graph's cost).
 * The memory holds while the point is the same, no solid came or went and no kinematic solid moved
 * from or onto one of its sight lines.
 */

const target = STALL_KEEPERS.oyaji;
const from = ground(441, 66);

const world = () => {
  const sim = Simulation.create({ seed: 5 });
  teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
  run(sim, 2);
  return sim;
};

/** Queries of the solid index one way from `at` takes, its own search handed over: the target's attachment alone. */
const targetQueries = (sim: Simulation, at: Vec3 = from) => {
  const near = levelSearch(sim.world, WORLD_NAV, at)!;
  const index = solidIndexOf(sim.world);
  const before = index.stats.queries;
  const way = routeAcrossLevels(sim.world, WORLD_NAV, at, target, near);
  return { way, queries: index.stats.queries - before };
};

const box = (at: Vec3) => ({ min: { x: at.x - 0.5, y: at.y, z: at.z - 0.5 }, max: { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 } });

/** A lift's platform (kinematic: it has a velocity), its box a metre high over `at`. */
const platform = (id: number, at: Vec3): Entity => ({
  id,
  position: { ...at },
  prevPosition: { ...at },
  yaw: 0,
  prevYaw: 0,
  pitch: 0,
  velocity: { x: 0, y: 0, z: 0 },
  solid: box(at),
});

describe("where a chase's target joins the level graph, remembered (ADR-0046)", () => {
  it("casts no sight line for a target that has not moved, from wherever the walker asks", () => {
    const sim = world();
    const first = targetQueries(sim);
    expect(first.way).not.toBeNull();
    expect(first.queries).toBeGreaterThan(0);
    const again = targetQueries(sim);
    expect(again.queries).toBe(0);
    expect(again.way).toEqual(first.way);
    expect(targetQueries(sim, ground(428, 58)).queries).toBe(0);
  });

  it("asks anew once a solid came, or a kinematic one moved onto its sight lines or off them; not for one moved elsewhere", () => {
    const sim = world();
    targetQueries(sim);
    const far = { x: target.x + 2000, y: target.y, z: target.z };
    const lift = sim.world.add(platform(9401, far));
    // A solid came: the set the sight lines were cast against is another.
    expect(targetQueries(sim).queries).toBeGreaterThan(0);
    expect(targetQueries(sim).queries).toBe(0);
    lift.solid = box({ ...far, x: target.x - 2000 });
    expect(targetQueries(sim).queries).toBe(0);
    // Over the target, where every sight line starts: made again, and as a world that never remembered it makes it.
    lift.solid = box(target);
    const moved = targetQueries(sim);
    expect(moved.queries).toBeGreaterThan(0);
    const fresh = world();
    fresh.world.add(platform(9401, target));
    expect(moved.way).toEqual(targetQueries(fresh).way);
    // And off it again: its box of then was on them.
    lift.solid = box(far);
    expect(targetQueries(sim).queries).toBeGreaterThan(0);
  });
});

describe("the memory of a point's walk tests (attach-memo)", () => {
  // Two sight lines from the origin, east and north, 10 m long at knee height: the box round both is 10 by 10 m.
  const knee = { x: 0, y: 0.6, z: 0 };
  const cast: Segment[] = [
    { a: knee, b: { x: 10, y: 0.6, z: 0 } },
    { a: knee, b: { x: 0, y: 0.6, z: 10 } },
  ];
  const setup = () => {
    const w = new World<Entity>();
    const door = w.add(platform(1, { x: 50, y: 0, z: 50 }));
    let made = 0;
    const ask = (at: Vec3 = knee) =>
      rememberedAt(w, cast, at, () => {
        made++;
        return { value: made, cast };
      });
    return { w, door, ask, made: () => made };
  };

  it("keeps the answer for a kinematic solid moved within the box round its sight lines but onto none of them", () => {
    const { door, ask, made } = setup();
    ask();
    door.solid = box({ x: 6, y: 0, z: 6 });
    ask();
    door.solid = box({ x: 7, y: 0, z: 5 });
    ask();
    expect(made()).toBe(1);
    // Onto the eastern one, and off it to where it stood clear: both make it again.
    door.solid = box({ x: 5, y: 0, z: 0 });
    ask();
    expect(made()).toBe(2);
    door.solid = box({ x: 6, y: 0, z: 6 });
    ask();
    expect(made()).toBe(3);
  });

  it("makes it again for another point, a solid that came or went, and none of it is kept past the point's bit", () => {
    const { w, door, ask, made } = setup();
    ask();
    ask({ ...knee, x: 1e-12 });
    expect(made()).toBe(2);
    w.remove(door);
    ask();
    expect(made()).toBe(3);
    ask();
    expect(made()).toBe(3);
  });
});
