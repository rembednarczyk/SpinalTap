import { describe, expect, it } from "vitest";
import { type GameCommand, type InputFrame } from "@seki/core";
import { Simulation, playerStatsOf } from "../src";
import { input } from "./helpers";
import { FLOOR, floorScript, floorSim, play } from "./fixtures/determinism-floor";

/** Hurt enough that a medkit (40) heals past the old maximum and up to the new one. */
const HURT = 95;

const hurt = (sim: Simulation): void => {
  const p = sim.player();
  if (p?.health) p.health = { ...p.health, current: HURT };
};

/** The floor after its first frame (the fixer met, the level up to 2), with eddies for the clinic. */
const richFloor = (): Simulation => {
  const sim = play(floorSim(1234), floorScript().slice(0, 1));
  sim.step();
  sim.calmForSave();
  const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "g892", ""))) as ReturnType<Simulation["snapshot"]>;
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, wallet: { eddies: 5000 } } }, undefined, "off", "off", FLOOR);
};

const stepWith = (sim: Simulation, commands: readonly GameCommand[], frame: InputFrame): void => {
  for (const c of commands) sim.enqueue(c);
  sim.step(frame);
};

const IMPLANT: GameCommand = { type: "buy-cyberware", cyberwareId: "subdermal_weave" };

describe("the player's maximum health in the step it grows (G-892)", () => {
  it("a medkit in the step after a level up heals to the new level's maximum", () => {
    const sim = floorSim(1234);
    const frames = floorScript();
    hurt(sim);
    const before = sim.player()?.health?.max ?? 0;
    play(sim, frames.slice(0, 1));
    expect(sim.domain.progression.level).toBe(2);
    const max = playerStatsOf(sim.domain).maxHp;
    expect(max).toBeGreaterThan(before);
    stepWith(sim, [], input({ useItem: true }));
    expect(sim.player()?.health).toEqual({ current: max, max });
  });

  it("a medkit in the step an implant goes in heals to the implant's maximum", () => {
    const sim = richFloor();
    hurt(sim);
    const before = sim.player()?.health?.max ?? 0;
    stepWith(sim, [IMPLANT], input({ useItem: true }));
    expect(sim.domain.character.cyberware.skeleton).toBe("subdermal_weave");
    const max = playerStatsOf(sim.domain).maxHp;
    expect(max).toBeGreaterThan(before);
    expect(sim.player()?.health).toEqual({ current: max, max });
  });

  it("a medkit from the bag right after an implant heals to the implant's maximum", () => {
    const sim = richFloor();
    hurt(sim);
    const before = sim.player()?.health?.max ?? 0;
    stepWith(sim, [IMPLANT, { type: "use-item", ref: { stack: "medkit" } }], input());
    const max = playerStatsOf(sim.domain).maxHp;
    expect(max).toBeGreaterThan(before);
    expect(sim.player()?.health).toEqual({ current: max, max });
  });
});
