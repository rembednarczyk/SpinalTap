import { describe, expect, it } from "vitest";
import { CONTRACT_KIND_IDS, type Contract, type SaveSnapshot, type Vec3, SECONDS_PER_HOUR } from "@seki/core";
import { CONTRACT_HOOKS, Simulation, ground, hooksOfKind, market, stateHash } from "../src";
import { hookTerminalKey, offPostFlag } from "../src/world/contract-plan";
import { lineOfSight } from "../src/world/hitscan";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** A game loaded with `job` running at `hour`, the player at `at`. */
const withJob = (job: Contract, at: Vec3, hour = 21): Simulation => {
  const snap = Simulation.create({ seed: 9 }).snapshot(null, "t", "");
  const player = { ...snap.entities.find((e) => e.key === "player")!, position: at };
  const entities = [...snap.entities.filter((e) => e.key !== "player"), player];
  const clock = { seconds: hour * SECONDS_PER_HOUR };
  const sim = Simulation.fromSnapshot({ ...snap, entities, domain: { ...snap.domain, clock, contracts: { active: job, completed: 2 } } });
  run(sim, 2);
  return sim;
};

describe("the hook table (ADR-0034)", () => {
  it("gives every kind of job one or two hooks, named after their knots", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      const hooks = hooksOfKind(kind);
      expect(hooks.length, kind).toBeGreaterThanOrEqual(1);
      expect(hooks.length, kind).toBeLessThanOrEqual(2);
      hooks.forEach((h, i) => expect(h.knot).toBe(`hook_${kind}_${i + 1}`));
    }
    expect(new Set(CONTRACT_HOOKS.map((h) => h.id)).size).toBe(CONTRACT_HOOKS.length);
  });

  it.each(CONTRACT_HOOKS.filter((h) => "at" in h.carrier).map((h) => [h.id, h] as const))("%s: the terminal stands on open ground", (_id, h) => {
    const p = (h.carrier as { at: Vec3 }).at;
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, { x: p.x + 1, y: p.y, z: p.z });
    run(sim, 1);
    expect(lineOfSight(sim.world, { x: p.x, y: p.y + 0.3, z: p.z }, { x: p.x + 0.01, y: p.y + 1.7, z: p.z })).toBe(true);
  });
});

const stash: Contract = { id: "c3", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 500, status: "active" };

describe("finding hooks (ADR-0034)", () => {
  it("a guard's bark is heard up close and found once", () => {
    const sim = withJob(stash, market(96, 0, 86));
    const barks = collect<{ knot: string }>(sim, "GuardBark");
    const found = collect<{ hookId: string; text: string }>(sim, "ContractHookFound");
    run(sim, 5);
    expect(barks).toEqual([]);
    const g0 = byKey(sim, "c3-g0")!;
    teleportPlayer(sim, { x: g0.position.x - 3, y: g0.position.y, z: g0.position.z });
    run(sim, 3);
    expect(barks.map((b) => b.knot)).toEqual(["hook_retrieve_1"]);
    expect(found).toEqual([{ contractId: "c3", hookId: "hook_retrieve_1", text: "hook.retrieve_1" }]);
    expect(sim.domain.contracts.hooks).toEqual(["hook_retrieve_1"]);
    // Saved with the job.
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(loaded.domain.contracts.hooks).toEqual(["hook_retrieve_1"]);
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
  });

  it("the rotation gap takes the guard off his post in its window", () => {
    const sim = withJob(stash, market(96, 0, 86), 0);
    run(sim, 2);
    expect(sim.domain.flags).toContain(offPostFlag("c3", 1));
    expect(byKey(sim, "c3-g1")).toBeUndefined();
    expect(byKey(sim, "c3-g0")).toBeDefined();
    sim.enqueue({ type: "wait", minutes: 30 });
    run(sim, 3);
    expect(byKey(sim, "c3-g1")).toBeDefined();
  });

  it("a mail is read on its terminal and opens as a conversation", () => {
    const job: Contract = { id: "c4", kind: "infiltrate", siteId: "tessen_office", targets: 3, reward: 600, status: "active" };
    const h = CONTRACT_HOOKS.find((x) => x.id === "hook_infiltrate_1")!;
    const p = (h.carrier as { at: Vec3 }).at;
    const sim = withJob(job, { x: p.x + 1, y: p.y, z: p.z });
    expect(byKey(sim, hookTerminalKey("c4", h.id))).toBeDefined();
    const started = collect<{ kind: string; dialogueId: string }>(sim, "InteractionStarted");
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "dialogue", dialogueId: "hook_infiltrate_1" })]);
    expect(sim.domain.contracts.hooks).toEqual(["hook_infiltrate_1"]);
  });

  it("a shard lies in its carrier's bag and is found when taken", () => {
    const job: Contract = { id: "c5", kind: "eliminate", siteId: "east_lot", targets: 3, reward: 600, status: "active" };
    // On Plac Litewski, by the east lot (ADR-0045).
    const sim = withJob(job, ground(90, -40));
    const g1 = byKey(sim, "c5-g1")!;
    g1.health = { current: 0, max: 80 };
    run(sim, 2);
    const bag = sim.domain.loot.containers.find((c) => c.key === "loot:c5-g1")!;
    expect(bag.lines).toContainEqual({ kind: "stack", item: "datachip", qty: 1 });
    expect(sim.domain.contracts.hooks ?? []).toEqual([]);
    sim.enqueue({ type: "take-loot", containerKey: bag.key, line: "all" });
    run(sim, 1);
    expect(sim.domain.contracts.hooks).toEqual(["hook_eliminate_2"]);
  });
});
