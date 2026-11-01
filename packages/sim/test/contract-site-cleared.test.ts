import { describe, expect, it } from "vitest";
import { type Contract, type SaveSnapshot, contractFailedFlag } from "@seki/core";
import { DOKI_ITEM_SPOTS, GENZO_SPOT, Simulation, docks, ground } from "../src";
import { byKey, input, run, teleportPlayer } from "./helpers";
import { takeDown } from "./takedown-scenes";
import { expectSameAfterLoad, peopleOf, reload, roundTrip, taken } from "./contract-save-helpers";

/**
 * G-195: the site of a job done and paid is cleared, as gigs and outposts are in games of the
 * kind. Who is left there goes when the player leaves (the chunk falls asleep) and never comes
 * back; new guards come only with the next job there. A job lost keeps its people as before.
 */

const guardsOf = (sim: Simulation, id: string): string[] => peopleOf(sim, id).filter((k) => k.includes("-g"));

/** Seed and jobs done before; the office's data taken unseen, so the job is cleared, its guards calm. */
const cleared = (seed: number, completed: number): { sim: Simulation; c: Contract } => {
  const { sim, c } = taken(seed, completed, docks(0, 0, 120), "infiltrate");
  const spot = DOKI_ITEM_SPOTS.tessen_office!;
  teleportPlayer(sim, ground(spot.x + 1.1, spot.z), -Math.PI / 2);
  sim.step(input({ interact: true, crouch: true }));
  expect(sim.domain.contracts.active?.status).toBe("cleared");
  expect(guardsOf(sim, c.id)).toHaveLength(c.targets);
  return { sim, c };
};

const pay = (sim: Simulation): void => {
  sim.enqueue({ type: "complete-contract" });
  sim.step();
  expect(sim.domain.contracts.active).toBeNull();
};

/** Two kilometres off, until the docks fall asleep. */
const goAway = (sim: Simulation): void => {
  teleportPlayer(sim, ground(GENZO_SPOT.x + 2000, GENZO_SPOT.z));
  run(sim, 120);
  expect(sim.streamer.isLoaded(sim.streamer.chunkIdAt(DOKI_ITEM_SPOTS.tessen_office!))).toBe(false);
};

const comeBack = (sim: Simulation): void => {
  teleportPlayer(sim, docks(0, 0, 120));
  run(sim, 30);
};

