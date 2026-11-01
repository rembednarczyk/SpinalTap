import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { Simulation, docks, stateHash } from "../src";
import { byKey, run, teleportPlayer } from "./helpers";

/** Saving and loading in the middle of an infiltration (G-174): the loaded game goes on as the saved one. */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** In the docks' yard with `completed` contracts behind her, one step after taking the infiltration. */
const infiltrating = (seed: number, completed: number, at = docks(0, 0, 120)): Simulation => {
  const fresh = Simulation.create({ seed }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, contracts: { active: null, completed } } }));
  teleportPlayer(sim, at);
  run(sim, 30);
  sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
  sim.step();
  expect(sim.domain.contracts.active?.kind).toBe("infiltrate");
  return sim;
};

/** The first step (1-based) after which the two runs differ, null when they never do in `steps`. */
const firstDivergence = (a: Simulation, b: Simulation, steps: number): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (hash(a) !== hash(b)) return i;
  }
  return null;
};

describe("save and load during an infiltration (G-174)", () => {
  for (const completed of [5, 0]) {
    it(`the loaded game runs as the saved one, step by step (${completed} contracts done)`, () => {
      const sim = infiltrating(4242, completed);
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      expect(hash(loaded)).toBe(hash(sim));
      // A guard of the office has started to make the player out: he still has after loading.
      const c = sim.domain.contracts.active!;
      const watching = [...sim.world.with("ai")].filter((g) => g.key?.startsWith(`${c.id}-g`) && (g.ai.suspicion ?? 0) > 0);
      expect(watching.length).toBeGreaterThan(0);
      for (const g of watching) expect(byKey(loaded, g.key!)?.ai?.suspicion).toBeCloseTo(g.ai.suspicion!, 9);
      expect(firstDivergence(sim, loaded, 10 * 60)).toBeNull();
    });
  }

  it("what the session takes note of in a step is there right after loading, read from the saved state", () => {
    const sim = infiltrating(4242, 5);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const { district, playerHp, ram } = sim.session.watch;
    expect({ district, playerHp, ram }).toEqual({ district: "doki", playerHp: 100, ram: 8 });
    expect(loaded.session.watch).toMatchObject({ district, playerHp, ram });
    expect(loaded.session.street2.district).toBe(sim.session.street2.district);
    expect(loaded.session.interior).toBe(sim.session.interior);
  });

  it("another seed, and a guard half sure after a few steps in front of him, do not part either", () => {
    const sim = infiltrating(77, 2, docks(6, 0, 110));
    const door = byKey(sim, `${sim.domain.contracts.active!.id}-g1`)!;
    // Eight metres in front of the door guard, standing, a sixth of a second: not yet seen.
    teleportPlayer(sim, { x: door.position.x + 8, y: door.position.y, z: door.position.z }, -Math.PI / 2);
    run(sim, 10);
    expect(door.ai!.alerted).toBe(false);
    expect(door.ai!.suspicion).toBeGreaterThan(0.05);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(firstDivergence(sim, loaded, 10 * 60)).toBeNull();
    // He makes her out in the end, in both.
    expect(door.ai!.alerted).toBe(true);
    expect(byKey(loaded, door.key!)?.ai?.alerted).toBe(true);
  });

  it("a guard who has not seen anything saves no suspicion", () => {
    const sim = infiltrating(4242, 5);
    const snap = sim.snapshot(null, "t", "");
    const calm = [...sim.world.with("ai")].filter((g) => g.key && !g.ai.suspicion).map((g) => g.key);
    expect(calm.length).toBeGreaterThan(0);
    for (const key of calm) expect(snap.entities.find((e) => e.key === key)).not.toHaveProperty("suspicion");
  });
});
