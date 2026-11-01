import { describe, expect, it } from "vitest";
import { GENZO_SPOT, type Simulation, docks, ground } from "../src";
import { run, teleportPlayer } from "./helpers";
import { alarmed, expectSameAfterLoad, hash, peopleOf, reload } from "./contract-save-helpers";

/** Saving and loading after a new job was taken while the people of the last one still stand about (G-178). */

/** Seed 77: the infiltration lost to the alarm, `after` steps of the fight, then a hack taken in the middle of it. */
const replaced = (after: number): { sim: Simulation; id: string; next: string } => {
  const { sim, id } = alarmed(after);
  sim.enqueue({ type: "accept-contract", kind: "hack" });
  sim.step();
  const next = sim.domain.contracts.active?.id;
  expect(next).toBeDefined();
  expect(next).not.toBe(id);
  return { sim, id, next: next! };
};

describe("save and load after a job was replaced while its people still stand about (G-178)", () => {
  for (const after of [10, 30]) {
    it(`the guards of the lost infiltration fight on after loading, a hack taken ${after} steps into the fight or not`, () => {
      const { sim, id, next } = replaced(after);
      expect(peopleOf(sim, id).filter((k) => k.includes("-g")).length).toBeGreaterThan(0);
      expect(peopleOf(reload(sim), next)).toEqual(peopleOf(sim, next));
      expectSameAfterLoad(sim, id);
    });
  }

  it("those killed since stay dead after loading", () => {
    const { sim, id } = replaced(10);
    for (const e of [...sim.world].filter((x) => x.key?.startsWith(`${id}-`) && x.health)) e.health = { current: 0, max: e.health!.max };
    sim.step();
    expect(peopleOf(sim, id).filter((k) => k.includes("-g"))).toEqual([]);
    expectSameAfterLoad(sim, id);
  });

  it("one asleep in his chunk sleeps on after loading: no template of the new job brings him back", () => {
    const { sim, id } = replaced(10);
    // Calmed down first: an alerted guard is pinned in the world when his chunk sleeps.
    for (const e of [...sim.world].filter((x) => x.key?.startsWith(`${id}-g`) && x.ai)) e.ai = { ...e.ai!, alerted: false, lastKnown: null, search: 0, lost: 0 };
    teleportPlayer(sim, ground(GENZO_SPOT.x + 2000, GENZO_SPOT.z));
    run(sim, 120);
    expect(peopleOf(sim, id).filter((k) => k.includes("-g"))).toEqual([]);
    const loaded = reload(sim);
    expect(hash(loaded)).toBe(hash(sim));
    for (const s of [sim, loaded]) {
      teleportPlayer(s, docks(0, 0, 120));
      run(s, 5);
    }
    expect(peopleOf(loaded, id)).toEqual(peopleOf(sim, id));
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("saved and loaded twice, the replaced job's people are still there", () => {
    const { sim, id } = replaced(10);
    const twice = reload(reload(sim));
    expect(peopleOf(twice, id)).toEqual(peopleOf(sim, id));
    expect(hash(twice)).toBe(hash(sim));
  });
});
