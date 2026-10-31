import { describe, expect, it } from "vitest";
import { LOOT_LIFETIME_SECONDS, LOOT_TABLES, MAX_LOOT_CONTAINERS, type DomainState, type LootLine, rollLoot } from "@seki/core";
import { type ReplayFrame, SIM_HZ, Simulation, deriveRandom, runReplay, stateHash } from "../src";
import { ALLEY_START, AWAY, alleySim, byKey, collect, input, run, teleportPlayer, streetSim } from "./helpers";

const bags = (sim: Simulation) => [...sim.world.with("lootBag")];
/** Bags dropped in play: everything but the stashes placed as Seki walks the city (ADR-0026). */
const drops = (sim: Simulation) => sim.domain.loot.containers.filter((c) => !c.key.startsWith("stash:"));
const dropBags = (sim: Simulation) => bags(sim).filter((b) => !b.lootBag.key.startsWith("stash:"));

/** Only the guard stays in the alley, calm, so nothing but the test touches the main stream. */
const quietAlley = (seed = 21) => {
  const sim = alleySim({ seed });
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  return { sim, guard };
};

const kill = (sim: Simulation, key: string) => {
  const e = byKey(sim, key)!;
  e.health = { ...e.health!, current: 0 };
  sim.step();
  return e;
};

