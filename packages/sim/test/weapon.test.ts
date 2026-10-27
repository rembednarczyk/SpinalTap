import { DRAW_TIME } from "@seki/core";
import { describe, expect, it } from "vitest";
import { SIM_DT, Simulation } from "../src/simulation";
import { collect, input, run } from "./helpers";

const shotsBy = (sim: Simulation) => collect<{ shooterId: number }>(sim, "ShotFired");

describe("holstering and drawing the weapon", () => {
  it("holstered, the trigger draws the weapon first and shoots only once it is out", () => {
    const sim = Simulation.create({ seed: 3 });
    const toggles = collect<{ drawn: boolean }>(sim, "WeaponToggled");
    const shots = shotsBy(sim);
    sim.step(input({ toggleWeapon: true }));
    expect(toggles).toEqual([expect.objectContaining({ drawn: false })]);
    run(sim, 5, input({ fire: false }));
    sim.step(input({ fire: true }));
    expect(toggles.at(-1)).toEqual(expect.objectContaining({ drawn: true }));
    expect(shots).toHaveLength(0);
    const drawTicks = Math.ceil(DRAW_TIME / SIM_DT);
    run(sim, drawTicks - 2, input({ fire: true }));
    expect(shots).toHaveLength(0);
    run(sim, 3, input({ fire: true }));
    expect(shots.length).toBeGreaterThan(0);
  });

  it("toggling twice puts the weapon away and brings it back", () => {
    const sim = Simulation.create({ seed: 3 });
    const toggles = collect<{ drawn: boolean }>(sim, "WeaponToggled");
    sim.step(input({ toggleWeapon: true }));
    sim.step(input({ toggleWeapon: true }));
    expect(toggles.map((t) => t.drawn)).toEqual([false, true]);
    expect(sim.player()!.combatant!.drawing).toBeGreaterThan(0);
  });

  it("ignores the toggle during dialogue", () => {
    const sim = Simulation.create({ seed: 3 });
    const toggles = collect<{ drawn: boolean }>(sim, "WeaponToggled");
    sim.session.dialogueActive = true;
    sim.step(input({ toggleWeapon: true }));
    expect(toggles).toHaveLength(0);
  });
});