describe("the site of a job done is cleared (G-195)", () => {
  for (const [seed, completed] of [
    [8, 0],
    [31, 4],
  ] as const) {
    it(`a paid job's guards are gone for good once the player leaves and comes back (seed ${seed}, ${completed} done)`, () => {
      const { sim, c } = cleared(seed, completed);
      pay(sim);
      // Still there while she is about: nobody vanishes before her eyes.
      expect(guardsOf(sim, c.id)).toHaveLength(c.targets);
      goAway(sim);
      comeBack(sim);
      expect(peopleOf(sim, c.id)).toEqual([]);
      goAway(sim);
      comeBack(sim);
      expect(peopleOf(sim, c.id)).toEqual([]);
    });
  }

  it("guards that fell asleep while the job waited for its pay do not come back after it is paid", () => {
    const { sim, c } = cleared(8, 0);
    goAway(sim);
    pay(sim);
    comeBack(sim);
    expect(peopleOf(sim, c.id)).toEqual([]);
  });

  it("saved after the pay with the guards about, loaded: they go with the chunk and do not come back", () => {
    const { sim, c } = cleared(8, 0);
    pay(sim);
    const loaded = reload(sim);
    expect(guardsOf(loaded, c.id)).toEqual(guardsOf(sim, c.id));
    goAway(loaded);
    comeBack(loaded);
    expect(peopleOf(loaded, c.id)).toEqual([]);
    // Loaded at once, the game goes on as the saved one.
    expectSameAfterLoad(sim, c.id);
  });

  it("saved after the pay far away, loaded and back at the site: nobody", () => {
    const { sim, c } = cleared(8, 0);
    pay(sim);
    goAway(sim);
    const loaded = reload(sim);
    comeBack(loaded);
    expect(peopleOf(loaded, c.id)).toEqual([]);
    expect(loaded.snapshot(null, "t", "").entities.filter((e) => e.key.startsWith(`${c.id}-`))).toEqual([]);
  });

  it("an older save with the paid job's guards asleep loads, and they do not come back", () => {
    const { sim, c } = cleared(8, 0);
    goAway(sim);
    // What a save made after the pay held before the fix: the guards dormant, the job ended.
    const before = roundTrip(sim.snapshot(null, "t", ""));
    expect(before.entities.filter((e) => e.key.startsWith(`${c.id}-g`))).toHaveLength(c.targets);
    const old: SaveSnapshot = {
      ...before,
      domain: { ...before.domain, contracts: { active: null, completed: before.domain.contracts.completed + 1 } },
      endedContract: { contract: c, completed: before.domain.contracts.completed },
    };
    const loaded = Simulation.fromSnapshot(roundTrip(old));
    expect(peopleOf(loaded, c.id)).toEqual([]);
    comeBack(loaded);
    expect(peopleOf(loaded, c.id)).toEqual([]);
  });

  it("an older save with the paid job among the replaced ones loads with its people", () => {
    const { sim, c } = cleared(8, 0);
    pay(sim);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    // The next job taken with the paid one's guards still about put it among the replaced.
    sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
    sim.step();
    const replaced = roundTrip(sim.snapshot(null, "t", ""));
    expect(replaced.formerContracts?.map((f) => f.contract.id)).toEqual([c.id]);
    expect(snap.endedContract?.contract.id).toBe(c.id);
    const loaded = Simulation.fromSnapshot(replaced);
    expect(guardsOf(loaded, c.id)).toEqual(guardsOf(sim, c.id));
    goAway(loaded);
    comeBack(loaded);
    expect(peopleOf(loaded, c.id)).toEqual([]);
  });

  it("the guards taken down, knocked out or killed, lie there until she leaves, and do not come back", () => {
    const { sim, c } = cleared(8, 0);
    for (const [key, lethal] of [
      [`${c.id}-g0`, false],
      [`${c.id}-g1`, true],
    ] as const) {
      const g = byKey(sim, key)!;
      const behind = { x: g.position.x - 1.2 * Math.sin(g.yaw), y: g.position.y, z: g.position.z - 1.2 * Math.cos(g.yaw) };
      teleportPlayer(sim, behind, g.yaw);
      takeDown(sim, lethal);
      expect(byKey(sim, key)?.downed?.dead).toBe(lethal);
    }
    pay(sim);
    expect(peopleOf(sim, c.id)).toContain(`${c.id}-g0`);
    const saved = reload(sim);
    for (const s of [sim, saved]) {
      expect([`${c.id}-g0`, `${c.id}-g1`].map((k) => byKey(s, k)?.downed?.dead)).toEqual([false, true]);
      goAway(s);
      comeBack(s);
      // Who saw a takedown and hunts her is pinned to her (G-188), not brought back by the site.
      const left = peopleOf(s, c.id);
      expect(left).not.toContain(`${c.id}-g0`);
      expect(left).not.toContain(`${c.id}-g1`);
      for (const k of left) expect(byKey(s, k)?.ai?.alerted || !!byKey(s, k)?.ai?.lastKnown).toBe(true);
    }
  });

  it("the next job at the site brings guards of its own", () => {
    const { sim, c } = cleared(8, 0);
    pay(sim);
    goAway(sim);
    comeBack(sim);
    expect(peopleOf(sim, c.id)).toEqual([]);
    sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
    sim.step();
    const next = sim.domain.contracts.active!;
    expect(next.id).not.toBe(c.id);
    expect(guardsOf(sim, next.id)).toHaveLength(next.targets);
    goAway(sim);
    comeBack(sim);
    expect(guardsOf(sim, next.id)).toHaveLength(next.targets);
    expect(peopleOf(sim, c.id)).toEqual([]);
    const loaded = reload(sim);
    expect(guardsOf(loaded, next.id)).toHaveLength(next.targets);
  });

  it("a job lost with nobody alerted keeps its guards at the site, as before", () => {
    const { sim, c } = taken(4242, 5, docks(0, 0, 120), "infiltrate");
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const late = { ...snap, domain: { ...snap.domain, contracts: { ...snap.domain.contracts, active: { ...c, deadlineTick: snap.tick + 2 } } } };
    const timed = Simulation.fromSnapshot(late);
    run(timed, 3);
    expect(timed.domain.flags).toContain(contractFailedFlag(c.id));
    const guards = guardsOf(timed, c.id);
    expect(guards).toHaveLength(c.targets);
    goAway(timed);
    comeBack(timed);
    expect(guardsOf(timed, c.id)).toEqual(guards);
    const loaded = reload(timed);
    goAway(loaded);
    comeBack(loaded);
    expect(guardsOf(loaded, c.id)).toEqual(guards);
  });
});
