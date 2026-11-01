import { describe, expect, it } from "vitest";
import { type Contract, DIFFICULTY_PRESETS, type DifficultyProfile, HACK_GRACE_SECONDS, type SaveSnapshot, contractFailedFlag } from "@seki/core";
import { DOKI_ITEM_SPOTS, DOKI_TERMINAL_SPOTS, GENZO_SPOT, SIM_HZ, Simulation, docks, ground, stateHash } from "../src";
import { byKey, input, run, teleportPlayer } from "./helpers";

/** Saving and loading after a contract has ended while its people still stand in the world (G-178). */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
const peopleOf = (sim: Simulation, id: string): string[] =>
  [...sim.world]
    .map((e) => e.key ?? "")
    .filter((k) => k.startsWith(`${id}-`))
    .sort();

/** With `completed` jobs done, standing at `at` for half a second, the job of `kind` taken one step ago. */
const taken = (
  seed: number,
  completed: number,
  at: ReturnType<typeof docks>,
  kind: "infiltrate" | "hack",
  difficulty?: DifficultyProfile,
): { sim: Simulation; c: Contract } => {
  const fresh = Simulation.create({ seed, ...(difficulty ? { difficulty } : {}) }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, contracts: { active: null, completed } } }));
  teleportPlayer(sim, at);
  run(sim, 30);
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  const c = sim.domain.contracts.active;
  expect(c?.kind).toBe(kind);
  return { sim, c: c! };
};

/** Seed 77, two jobs done: six metres in front of the door guard until the alarm fails the job, and `after` steps more. */
const alarmed = (after: number): { sim: Simulation; id: string } => {
  const { sim, c } = taken(77, 2, docks(6, 0, 110), "infiltrate");
  const door = byKey(sim, `${c.id}-g1`)!;
  teleportPlayer(sim, { x: door.position.x + 6, y: door.position.y, z: door.position.z }, -Math.PI / 2);
  for (let i = 0; i < 600 && sim.domain.contracts.active; i++) sim.step();
  expect(sim.domain.contracts.active).toBeNull();
  expect(sim.domain.flags).toContain(contractFailedFlag(c.id));
  run(sim, after);
  return { sim, id: c.id };
};

/** Both runs stepped together: the first step (1-based) where they part, null when they never do. */
const firstDivergence = (a: Simulation, b: Simulation, steps: number, id: string): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (hash(a) !== hash(b) || peopleOf(a, id).join() !== peopleOf(b, id).join()) return i;
  }
  return null;
};

/** Saved and loaded, the job's people are the same and both games go on as one. */
const expectSameAfterLoad = (sim: Simulation, id: string): void => {
  const loaded = reload(sim);
  expect(peopleOf(loaded, id)).toEqual(peopleOf(sim, id));
  expect(hash(loaded)).toBe(hash(sim));
  expect(firstDivergence(sim, loaded, 10 * 60, id)).toBeNull();
};

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
    // Only the people are compared from here: an alerted guard saved out of his chunk counts
    // the time he has lost her a step on after loading (dormant-restore pins him), not G-178.
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
    // The wave fires a step earlier after a load here, with the job still running as well (a
    // state of the shooters the save leaves out, not G-178): the people are what is compared.
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
