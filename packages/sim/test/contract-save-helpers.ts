import { expect } from "vitest";
import { type Contract, type DifficultyProfile, type SaveSnapshot, contractFailedFlag } from "@seki/core";
import { Simulation, docks, stateHash } from "../src";
import { byKey, run, teleportPlayer } from "./helpers";

/** Runs for the saves of a contract that has ended or was replaced (G-178). */

export const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
export const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
export const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
export const peopleOf = (sim: Simulation, id: string): string[] =>
  [...sim.world]
    .map((e) => e.key ?? "")
    .filter((k) => k.startsWith(`${id}-`))
    .sort();

/** With `completed` jobs done, standing at `at` for half a second, the job of `kind` taken one step ago. */
export const taken = (
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
export const alarmed = (after: number): { sim: Simulation; id: string } => {
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
export const firstDivergence = (a: Simulation, b: Simulation, steps: number, id: string): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (hash(a) !== hash(b) || peopleOf(a, id).join() !== peopleOf(b, id).join()) return i;
  }
  return null;
};

/** Saved and loaded, the job's people are the same and both games go on as one. */
export const expectSameAfterLoad = (sim: Simulation, id: string): void => {
  const loaded = reload(sim);
  expect(peopleOf(loaded, id)).toEqual(peopleOf(sim, id));
  expect(hash(loaded)).toBe(hash(sim));
  expect(firstDivergence(sim, loaded, 10 * 60, id)).toBeNull();
};
