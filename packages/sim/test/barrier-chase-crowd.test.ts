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
    times.sort((a, b) => a - b);
    const q = (p: number) => (times[Math.floor(p * (times.length - 1))] ?? 0).toFixed(2);
    // A report, not a gate (ADR-0046): the clock depends on the machine.
    host.console?.info(`[G-644] ${LEADS} chases: a step ${q(0.5)} ms in the median, ${q(0.95)} ms p95`);
    expect({ rasters: nearBuilds(sim.world).rasters - start <= LEADS, settled }).toEqual({ rasters: true, settled: 0 });
    // Still the wide way round: four wide windows round the corner.
    expect(wideBuilds(sim.world).rasters - wide).toBe(4);
  }, 120_000);
});
