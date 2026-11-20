import { describe, expect, it } from "vitest";
import { HANA_SPOT, STALL_KEEPERS, Simulation, WORLD_NAV, gangerEntity, ground } from "../src";
import { firingPosition, levelSearch, routeAcrossLevels } from "../src/world/nav";
import { solidIndexOf } from "../src/world/solid-index";
import { byKey, run, teleportPlayer } from "./helpers";

/**
 * What the way up costs a wave after a victim on another floor (ADR-0093 O3: Oyaji's shop on P3,
 * the raids coming for him from T1). Every ganger of it asks the level graph for its way up and its
 * firing position every step, and both questions searched the graph from where it stands, each
 * with its sight lines to every node in reach; the firing position cast one more from every node
 * cheaper than the last one seeing Oyaji. One search for both and the firing position's nodes
 * cheapest first: the same ways, a quarter fewer queries of the solid index.
 */

/** Queries of the solid index a step, four gangers on T1 after Oyaji on P3 (some 370 before, 270 after). */
const PER_STEP_LIMIT = 320;

/** Next to Hana's cart, the Hebi friendly to her: four of them sent after Oyaji from across T1 (the raid of before ADR-0093 O3's from Lubartowska). */
const wave = () => {
  const fresh = Simulation.create({ seed: 5 }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...fresh, domain: { ...fresh.domain, reputation: { ...fresh.domain.reputation, hebi: 30 } } });
  teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
  run(sim, 2);
  const gangers = [ground(441, 66), ground(442.5, 63), ground(439.5, 69), ground(443, 68)].map((at, i) => {
    const g = gangerEntity(9301 + i, { key: `o3-wave-${i}`, position: at, yaw: 0 }, null, 400, sim.streamer.chunkIdAt(at), "oyaji", i === 2 ? "hebi_brawler" : "hebi_ganger");
    sim.world.add(g);
    return g;
  });
  return { sim, gangers };
};

describe("the way up of a wave after a victim on another floor (ADR-0093 O3)", () => {
  it("asks the solid index a quarter less a step: one search for both questions, the firing position's nodes cheapest first", () => {
    const { sim, gangers } = wave();
    const oyaji = byKey(sim, "oyaji")!;
    const index = solidIndexOf(sim.world);
    const before = index.stats.queries;
    const steps = 300;
    run(sim, steps);
    const perStep = (index.stats.queries - before) / steps;
    // Still on their way, below him: every step of it on the level graph.
    for (const g of gangers) expect(oyaji.position.y - g.position.y).toBeGreaterThan(1.5);
    expect(Math.min(...gangers.map((g) => Math.hypot(g.position.x - oyaji.position.x, g.position.z - oyaji.position.z)))).toBeLessThan(25);
    expect(perStep).toBeLessThan(PER_STEP_LIMIT);
  });

  it("gives the same way and firing position with the search handed over as without it, and none from another point", () => {
    const { sim } = wave();
    const target = STALL_KEEPERS.oyaji;
    for (const from of [ground(441, 66), ground(428, 58), ground(426, 50), ground(420, 41)]) {
      const near = levelSearch(sim.world, WORLD_NAV, from)!;
      expect(routeAcrossLevels(sim.world, WORLD_NAV, from, target, near)).toEqual(routeAcrossLevels(sim.world, WORLD_NAV, from, target));
      expect(firingPosition(sim.world, WORLD_NAV, from, target, 18, near)).toEqual(firingPosition(sim.world, WORLD_NAV, from, target, 18));
      // A search made elsewhere is not this point's.
      const other = levelSearch(sim.world, WORLD_NAV, { ...from, x: from.x + 30 })!;
      expect(routeAcrossLevels(sim.world, WORLD_NAV, from, target, other)).toEqual(routeAcrossLevels(sim.world, WORLD_NAV, from, target));
    }
  });
});
