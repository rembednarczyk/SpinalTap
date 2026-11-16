import { describe, expect, it } from "vitest";
import { Simulation, stateHash } from "../src";
import { FLOOR, floorScript, floorSim, play } from "./fixtures/determinism-floor";

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));

/** The step of the floor's run the medkit is used in, the player at level 2 and hurt by then. */
const MEDKIT_AT = 786;

describe("the player's maximum health through a save (G-888)", () => {
  it("a medkit used in the first step after a load heals as in the game saved from", () => {
    const frames = floorScript();
    expect(frames[MEDKIT_AT]?.input.useItem).toBe(true);
    const original = play(floorSim(1234), frames.slice(0, MEDKIT_AT));
    original.calmForSave();
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot(null, "mid", ""))), undefined, "off", "off", FLOOR);
    // The level's health (ADR-0059) is the player's from the load on, not only after her first step.
    expect(original.player()?.health?.max).toBeGreaterThan(100);
    expect(restored.player()?.health).toEqual(original.player()?.health);
    const medkit = frames.slice(MEDKIT_AT, MEDKIT_AT + 1);
    play(original, medkit);
    play(restored, medkit);
    expect(restored.player()?.health).toEqual(original.player()?.health);
    const rest = frames.slice(MEDKIT_AT + 1, MEDKIT_AT + 30);
    play(original, rest);
    play(restored, rest);
    expect(restored.tick).toBe(original.tick);
    expect(restored.player()?.health).toEqual(original.player()?.health);
    expect(hashOf(restored)).toBe(hashOf(original));
  });
});
