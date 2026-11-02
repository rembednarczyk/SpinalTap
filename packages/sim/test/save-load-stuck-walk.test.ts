import { describe, expect, it } from "vitest";
import type { HeatLevel, HeatState, SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash } from "../src";
import { ALLEY_START, alleySim, run } from "./helpers";

/**
 * Saving and loading while the heat's reinforcements jam each other in the alley (G-208): the
 * stuck check (ADR-0025) goes on after a load, so they take the way around in the same steps.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** With the heat up (`level` stars), `after` steps after the first reinforcement came in. */
const withReinforcements = (seed: number, level: HeatLevel, after: number): Simulation => {
  const heat: HeatState = { level, faction: "hebi", searching: true, lastKnown: ALLEY_START, searchLeft: 30, cooldown: 0 };
  const fresh = alleySim({ seed }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, heat } }));
  for (let i = 0; i < 10 * SIM_HZ && sim.world.with("security").entities.length === 0; i++) sim.step();
  run(sim, after);
  expect(sim.session.gameOver).toBe(false);
  return sim;
};

/** The first step (1-based) after which the two runs hash otherwise, null when none in `steps`. */
const firstDivergence = (a: Simulation, b: Simulation, steps: number): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (hash(a) !== hash(b)) return i;
  }
  return null;
};

describe("save and load with reinforcements stuck on each other (G-208)", () => {
  for (const [seed, level, after] of [
    [21, 2, 300],
    [21, 2, 450],
    [5, 3, 300],
    [5, 3, 700],
  ] as const) {
    it(`seed ${seed}, ${level} stars, saved ${after} steps in: the loaded game walks on as the saved one`, () => {
      const sim = withReinforcements(seed, level, after);
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      expect(firstDivergence(sim, loaded, 10 * SIM_HZ)).toBeNull();
    });
  }

  it("a reinforcement getting unstuck is saved so, with its repath", () => {
    const sim = withReinforcements(21, 2, 300);
    let snap: SaveSnapshot | null = null;
    for (let i = 0; i < 10 * SIM_HZ && !snap; i++) {
      sim.step();
      const s = sim.snapshot(null, "t", "");
      if (s.reinforcements?.people.some((p) => p.state.walk?.plan && p.state.walk.unstickUntil > s.tick)) snap = roundTrip(s);
    }
    expect(snap).not.toBeNull();
    const loaded = Simulation.fromSnapshot(snap!);
    expect(loaded.snapshot(null, "t", "").reinforcements).toEqual(snap!.reinforcements);
    expect(firstDivergence(sim, loaded, 5 * SIM_HZ)).toBeNull();
  });
});
