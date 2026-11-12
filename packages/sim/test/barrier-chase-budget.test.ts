import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { Simulation, gangerEntity, giveLead, ground } from "../src";
import { PLAN_WORK } from "../src/systems/ai/chase-plan";
import { wideBuilds } from "../src/systems/ai/steering";
import { applyEntitySnapshot } from "../src/world/factory";
import { groundOf } from "../src/world/ground";
import { off, pieceAt, standOff } from "./barrier-standoff";
import { teleportPlayer } from "./helpers";

/**
 * What a step pays for the wide ways of chases starting at once (G-643). A wide raster (some 37 ms)
 * and its field (some 15) were made whole in the step that asked for them, one a step, and the
 * start of a few chases round a long barrier made steps of 150 to 190 ms against the 4 of
 * ADR-0043. Now a step makes a slice of them, `PLAN_WORK` cells, and the ganger walks the way it
 * has, or waits, until its new one is ready. Counted in cells and in the terrain's heights looked
 * up, not in ms: the clock is only reported.
 */

/** A slice runs past `PLAN_WORK` by less than two rows of the wide window (384 cells each). */
const SLICE = PLAN_WORK + 2 * 384;
/**
 * Heights a step looks up at most (`GroundField.heightAt`, slopes included). A wide raster's
 * terrain alone is 147 456; a near raster's 25 600, and a near raster or two a step stay under it.
 */
const HEIGHTS = 100_000;
const LEADS = 18;

const host = globalThis as { console?: { info(s: string): void }; performance?: { now(): number } };
const now = (): number => host.performance?.now() ?? 0;
const quantile = (xs: number[], p: number): string => ([...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? 0).toFixed(1);

/** Eighteen gangers before the fence at (2359, 445), each after its own lead behind it, round a corner of the wide windows' grid (as G-644). */
const crowd = () => {
  const { chunk, item } = pieceAt(2359.33, 445.19);
  const sim = Simulation.create({ seed: 2 });
  teleportPlayer(sim, ground(2300, 432));
  sim.step();
  const at = off(item, -4);
  const gangers = Array.from({ length: LEADS }, (_, i) => {
    const a = (2 * Math.PI * i) / LEADS;
    const r = 6 + (12 * i) / LEADS;
    const g = gangerEntity(9101 + i, { key: `g643-${i}`, position: ground(at.x + (i % 4) - 1.5, at.z + Math.floor(i / 4) - 1), yaw: 0 }, null, 200, chunk);
    sim.world.add(g);
    giveLead(g, ground(2352 + Math.cos(a) * r, 432 + Math.sin(a) * r));
    return g;
  });
  return { sim, gangers };
};

describe("the wide ways of many chases starting at once (G-643)", () => {
  it("make a slice a step, not a raster and a field: every chase gets its way all the same", () => {
    const { sim, gangers } = crowd();
    const ground = groundOf(sim.world);
    const height = ground.heightAt.bind(ground);
    let heights = 0;
    ground.heightAt = (x, z, reach) => {
      heights++;
      return height(x, z, reach);
    };
    const units: number[] = [];
    const looked: number[] = [];
    const times: number[] = [];
    for (let i = 0; i < 60 * 10; i++) {
      const before = wideBuilds(sim.world).units;
      heights = 0;
      const t = now();
      sim.step();
      times.push(now() - t);
      units.push(wideBuilds(sim.world).units - before);
      // The first step makes the near rasters of all the leads (ten of them), as before.
      if (i > 0) looked.push(heights);
    }
    // A report, not a gate (ADR-0046): the clock depends on the machine.
    const later = times.slice(1);
    host.console?.info(
      `[G-643] ${LEADS} chases: the first step ${quantile(times.slice(0, 1), 0)} ms, then ${quantile(later, 0.5)} ms in the median, ${quantile(later, 0.95)} ms p95, ${quantile(later, 1)} ms at most; ${Math.max(...looked)} heights and ${Math.max(...units)} wide cells a step at most`,
    );
    expect(Math.max(...looked)).toBeLessThanOrEqual(HEIGHTS);
    expect(Math.max(...units)).toBeLessThanOrEqual(SLICE);
    // Each one on a wide way of its own or of another's, ready: none left waiting.
    expect(gangers.filter((g) => !g.walk?.chase || g.walk.chaseNext).map((g) => g.key)).toEqual([]);
    expect(wideBuilds(sim.world).rasters).toBe(4);
  }, 120_000);

  it("a loaded game waits for the way being made as long as the original, and walks it the same", () => {
    const { sim, ganger } = standOff(2359.33, 445.19, 1);
    let steps = 0;
    while (!ganger.walk?.chaseNext && steps++ < 120) sim.step();
    const next = ganger.walk?.chaseNext;
    expect(next && next.ready > sim.tick + 5, "a way being made").toBe(true);
    for (let i = 0; i < 5; i++) sim.step();
    const save = JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot;
    const loaded = Simulation.fromSnapshot(save);
    // The ganger of the test is no content's: it comes back as the save has it.
    const again = gangerEntity(9001, { key: "g625", position: ground(0, 0), yaw: 0 }, null, 200, ganger.chunk ?? "");
    applyEntitySnapshot(again, save.entities.find((e) => e.key === "g625")!);
    loaded.world.add(again);
    const ways: string[][] = [[], []];
    for (let i = 0; i < 60 * 4; i++) {
      for (const [k, s, g] of [[0, sim, ganger], [1, loaded, again]] as const) {
        s.step();
        ways[k]!.push(`${g.position.x.toFixed(4)},${g.position.z.toFixed(4)},${g.walk?.chase ? "way" : "none"}`);
      }
    }
    expect(ways[1]).toEqual(ways[0]);
    // It waited, standing, and set out once the way was ready.
    expect(ways[0]![0]).toBe(ways[0]![1]);
    expect(ways[0]![ways[0]!.length - 1]).not.toBe(ways[0]![0]);
  }, 120_000);
});
