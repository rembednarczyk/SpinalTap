import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, type Entity } from "../src";
import { byKey, input, streetSim, teleportPlayer } from "./helpers";
import { patchDomain } from "./perk-scenes";
import { reinforcementEntity } from "../src/world/reinforcements";
import { enemyScalingOf } from "../src/world/enemy-grade";

/**
 * The last shot at the player goes with the save (G-901): the street takes her shot in the 3 s
 * after it for self-defence, the scanner for a fight (no RAM back), and a loaded game has to as well.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const FIRE = input({ fire: true });

/** Only the guard of the AIs about: the others (respawned by a load too) would fight on near her. */
const alone = (sim: Simulation): Entity => {
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  return guard;
};

/** The guard alerted 5 m from the player, stepped until it has fired at her; her RAM spent. */
const shotAt = (seed: number): Simulation => {
  const sim = streetSim({ seed });
  const guard = alone(sim);
  guard.ai!.alerted = true;
  teleportPlayer(sim, { x: guard.position.x, y: 0, z: guard.position.z - 5 });
  for (let i = 0; i < 120 && !sim.session.lastThreat; i++) sim.step();
  expect(sim.session.lastThreat?.sourceId).toBe(guard.id);
  patchDomain(sim, (d) => ({ ...d, netrun: { ...d.netrun, ram: 0 } }));
  return sim;
};

/** Saved as `SaveController.snapshot()` saves (`calmForSave` first), through the JSON. */
const saved = (sim: Simulation): SaveSnapshot => {
  sim.calmForSave();
  return roundTrip(sim.snapshot(null, "t", ""));
};

describe("the last threat across a save (G-901)", () => {
  for (const seed of [4, 1, 7]) {
    it(`a shot right after the guard's, the guard gone, is self-defence after a load too (seed ${seed})`, () => {
      const sim = shotAt(seed);
      const loaded = Simulation.fromSnapshot(saved(sim));
      alone(loaded);
      const resumed = { got: loaded.session.lastThreat, want: { tick: sim.session.lastThreat!.tick, sourceId: byKey(loaded, "guard")!.id } };
      for (const s of [sim, loaded]) s.world.remove(byKey(s, "guard")!);
      for (let i = 0; i < SIM_HZ; i++) {
        sim.step(FIRE);
        loaded.step(FIRE);
      }
      expect(sim.session.street.incidents).toBe(0);
      expect(loaded.session.street.incidents).toBe(0);
      // The fight goes on for the scanner as well: no RAM back in either game.
      expect(sim.domain.netrun.ram).toBe(0);
      expect(loaded.domain.netrun.ram).toBe(0);
      expect(resumed.got).toEqual(resumed.want);
    });
  }

  it("an older save without one loads with none, as before", () => {
    const { lastThreat: gone, ...older } = saved(shotAt(4));
    expect(gone).toBeDefined();
    expect(Simulation.fromSnapshot(older as SaveSnapshot).session.lastThreat).toBeNull();
  });

  it("a reinforcement that fired, unkeyed, is found again by its `n` and tick", () => {
    const sim = shotAt(4);
    const g = sim.world.add(reinforcementEntity(4000, 2, 3, "hebi_ganger", { ...sim.player()!.position, z: sim.player()!.position.z + 4 }, enemyScalingOf(sim.domain)));
    sim.session.lastThreat = { tick: sim.tick, sourceId: g.id };
    const s = saved(sim);
    expect(s.lastThreat).toEqual({ tick: sim.tick, source: "security:2@3" });
    const loaded = Simulation.fromSnapshot(s);
    const shooter = [...loaded.world].find((e) => e.id === loaded.session.lastThreat?.sourceId);
    expect(shooter?.security).toEqual({ n: 2, since: 3 });
  });

  it("a shooter the loaded game has not leaves the threat with nobody behind it", () => {
    const sim = shotAt(4);
    const s = saved(sim);
    const loaded = Simulation.fromSnapshot({ ...s, lastThreat: { tick: s.lastThreat!.tick, source: "nobody" } });
    const threat = loaded.session.lastThreat!;
    expect(threat.tick).toBe(sim.session.lastThreat!.tick);
    expect([...loaded.world].some((e) => e.id === threat.sourceId)).toBe(false);
  });
});
