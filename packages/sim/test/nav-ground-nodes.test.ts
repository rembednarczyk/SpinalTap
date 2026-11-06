import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { type ChunkDef, DOCKS_PLACE, type NavGraph, Simulation, WAREHOUSE_TOP, WORLD_NAV, docks } from "../src";
import { lineOfSight } from "../src/world/hitscan";
import { routeAcrossLevels } from "../src/world/nav";
import { straightWalk } from "../src/systems/ai/steering";
import { teleportPlayer } from "./helpers";
import { OLD_MARKET_CHUNK, OVERPASS_TOP, TARG_NAV, market } from "./fixtures/old-market";

/** A point of the docks or of the old market's test floor in their own coordinates (moved by ADR-0045). */
type Frame = (x: number, z: number, y?: number) => Vec3;
const inDocks: Frame = (x, z, y = 0) => docks(x, y, z);
const inMarket: Frame = (x, z, y = 0) => market(x, y, z);

/** The player stands at `p`, so the chunks around it are loaded (of the test floor, given it). */
const scene = (p: Vec3, chunks?: readonly ChunkDef[]): Simulation => {
  const sim = Simulation.create(chunks ? { seed: 5, chunks } : { seed: 5 });
  teleportPlayer(sim, p);
  sim.step();
  sim.step();
  return sim;
};

describe("ground nodes of the level graphs (ADR-0025)", () => {
  /** Share of standable street points (2 m grid) in the rectangle from which the graph leads to `target`. */
  const coverage = (at: Frame, focus: Vec3, target: Vec3, x0: number, x1: number, z0: number, z1: number, graph: NavGraph = WORLD_NAV, chunks?: readonly ChunkDef[]): number => {
    const sim = scene(focus, chunks);
    let ok = 0;
    let total = 0;
    for (let x = x0; x <= x1; x += 2) {
      for (let z = z0; z <= z1; z += 2) {
        if (!lineOfSight(sim.world, at(x, z, 0.3), at(x + 0.01, z, 1.7))) continue;
        total++;
        if (routeAcrossLevels(sim.world, graph, at(x, z), target)) ok++;
      }
    }
    return ok / total;
  };

  it("from anywhere in the yard and on the quay a ganger finds the way up to the warehouse roof", () => {
    expect(coverage(inDocks, inDocks(0, 110), inDocks(-23, 116.8, WAREHOUSE_TOP), -38, 32, 92, 148)).toBe(1);
  });

  it("from almost anywhere on the old market's floor (the test floor), behind the stalls too, the way up to the overpass", () => {
    expect(coverage(inMarket, inMarket(96, 90), inMarket(100, 92, OVERPASS_TOP), 68, 124, 58, 114, TARG_NAV, [OLD_MARKET_CHUNK])).toBeGreaterThan(0.99);
  });

  it("every ground edge of the graph is a straight walk", () => {
    const sim = scene(inDocks(0, 110));
    // A door on the way opens for whoever walks the edge (ADR-0038).
    for (const d of [...sim.world.with("door")]) sim.world.remove(d);
    const node = (id: string) => WORLD_NAV.nodes.find((n) => n.id === id)!.at;
    for (const e of WORLD_NAV.edges) {
      const a = node(e.a);
      const b = node(e.b);
      if (e.via || a.y - DOCKS_PLACE.y > 0.5 || b.y - DOCKS_PLACE.y > 0.5 || sim.streamer.districtAt(a) !== "doki") continue;
      expect(straightWalk(sim.world, a, b), `${e.a} - ${e.b}`).toBe(true);
    }
  });
});
