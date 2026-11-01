import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DifficultyProfile, NORMAL_DIFFICULTY } from "@seki/core";
import { Simulation } from "../src";

/** A new game chosen on a preset (ADR-0066, stage 2): the profile is in force before the world is built. */
describe("a new game on a difficulty", () => {
  const healths = (sim: Simulation) => new Map([...sim.world.with("ai", "health")].filter((e) => e.key).map((e) => [e.key!, e.health.max] as const));

  it("starts on the given profile, only its six fields; without one, or with one out of range, on 'normal'", () => {
    const hard = Simulation.create({ seed: 5, difficulty: { ...DIFFICULTY_PRESETS.hard, extra: 1 } as DifficultyProfile });
    expect(hard.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(Simulation.create({ seed: 5 }).domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    expect(Simulation.create({ seed: 5, difficulty: { ...NORMAL_DIFFICULTY, npcHealth: 9 } }).domain.difficulty).toEqual(NORMAL_DIFFICULTY);
  });

  it("the enemies round the start already appear with the profile's health", () => {
    const normal = healths(Simulation.create({ seed: 5 }));
    const hard = healths(Simulation.create({ seed: 5, difficulty: DIFFICULTY_PRESETS.hard }));
    const tougher = [...hard].filter(([key, max]) => max > (normal.get(key) ?? max));
    expect(tougher.length).toBeGreaterThan(0);
  });
});
