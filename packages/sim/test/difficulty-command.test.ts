import { describe, expect, it } from "vitest";
import { BASE_RAM, type DifficultyProfile, NORMAL_DIFFICULTY } from "@seki/core";
import { SIM_HZ, Simulation, createSystems } from "../src";
import { run, streetSim } from "./helpers";
import { profile, roundTrip, setProfile, yardFight } from "./difficulty-scenes";

describe("the set-difficulty command (ADR-0066)", () => {
  it("a new game is on 'normal'; outside a fight the profile takes effect at once, only its six fields", () => {
    const sim = streetSim({ seed: 1 });
    expect(sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    const hard = profile({ damageTaken: 1.4, npcHealth: 1.2 });
    sim.enqueue({ type: "set-difficulty", profile: { ...hard, extra: 7 } as DifficultyProfile });
    sim.step();
    expect(sim.domain.difficulty).toEqual(hard);
  });

  it("refuses a profile with a multiplier out of range or missing", () => {
    const sim = streetSim({ seed: 1 });
    for (const bad of [profile({ npcHealth: 0 }), profile({ awareness: Number.NaN }), profile({ reinforce: 5 }), { damageTaken: 1 } as DifficultyProfile]) {
      sim.enqueue({ type: "set-difficulty", profile: bad });
      sim.step();
      expect(sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    }
  });

  it("with an alerted NPC close by it waits for the end of the fight; the last one asked for wins", () => {
    const { sim, g } = yardFight({});
    sim.enqueue({ type: "set-difficulty", profile: profile({ damageTaken: 2 }) });
    sim.enqueue({ type: "set-difficulty", profile: profile({ damageTaken: 0.5 }) });
    run(sim, SIM_HZ);
    expect(sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    sim.world.remove(g);
    sim.step();
    expect(sim.domain.difficulty).toEqual(profile({ damageTaken: 0.5 }));
  });

  it("an alerted NPC far away is no fight of the player's", () => {
    const { sim } = yardFight({}, { distance: 60 });
    setProfile(sim, { awareness: 2 });
    expect(sim.domain.difficulty.awareness).toBe(2);
  });

  it("the profile is saved and loaded with the game", () => {
    const sim = streetSim({ seed: 1 });
    setProfile(sim, { snipeTell: 1.6, npcAccuracy: 0.6 });
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "d", "")));
    expect(restored.domain.difficulty).toEqual(profile({ snipeTell: 1.6, npcAccuracy: 0.6 }));
  });

  it("someone knocked out is no fight: neither the profile nor the RAM waits for it", () => {
    const { sim, g } = yardFight({}, { distance: 5, ram: BASE_RAM - 2 });
    sim.world.addComponent(g, "unconscious", true);
    setProfile(sim, { awareness: 2 });
    expect(sim.domain.difficulty.awareness).toBe(2);
    run(sim, SIM_HZ);
    expect(sim.domain.netrun.ram).toBeGreaterThan(BASE_RAM - 2);
  });

  it("runs first of all systems, so a profile that waited is in force for the whole next step", () => {
    expect(createSystems()[0]?.name).toBe("difficulty");
  });
});
