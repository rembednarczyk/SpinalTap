import { describe, expect, it } from "vitest";
import { Simulation, ground } from "../src";
import { PORTICOES, porticoOf } from "../src/content/lublin/porticoes";
import { input, run, teleportPlayer } from "./helpers";

/**
 * The portico of Nowy Ratusz (G-119, T-067): the four columns the renderer draws in front of the
 * south front are solids of the building, so a body walks round them, not through them.
 */

const TOWN_HALL = "w66264120";

describe("a landmark's portico (G-119)", () => {
  it("stands four columns in front of Nowy Ratusz, 3.9 m apart", () => {
    const p = porticoOf(TOWN_HALL)!;
    expect(PORTICOES.map((q) => q.building)).toEqual([TOWN_HALL]);
    expect(p.columns).toHaveLength(4);
    for (let k = 1; k < 4; k++) expect(Math.hypot(p.columns[k]!.x - p.columns[k - 1]!.x, p.columns[k]!.z - p.columns[k - 1]!.z)).toBeCloseTo(3.9, 1);
  });

  it("stops the player walking from the plaza into a column", () => {
    const p = porticoOf(TOWN_HALL)!;
    for (const c of p.columns) {
      const sim = Simulation.create({ seed: 1 });
      teleportPlayer(sim, ground(c.x, c.z - 2), 0);
      run(sim, 2);
      run(sim, 60, input({ moveZ: 1 }));
      const at = sim.player()!.position;
      expect(Math.hypot(at.x - c.x, at.z - c.z), `${c.x}, ${c.z}`).toBeGreaterThan(p.radius + 0.2);
      expect(at.z).toBeLessThan(c.z);
    }
  });
});
