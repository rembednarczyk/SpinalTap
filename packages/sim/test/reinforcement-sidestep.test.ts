import { describe, expect, it } from "vitest";
import type { HeatLevel, HeatState, SaveSnapshot } from "@seki/core";
import { Simulation, docks, stateHash } from "../src";
import { alleySim, teleportPlayer } from "./helpers";

/**
 * The side a reinforcement first leans to when it gets stuck (ADR-0025, G-208): by which of the
 * heat's it is (`security.n`), not by its id, which a loaded game gives otherwise. With the
 * player on the roof of a warehouse in the docks the Tessen's reinforcements have no repath and
 * lean to the side, so the rule shows in the game without any save.
 */

const ROOF = docks(-28, 9, 107);
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

const onTheRoof = (seed: number, level: HeatLevel): Simulation => {
  const start = alleySim({ seed });
  teleportPlayer(start, ROOF);
  const fresh = start.snapshot(null, "t", "");
  const heat: HeatState = { level, faction: "tessen", searching: true, lastKnown: ROOF, searchLeft: 30, cooldown: 0 };
  return Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, heat } }));
};

describe("a reinforcement leans to the side of its number (G-208)", () => {
  for (const [seed, level, golden] of [
    [21, 2, "6d25ba81"],
    [5, 3, "ab60fb91"],
  ] as const) {
    it(`seed ${seed}, ${level} stars, the player on a roof in the docks`, () => {
      const sim = onTheRoof(seed, level);
      const first = new Map<number, 1 | -1>();
      let leaningOtherwise = 0;
      for (let i = 0; i < 900; i++) {
        sim.step();
        for (const e of sim.world.with("security")) {
          if (e.walk && !first.has(e.id)) first.set(e.id, e.walk.side);
          const leaning = e.walk && !e.walk.plan && sim.tick < e.walk.unstickUntil;
          // One whose id and number differ in parity: by its id it would lean the other way.
          if (leaning && e.security.n % 2 !== e.id % 2) leaningOtherwise++;
        }
      }
      expect(leaningOtherwise).toBeGreaterThan(0);
      for (const e of sim.world.with("security")) {
        expect({ n: e.security.n, side: first.get(e.id) }).toEqual({ n: e.security.n, side: e.security.n % 2 === 0 ? 1 : -1 });
      }
      // The run with the rule (seed 21: by the ids it parts otherwise some 510 steps in).
      expect(stateHash(sim.snapshot(null, "t", ""))).toBe(golden);
    });
  }
});
