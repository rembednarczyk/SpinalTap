import { describe, expect, it } from "vitest";
import type { EnemyTypeId, Vec3 } from "@seki/core";
import { MARKET_PLACE, type NavGraph, OVERPASS_TOP, ROOF_WEST_TOP, Simulation, WORLD_NAV, gangerEntity, market } from "../src";
import { firingPosition, routeAcrossLevels } from "../src/world/nav";
import { collect, run, teleportPlayer } from "./helpers";

/** The market keeps its own coordinates, moved by `MARKET_PLACE` (ADR-0045): every point here is one of it. */
const M = MARKET_PLACE;

/** The player stands still at `p`; every other ganger is gone. */
const scene = (p: Vec3): Simulation => {
  const sim = Simulation.create({ seed: 5 });
  teleportPlayer(sim, p);
  run(sim, 2);
  teleportPlayer(sim, p);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

let nextId = 9000;
const spawn = (sim: Simulation, at: Vec3, type: EnemyTypeId, home: Vec3 = at) => {
  const g = gangerEntity(nextId++, { key: `nav-${nextId}`, position: home, yaw: 0 }, null, 400, sim.streamer.chunkIdAt(at), undefined, type);
  g.position = at;
  g.prevPosition = at;
  g.ai!.alerted = true;
  sim.world.add(g);
  return g;
};

/** Keeps the player alive and in place: the test is about where the ganger goes. */
const hold = (sim: Simulation, p: Vec3, steps: number, each?: () => boolean) => {
  for (let i = 0; i < steps; i++) {
    const me = sim.player()!;
    me.health = { ...me.health!, current: me.health!.max };
    sim.step();
    if (each?.()) return i;
  }
  return steps;
};

const lift = (sim: Simulation) => sim.world.with("elevator", "solid").entities.find((e) => e.elevator.key === "targ-lift")!;

describe("NPC navigation between levels (ADR-0021)", () => {
  it("a brawler chases the player up the market stairs onto the overpass", () => {
    const target = market(100, OVERPASS_TOP, 92);
    const sim = scene(target);
    const g = spawn(sim, market(96, 0, 80), "hebi_brawler");
    let maxY = -Infinity;
    hold(sim, target, 60 * 40, () => {
      maxY = Math.max(maxY, g.position.y - M.y);
      return Math.hypot(g.position.x - target.x, g.position.z - target.z) < 2 && g.position.y - M.y > OVERPASS_TOP - 0.1;
    });
    expect(maxY).toBeCloseTo(OVERPASS_TOP, 3);
    expect(Math.hypot(g.position.x - target.x, g.position.z - target.z)).toBeLessThan(2.5);
  });

  it("takes the stairs, not the lift, even standing right by the lift", () => {
    const target = market(108, OVERPASS_TOP, 90);
    const sim = scene(target);
    const g = spawn(sim, market(108, 0, 82.5), "hebi_brawler");
    const reached = hold(sim, target, 60 * 45, () => g.position.y - M.y > OVERPASS_TOP - 0.1 && Math.hypot(g.position.x - target.x, g.position.z - target.z) < 2.5);
    expect(reached).toBeLessThan(60 * 45);
    expect(lift(sim).elevator.target).toBe(0);
    expect(lift(sim).solid.max.y - M.y).toBeCloseTo(0.15, 5);
  });

  it("a gunner finds a firing position for a player on a roof instead of standing under it", () => {
    const target = market(74, ROOF_WEST_TOP, 63.4);
    const sim = scene(target);
    const g = spawn(sim, market(90, 0, 82), "hebi_ganger");
    const shots = collect<{ shooterId: number }>(sim, "ShotFired");
    hold(sim, target, 60 * 8, () => shots.some((s) => s.shooterId === g.id));
    expect(shots.some((s) => s.shooterId === g.id)).toBe(true);
    // It shoots from the market floor, out in the open, not from under the roof edge.
    expect(g.position.z - M.z).toBeGreaterThan(70);
  });

  it("a brawler with no way up goes back to its post", () => {
    const target = market(74, ROOF_WEST_TOP, 61);
    const sim = scene(target);
    const home = market(92, 0, 80);
    const g = spawn(sim, market(74, 0, 66), "hebi_brawler", home);
    hold(sim, target, 60 * 8);
    expect(Math.hypot(g.position.x - home.x, g.position.z - home.z)).toBeLessThan(1);
  });

  it("routes are pure: no graph, no route; the same query gives the same answer", () => {
    const sim = scene(market(100, OVERPASS_TOP, 92));
    const empty: NavGraph = { nodes: [], edges: [] };
    expect(routeAcrossLevels(sim.world, empty, market(96, 0, 80), market(100, OVERPASS_TOP, 92))).toBeNull();
    expect(firingPosition(sim.world, empty, market(96, 0, 80), market(100, OVERPASS_TOP, 92), 15)).toBeNull();
    const a = routeAcrossLevels(sim.world, WORLD_NAV, market(96, 0, 80), market(100, OVERPASS_TOP, 92));
    const b = routeAcrossLevels(sim.world, WORLD_NAV, market(96, 0, 80), market(100, OVERPASS_TOP, 92));
    expect(a).toEqual(b);
    expect(a?.next).toEqual(market(72, 0, 85.5));
    // Nothing connects the street to a roof.
    expect(routeAcrossLevels(sim.world, WORLD_NAV, market(96, 0, 80), market(74, ROOF_WEST_TOP, 61))).toBeNull();
    expect(() => routeAcrossLevels(sim.world, { nodes: [], edges: [{ a: "x", b: "y" }] }, market(0, 0, 0), market(0, 5, 0))).not.toThrow();
  });
});
