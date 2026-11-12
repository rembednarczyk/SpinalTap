import { describe, expect, it, vi } from "vitest";
import type { Vec3 } from "@seki/core";
import { Simulation, gangerEntity, giveLead, ground } from "../src";
import { wideBuilds } from "../src/systems/ai/steering";
import type * as Nav from "../src/world/nav";
import { off, pieceAt, standOff } from "./barrier-standoff";
import { teleportPlayer } from "./helpers";

/**
 * What the wide way round a long barrier costs a step (G-625): a raster of its window some 37 ms,
 * a field 15. A step makes at most one raster, and gangers keep the goal they planned for, so
 * they do not make them again every step round a corner of the windows' grid, (2352, 432).
 */

/** Where the walkers stood that asked the level graph for a way (`from`: the walker's own position). */
const routed: Vec3[] = [];
vi.mock("../src/world/nav", async (actual) => {
  const nav = await actual<typeof Nav>();
  return {
    ...nav,
    routeAcrossLevels: (...args: Parameters<typeof nav.routeAcrossLevels>) => {
      routed.push(args[2]);
      return nav.routeAcrossLevels(...args);
    },
  };
});

/** Steps `sim` for `steps`, `each` before every one: the most wide rasters a step made, and all rasters and fields made. */
const builds = (sim: Simulation, steps: number, each: (i: number) => void = () => {}) => {
  const start = wideBuilds(sim.world);
  let most = 0;
  for (let i = 0; i < steps; i++) {
    each(i);
    const before = wideBuilds(sim.world).rasters;
    sim.step();
    most = Math.max(most, wideBuilds(sim.world).rasters - before);
  }
  const end = wideBuilds(sim.world);
  return { most, rasters: end.rasters - start.rasters, fields: end.fields - start.fields };
};

describe("the cost of the wide way round a long barrier (G-625)", () => {
  it("makes at most one wide raster a step: three gangers after three leads round a corner of its grid", () => {
    // The leads fall into three of the four wide windows round the corner, behind the fence.
    const { chunk, item } = pieceAt(2359.33, 445.19);
    const sim = Simulation.create({ seed: 2 });
    teleportPlayer(sim, ground(2300, 432));
    sim.step();
    [ground(2350.5, 430.5), ground(2353.5, 430.5), ground(2350.5, 433.5)].forEach((lead, i) => {
      const at = off(item, -4);
      const g = gangerEntity(9101 + i, { key: `g625-${i}`, position: ground(at.x + i - 1, at.z), yaw: 0 }, null, 200, chunk);
      sim.world.add(g);
      giveLead(g, lead);
    });
    expect(builds(sim, 60 * 10)).toEqual({ most: 1, rasters: 3, fields: 3 });
  }, 120_000);

  it("plans its wide way again only when the player moved away from its goal, not at every corner she crosses", () => {
    // She hops round the corner behind the fence, a step a corner.
    const { sim, player } = standOff(2359.33, 445.19, 1);
    const corners = [-1.5, 1.5].flatMap((dx) => [-1.5, 1.5].map((dz) => ({ x: 2352 + dx, z: 432 + dz })));
    const hop = (i: number) => {
      const c = corners[i % corners.length]!;
      player.position = player.prevPosition = ground(c.x, c.z);
    };
    // One wide way for the goal it planned for: she never gets `CHASE_DRIFT` (8 m) from it.
    expect(builds(sim, 60 * 5, hop)).toEqual({ most: 1, rasters: 1, fields: 1 });
  }, 120_000);

  it("does not ask the level graph for a way round on the street every step: it never leads round a barrier there", () => {
    // A walled yard on Krakowskie: no way round, the ganger goes back to its post and stands there.
    const { sim, ganger } = standOff(214, -28.13, 1);
    routed.length = 0;
    for (let i = 0; i < 60 * 10; i++) sim.step();
    expect(routed.filter((from) => from === ganger.position)).toEqual([]);
  }, 120_000);

  it("makes no wide raster for a ganger left far outside its window: its way would start off the field", () => {
    const { sim, player } = standOff(2359.33, 445.19, 1);
    teleportPlayer(sim, ground(player.position.x + 130, player.position.z));
    expect(builds(sim, 60 * 3)).toEqual({ most: 0, rasters: 0, fields: 0 });
  }, 120_000);
});
