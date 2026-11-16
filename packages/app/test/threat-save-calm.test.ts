import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { Simulation } from "@seki/sim";
import { isCalm } from "../src/controllers/hud-sync";

/**
 * A save mid-fight (G-901): the flashback waits for calm in the loaded game as in the one saved,
 * the shooter (the M0 guard, by its key) still up and the shot just fired.
 */
const shotAt = (seed: number): Simulation => {
  const sim = Simulation.create({ seed });
  const guard = [...sim.world].find((e) => e.key === "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  guard.ai!.alerted = true;
  const p = sim.player()!;
  p.position = { x: guard.position.x, y: 0, z: guard.position.z - 5 };
  p.prevPosition = p.position;
  for (let i = 0; i < 120 && !sim.session.lastThreat; i++) sim.step();
  return sim;
};

describe("calm across a save (G-901)", () => {
  for (const seed of [4, 1, 7]) {
    it(`a loaded game is no calmer than the one saved right after a shot (seed ${seed})`, () => {
      const sim = shotAt(seed);
      expect(isCalm(sim)).toBe(false);
      sim.calmForSave();
      const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot);
      expect(isCalm(loaded)).toBe(false);
    });
  }
});
