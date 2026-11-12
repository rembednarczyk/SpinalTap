import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity, giveLead, ground } from "../src";
import { nearBuilds, wideBuilds } from "../src/systems/ai/steering";
import { off, pieceAt } from "./barrier-standoff";
import { teleportPlayer } from "./helpers";

/**
 * Many chases round a long barrier at once (G-644): eighteen gangers in front of the fence at
 * (2359, 445), each after its own lead behind it, 6 to 18 m round a corner of the window grid,
 * (2352, 432). Each walks the wide way round (G-625). Asking the near window every step as well,
 * which found each of them cut off, they pushed its eight rasters out of the memo in turn and made
 * them again every step, some 20 ms each: 31.6 ms a step in the median with a dozen of them.
 */
const LEADS = 18;

const host = globalThis as { console?: { info(s: string): void }; performance?: { now(): number } };
const now = (): number => host.performance?.now() ?? 0;

describe("many chases round a long barrier at once (G-644)", () => {
  it("make each near raster once, not again every step", () => {
    const { chunk, item } = pieceAt(2359.33, 445.19);
    const sim = Simulation.create({ seed: 2 });
    teleportPlayer(sim, ground(2300, 432));
    sim.step();
    const at = off(item, -4);
    for (let i = 0; i < LEADS; i++) {
      const a = (2 * Math.PI * i) / LEADS;
      const r = 6 + (12 * i) / LEADS;
      const g = gangerEntity(9101 + i, { key: `g644-${i}`, position: ground(at.x + (i % 4) - 1.5, at.z + Math.floor(i / 4) - 1), yaw: 0 }, null, 200, chunk);
      sim.world.add(g);
      giveLead(g, ground(2352 + Math.cos(a) * r, 432 + Math.sin(a) * r));
    }
    const start = nearBuilds(sim.world).rasters;
    const wide = wideBuilds(sim.world).rasters;
    const times: number[] = [];
    let settled = 0;
    for (let i = 0; i < 60 * 10; i++) {
      const before = nearBuilds(sim.world).rasters;
      const t = now();
      sim.step();
      times.push(now() - t);
      // The first two seconds plan the ways: one raster of a goal each, a wide one a step.
      if (i >= 120) settled += nearBuilds(sim.world).rasters - before;
    }
    const slow = times.slice(120).filter((t) => t > 4).length;
    times.sort((a, b) => a - b);
    const q = (p: number) => (times[Math.floor(p * (times.length - 1))] ?? 0).toFixed(2);
    // A report, not a gate (ADR-0046): the clock depends on the machine.
    host.console?.info(`[G-644] ${LEADS} chases: a step ${q(0.5)} ms in the median, ${q(0.95)} ms p95, ${slow} steps over 4 ms after the first two seconds`);
    expect({ rasters: nearBuilds(sim.world).rasters - start <= LEADS, settled }).toEqual({ rasters: true, settled: 0 });
    // Still the wide way round: four wide windows round the corner.
    expect(wideBuilds(sim.world).rasters - wide).toBe(4);
  }, 120_000);

  it("leave the wide way when the goal comes round to their side of the fence: straight to it, not round to the old one", () => {
    // The fence along the Bystrzyca at (2305-2361, 437-446); a box 2 m square and 1.5 m high hides
    // the new goal from the straight walk. The ganger has its wide way to the lead behind the fence
    // (2345, 438) when the lead comes 7-8 m to its side, within `CHASE_DRIFT` of the old one.
    for (const [moment, x, z] of [
      [150, 2342, 444.5],
      [150, 2345, 445.5],
      [150, 2348, 444.8],
      [240, 2345, 445.5],
      [300, 2345, 445.5],
    ] as const) {
      const { chunk } = pieceAt(2345, 441);
      const sim = Simulation.create({ seed: 2 });
      teleportPlayer(sim, ground(2300, 432));
      sim.step();
      const p = ground(2337, 445.3);
      const solid = { min: { x: p.x - 1, y: p.y, z: p.z - 1 }, max: { x: p.x + 1, y: p.y + 1.5, z: p.z + 1 } };
      sim.world.add({ id: 4500, position: p, prevPosition: p, yaw: 0, prevYaw: 0, pitch: 0, view: { kind: "block", size: { x: 2, y: 1.5, z: 2 }, material: "metal" }, solid });
      const g = gangerEntity(9001, { key: "g644-side", position: ground(2340, 447), yaw: 0 }, null, 200, chunk);
      sim.world.add(g);
      giveLead(g, ground(2345, 438));
      for (let i = 0; i < moment; i++) sim.step();
      const lead = ground(x, z);
      g.ai!.lastKnown = { ...lead };
      const away = () => Math.hypot(g.position.x - lead.x, g.position.z - lead.z);
      const start = away();
      let furthest = start;
      let steps = 0;
      while (away() > 1.5 && steps < 600) {
        sim.step();
        steps++;
        furthest = Math.max(furthest, away());
      }
      // On main before G-644 these took 148 to 349 steps; the wide way to the old lead, up to 635.
      const at = `lead (${x}, ${z}) at step ${moment}`;
      expect(furthest - start, `${at}: walked away from it`).toBeLessThan(0.5);
      expect(steps, `${at}: steps to reach it`).toBeLessThan(400);
    }
  }, 120_000);
});
