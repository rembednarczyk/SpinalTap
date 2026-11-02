import { describe, expect, it } from "vitest";
import { type Contract, DIFFICULTY_PRESETS, HACK_GRACE_SECONDS, contractFailedFlag } from "@seki/core";
import { DOKI_ITEM_SPOTS, DOKI_TERMINAL_SPOTS, GENZO_SPOT, SIM_HZ, Simulation, docks, ground } from "../src";
import { byKey, input, run, teleportPlayer } from "./helpers";
import { alarmed, expectSameAfterLoad, hash, peopleOf, reload, roundTrip, taken } from "./contract-save-helpers";

/** Saving and loading after a contract has ended while its people still stand in the world (G-178). */

describe("save and load after a contract has ended (G-178)", () => {
  it("the guards of an infiltration lost to the alarm are still there after loading, and still fighting", () => {
    const { sim, id } = alarmed(60);
    expect(peopleOf(sim, id)).toHaveLength(5);
    const hpBefore = sim.player()!.health!.current;
    expectSameAfterLoad(sim, id);
    // They kept shooting at her, in the loaded game as in the saved one.
    expect(sim.player()!.health!.current).toBeLessThan(hpBefore);
  });

  it("the guards killed after the alarm stay dead after loading", () => {
    const { sim, id } = alarmed(10);
    for (const e of [...sim.world].filter((x) => x.key?.startsWith(`${id}-g`) && x.health)) e.health = { current: 0, max: e.health!.max };
    sim.step();
    expect(peopleOf(sim, id).filter((k) => k.includes("-g"))).toEqual([]);
    expectSameAfterLoad(sim, id);
  });

  it("saved away from the docks, the guards of the alarm wait at the office in both games", () => {
    const { sim, id } = alarmed(10);
    const guards = peopleOf(sim, id);
    // Far off, and landed: a fall in progress is not saved (ADR-0021).
    teleportPlayer(sim, ground(GENZO_SPOT.x + 2000, GENZO_SPOT.z));
    run(sim, 120);
    const loaded = reload(sim);
    expect(peopleOf(loaded, id)).toEqual(peopleOf(sim, id));
    expect(hash(loaded)).toBe(hash(sim));
    // Only the people are compared from here: 2 km east of Genzō is off the map, she dies of the
    // fall, and a save of a dead player (the game makes none) loads her alive, so the alerted
    // guards count the time they have lost her on (G-185; alive on the map they do not part).
    for (const s of [sim, loaded]) {
      teleportPlayer(s, docks(0, 0, 120));
      run(s, 5);
    }
    expect(peopleOf(sim, id)).toEqual(guards);
    expect(peopleOf(loaded, id)).toEqual(guards);
  });

  it("an infiltration done (data taken unseen) keeps its calm guards, cleared and then paid, no more and no fewer", () => {
    const cleared = (): { sim: Simulation; c: Contract } => {
      const { sim, c } = taken(8, 0, docks(0, 0, 120), "infiltrate");
      const spot = DOKI_ITEM_SPOTS.tessen_office!;
      teleportPlayer(sim, ground(spot.x + 1.1, spot.z), -Math.PI / 2);
      sim.step(input({ interact: true, crouch: true }));
      expect(sim.domain.contracts.active?.status).toBe("cleared");
      return { sim, c };
    };
    const done = cleared();
    expect(peopleOf(done.sim, done.c.id).filter((k) => k.includes("-g")).length).toBe(done.c.targets);
    expectSameAfterLoad(done.sim, done.c.id);
    const paid = cleared();
    paid.sim.enqueue({ type: "complete-contract" });
    paid.sim.step();
    expect(paid.sim.domain.contracts.active).toBeNull();
    expect(paid.sim.domain.contracts.completed).toBe(1);
    expect(paid.sim.snapshot(null, "t", "").endedContract?.contract.id).toBe(paid.c.id);
    expectSameAfterLoad(paid.sim, paid.c.id);
  });

  for (const [label, completed, difficulty] of [
    ["normal", 0, undefined],
    ["normal", 3, undefined],
    ["hard", 0, DIFFICULTY_PRESETS.hard],
  ] as const) {
    it(`the guards of a paid job are as tough after loading as before, not toughened by its own pay (${label}, ${completed} done)`, () => {
      const { sim, c } = taken(8, completed, docks(0, 0, 120), "infiltrate", difficulty);
      const spot = DOKI_ITEM_SPOTS.tessen_office!;
      teleportPlayer(sim, ground(spot.x + 1.1, spot.z), -Math.PI / 2);
      sim.step(input({ interact: true, crouch: true }));
      sim.enqueue({ type: "complete-contract" });
      sim.step();
      expect(sim.domain.contracts.completed).toBe(completed + 1);
      const loaded = reload(sim);
      const health = (x: Simulation) =>
        peopleOf(x, c.id)
          .filter((k) => k.includes("-g"))
          .map((k) => byKey(x, k)?.health);
      expect(health(sim)).toHaveLength(c.targets);
      expect(health(loaded)).toEqual(health(sim));
      expectSameAfterLoad(sim, c.id);
    });
  }

  it("a hack lost by walking off the terminal keeps its wave after loading (another seed, another job)", () => {
    const { sim, c } = taken(9, 0, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), "hack");
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, ground(t.x, t.z - 1.4), 0);
    sim.step(input({ interact: true }));
    teleportPlayer(sim, ground(t.x, t.z - 12), 0);
    run(sim, HACK_GRACE_SECONDS * SIM_HZ + 1);
    expect(sim.domain.flags).toContain(contractFailedFlag(c.id));
    const wave = peopleOf(sim, c.id);
    expect(wave.filter((k) => k.includes("-g")).length).toBe(c.targets);
    const loaded = reload(sim);
    expect(peopleOf(loaded, c.id)).toEqual(wave);
    expect(hash(loaded)).toBe(hash(sim));
    // The wave has shot her dead by now, and a save of a dead player (the game makes none) loads
    // her alive, so the wave goes on firing at her (G-185): the people are what is compared.
    for (let i = 0; i < 10 * 60; i++) {
      sim.step();
      loaded.step();
      expect(peopleOf(loaded, c.id)).toEqual(peopleOf(sim, c.id));
    }
  });

  it("a job lost with nobody alerted, out of time far from its site, brings nobody back on loading", () => {
    const { sim, c } = taken(4242, 5, docks(0, 0, 120), "infiltrate");
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const late = { ...snap, domain: { ...snap.domain, contracts: { ...snap.domain.contracts, active: { ...c, deadlineTick: snap.tick + 2 } } } };
    const timed = Simulation.fromSnapshot(late);
    teleportPlayer(timed, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    run(timed, 3);
    expect(timed.domain.contracts.active).toBeNull();
    expect(timed.domain.flags).toContain(contractFailedFlag(c.id));
    expectSameAfterLoad(timed, c.id);
  });

  it("with no job ever taken nothing is saved for one", () => {
    const sim = Simulation.create({ seed: 1 });
    run(sim, 5);
    expect(sim.snapshot(null, "t", "").endedContract).toBeUndefined();
  });

  it("saves the ended job only once no other is in the log", () => {
    const { sim, id } = alarmed(0);
    expect(sim.snapshot(null, "t", "").endedContract?.contract.id).toBe(id);
    sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
    sim.step();
    expect(sim.domain.contracts.active?.id).not.toBe(id);
    expect(sim.snapshot(null, "t", "").endedContract).toBeUndefined();
  });
});