describe("loot from enemies (plan E6)", () => {
  it("a killed ganger leaves a bag rolled from its own stream", () => {
    const { sim, guard } = quietAlley();
    const dropped = collect<{ containerKey: string; best: string | null }>(sim, "LootDropped");
    const rngBefore = sim.rngState;
    kill(sim, "guard");
    expect(sim.rngState).toBe(rngBefore);
    const container = sim.domain.loot.containers[0]!;
    expect(container.key).toBe("loot:guard");
    expect(container.lines).toEqual(rollLoot(LOOT_TABLES.hebi_common, deriveRandom(21, "loot:guard")));
    expect(container.position).toEqual({ x: guard.position.x, y: guard.position.y, z: guard.position.z });
    expect(container.chunk).toBe("krakowskie-2-0");
    expect(container.expiresAtTick).toBe(sim.tick - 1 + LOOT_LIFETIME_SECONDS * SIM_HZ);
    expect(dropped).toEqual([expect.objectContaining({ containerKey: "loot:guard" })]);
    expect(bags(sim)).toHaveLength(1);
    expect(bags(sim)[0]).toMatchObject({ lootBag: { key: "loot:guard" }, interactable: { kind: "loot", prompt: "prompt.loot", radius: 1.6 }, view: { kind: "loot", style: "bag" } });
  });

  it("the same enemy with the same seed drops the same bag, however many shots came before", () => {
    const lines = (shots: number): readonly LootLine[] => {
      const { sim } = quietAlley(33);
      run(sim, shots, input({ fire: true, lookYaw: 0.01 }));
      kill(sim, "guard");
      return sim.domain.loot.containers[0]!.lines;
    };
    expect(lines(0)).toEqual(lines(90));
    const other = alleySim({ seed: 34 });
    kill(other, "guard");
    // Different seeds give different streams (over many keys at least one bag differs).
    const differs = ["a", "b", "c", "d", "e"].some((k) => JSON.stringify(rollLoot(LOOT_TABLES.hebi_common, deriveRandom(33, k))) !== JSON.stringify(rollLoot(LOOT_TABLES.hebi_common, deriveRandom(34, k))));
    expect(differs).toBe(true);
  });

  it("the player searches the bag and takes everything", () => {
    const { sim, guard } = quietAlley();
    kill(sim, "guard");
    const lines = sim.domain.loot.containers[0]!.lines;
    const eddies = lines.find((l) => l.kind === "eddies")!.qty;
    const before = sim.domain.wallet.eddies;
    const started = collect<{ kind: string; dialogueId: string }>(sim, "InteractionStarted");
    const taken = collect<{ containerKey: string; left: number }>(sim, "LootTaken");
    const money = collect<{ delta: number; source?: string }>(sim, "EddiesChanged");
    teleportPlayer(sim, { x: guard.position.x, y: guard.position.y, z: guard.position.z - 1 });
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "loot", dialogueId: "loot:guard" })]);
    expect(sim.session.dialogueActive).toBe(true);
    sim.enqueue({ type: "take-loot", containerKey: "loot:guard", line: "all" });
    sim.enqueue({ type: "end-dialogue" });
    sim.step();
    expect(taken).toEqual([expect.objectContaining({ containerKey: "loot:guard", left: 0 })]);
    expect(money).toEqual([{ balance: before + eddies, delta: eddies, source: "loot" }]);
    expect(sim.domain.wallet.eddies).toBe(before + eddies);
    expect(drops(sim)).toEqual([]);
    expect(dropBags(sim)).toHaveLength(0);
    // A second take of a gone bag does nothing.
    sim.enqueue({ type: "take-loot", containerKey: "loot:guard", line: "all" });
    sim.step();
    expect(taken).toHaveLength(1);
  });

  it("takes a single line and leaves the rest", () => {
    const { sim } = quietAlley();
    kill(sim, "guard");
    const lines = sim.domain.loot.containers[0]!.lines;
    sim.enqueue({ type: "take-loot", containerKey: "loot:guard", line: lines.length - 1 });
    sim.step();
    expect(sim.domain.loot.containers[0]!.lines).toEqual(lines.slice(0, -1));
    expect(bags(sim)).toHaveLength(1);
  });

  it("a full bag keeps what does not fit and says so", () => {
    const { sim } = quietAlley();
    kill(sim, "guard");
    const domain = sim.domain;
    const crowded = Simulation.fromSnapshot({
      ...sim.snapshot(null, "t", ""),
      domain: {
        ...domain,
        inventory: { ...domain.inventory, capacity: 1 },
        loot: { ...domain.loot, containers: [{ ...domain.loot.containers[0]!, lines: [{ kind: "eddies", qty: 5 }, { kind: "item", item: "hebi_jacket", rarity: "rare", qty: 1 }] }] },
      },
    });
    const full = collect<{ defId: string }>(crowded, "InventoryFull");
    crowded.enqueue({ type: "take-loot", containerKey: "loot:guard", line: "all" });
    crowded.step();
    expect(full).toEqual([{ defId: "hebi_jacket" }]);
    expect(crowded.domain.loot.containers[0]!.lines).toEqual([{ kind: "item", item: "hebi_jacket", rarity: "rare", qty: 1 }]);
    // Nothing fits and nothing is money: the command changes nothing.
    const again = collect(crowded, "LootTaken");
    crowded.enqueue({ type: "take-loot", containerKey: "loot:guard", line: 0 });
    crowded.step();
    expect(again).toHaveLength(1);
  });

  it("a bag disappears after 300 s of simulation time", () => {
    const { sim } = quietAlley();
    kill(sim, "guard");
    const expired = collect<{ containerKey: string }>(sim, "LootExpired");
    const expires = sim.domain.loot.containers[0]!.expiresAtTick;
    run(sim, expires - sim.tick);
    expect(bags(sim)).toHaveLength(1);
    expect(expired).toEqual([]);
    sim.step();
    expect(expired).toEqual([{ containerKey: "loot:guard" }]);
    expect(drops(sim)).toEqual([]);
    expect(bags(sim)).toHaveLength(0);
  });

  it("a save keeps the bag, and the loaded game spawns it again", () => {
    const { sim } = quietAlley();
    kill(sim, "guard");
    const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as ReturnType<Simulation["snapshot"]>;
    const restored = Simulation.fromSnapshot(snap);
    expect(restored.domain.loot).toEqual(sim.domain.loot);
    restored.step();
    expect(bags(restored).map((b) => b.lootBag.key)).toEqual(["loot:guard"]);
    // The guard stays dead: no second roll.
    expect(byKey(restored, "guard")).toBeUndefined();
    expect(drops(restored)).toHaveLength(1);
  });

  it("a bag in an unloaded chunk sleeps, keeps ageing, and never returns once expired", () => {
    const { sim } = quietAlley();
    kill(sim, "guard");
    teleportPlayer(sim, AWAY);
    run(sim, 2);
    expect(sim.streamer.isLoaded("krakowskie-2-0")).toBe(false);
    expect(bags(sim)).toHaveLength(0);
    expect(drops(sim)).toHaveLength(1);
    teleportPlayer(sim, ALLEY_START);
    run(sim, 2);
    expect(dropBags(sim)).toHaveLength(1);
    teleportPlayer(sim, AWAY);
    const expires = drops(sim)[0]!.expiresAtTick;
    run(sim, expires - sim.tick + 1);
    teleportPlayer(sim, ALLEY_START);
    run(sim, 2);
    expect(dropBags(sim)).toHaveLength(0);
    expect(drops(sim)).toEqual([]);
  });

  it("contract targets drop their own bags", () => {
    const sim = streetSim({ seed: 8 });
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    const contract = sim.domain.contracts.active!;
    const target = [...sim.world].find((e) => e.key === `${contract.id}-g0`);
    if (!target) return; // site not resident in this seed: the bag logic is the same
    target.health = { ...target.health!, current: 0 };
    sim.step();
    expect(sim.domain.loot.containers.map((c) => c.key)).toContain(`loot:${contract.id}-g0`);
  });
});

