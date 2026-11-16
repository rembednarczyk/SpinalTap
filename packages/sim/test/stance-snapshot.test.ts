import { describe, expect, it } from "vitest";
import { Simulation, stateHash } from "../src";
import type { Entity } from "../src/world/components";
import { FLOOR, floorScript, floorSim, play } from "./fixtures/determinism-floor";

const brawler = (sim: Simulation): Entity | undefined => [...sim.world.with("melee")].find((e) => e.key === "floor-brawler");

/** Between two blows: idle, nothing in flight, and the last strike not the first of the combo. */
const betweenBlows = (e: Entity | undefined): boolean => {
  const m = e?.melee;
  return !!m && m.phase === "idle" && m.timer === 0 && m.combo === 0 && !m.queued && m.stagger === 0 && !m.guard && m.parry === 0 && m.parryCooldown === 0 && m.knock.time === 0 && m.strike !== 0;
};

describe("a fight saved between two blows (G-883)", () => {
  it("the brawler swings after the load as he would have in the game saved from", () => {
    const frames = floorScript();
    const original = floorSim(1234);
    let at = 0;
    while (at < frames.length && !betweenBlows(brawler(original))) play(original, frames.slice(at, ++at));
    expect(at).toBeLessThan(frames.length);
    original.calmForSave();
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot(null, "mid", ""))), undefined, "off", "off", FLOOR);
    const swings = (sim: Simulation): number[] => {
      const seen: number[] = [];
      const id = brawler(sim)?.id;
      sim.bus.on("MeleeSwing", (e) => {
        if (e.entityId === id) seen.push(e.strike);
      });
      play(sim, frames.slice(at));
      return seen;
    };
    const before = swings(original);
    expect(before.length).toBeGreaterThan(0);
    expect(swings(loaded)).toEqual(before);
  });

  it("a knock spent before the save leaves nothing of it in the loaded game", () => {
    // At step 800 the brawler is out of rest with the knock of his last hit spent (time 0) but its
    // push still on the component; the live game zeroes nothing, so the save must not keep it.
    const frames = floorScript();
    const original = play(floorSim(1234), frames.slice(0, 800));
    original.calmForSave();
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot(null, "mid", ""))), undefined, "off", "off", FLOOR);
    for (const sim of [original, loaded]) {
      play(sim, frames.slice(800, 830));
      sim.calmForSave();
    }
    expect(stateHash(loaded.snapshot(null, "mid", ""))).toBe(stateHash(original.snapshot(null, "mid", "")));
  });
});