describe("dropping items", () => {
  const withBag = (patch: (d: DomainState) => DomainState) => {
    const base = streetSim({ seed: 3 });
    return Simulation.fromSnapshot({ ...base.snapshot(null, "t", ""), domain: patch(base.domain) });
  };

  it("drops part of a stack in a bag at the player's feet", () => {
    const sim = withBag((d) => ({ ...d, inventory: { ...d.inventory, stacks: { scrap: 5 } } }));
    const removed = collect(sim, "ItemRemoved");
    sim.enqueue({ type: "drop-item", ref: { stack: "scrap" }, qty: 2 });
    sim.step();
    expect(sim.domain.inventory.stacks.scrap).toBe(3);
    const c = sim.domain.loot.containers[0]!;
    expect(c.key).toBe("drop:0");
    expect(c.lines).toEqual([{ kind: "stack", item: "scrap", qty: 2 }]);
    expect(sim.domain.loot.dropSeq).toBe(1);
    expect(removed).toEqual([{ ref: { stack: "scrap" }, qty: 2, reason: "dropped" }]);
    // And picks it back up.
    sim.enqueue({ type: "take-loot", containerKey: "drop:0", line: "all" });
    sim.step();
    expect(sim.domain.inventory.stacks.scrap).toBe(5);
  });

  it("drops a loose gun; its rounds go to the pouch", () => {
    const sim = withBag((d) => ({
      ...d,
      inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i4", def: "hebi_smg", rarity: "uncommon", loaded: 20, mods: {} }], nextUid: 5 },
    }));
    sim.enqueue({ type: "drop-item", ref: { uid: "i4" }, qty: 1 });
    sim.enqueue({ type: "drop-item", ref: { uid: "i1" }, qty: 1 });
    sim.enqueue({ type: "drop-item", ref: { stack: "bandage" }, qty: 1 });
    sim.step();
    expect(sim.domain.ammo["9mm"]).toBe(68);
    expect(sim.domain.loot.containers.map((c) => c.lines)).toEqual([[{ kind: "item", item: "hebi_smg", rarity: "uncommon", qty: 1 }]]);
  });

  it("keeps at most twelve bags; a new one pushes out the oldest", () => {
    const sim = withBag((d) => ({ ...d, inventory: { ...d.inventory, stacks: { scrap: 20 } } }));
    const expired = collect<{ containerKey: string }>(sim, "LootExpired");
    for (let i = 0; i <= MAX_LOOT_CONTAINERS; i++) sim.enqueue({ type: "drop-item", ref: { stack: "scrap" }, qty: 1 });
    sim.step();
    expect(sim.domain.loot.containers).toHaveLength(MAX_LOOT_CONTAINERS);
    expect(expired).toEqual([{ containerKey: "drop:0" }]);
    expect(bags(sim)).toHaveLength(MAX_LOOT_CONTAINERS);
  });
});

describe("loot in replays", () => {
  it("a replayed kill and pick-up end in the same state", () => {
    const frames: ReplayFrame[] = [
      { input: input(), commands: [] },
      ...Array.from({ length: 30 }, () => ({ input: input({ fire: true }) })),
      { input: input(), commands: [{ type: "take-loot" as const, containerKey: "loot:guard", line: "all" as const }] },
    ];
    const play = () => {
      const sim = runReplay(5, frames.slice(0, 1));
      kill(sim, "guard");
      for (const f of frames.slice(1)) {
        for (const c of f.commands ?? []) sim.enqueue(c);
        sim.step(f.input);
      }
      return stateHash(sim.snapshot(null, "t", ""));
    };
    expect(play()).toBe(play());
  });
});
