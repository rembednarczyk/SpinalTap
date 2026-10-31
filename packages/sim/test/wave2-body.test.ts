import { describe, expect, it } from "vitest";
import { ABILITY_CATALOG, BUFF_CATALOG, type DomainState, STACKABLE_CATALOG, SHARD_CYBER_CAPACITY, progressionFromXp, xpForLevel } from "@seki/core";
import { SIM_DT, Simulation } from "../src";
import { collect, input, run } from "./helpers";

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game with `patch` applied to the domain, loaded through a snapshot; the street's AI removed. */
const simWith = (patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = Simulation.create({ seed: 31 });
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const rich = (d: DomainState): DomainState => ({ ...d, wallet: { eddies: 20_000 } });
const carrying = (stacks: DomainState["inventory"]["stacks"]) => (d: DomainState): DomainState => ({ ...d, inventory: { ...d.inventory, stacks: { ...d.inventory.stacks, ...stacks } } });

describe("cyberware capacity (ADR-0033)", () => {
  it("reports the pool on the first step and after every change", () => {
    const sim = simWith((d) => carrying({ capacity_shard: 3 })(rich(d)));
    const capacity = collect<{ used: number; max: number }>(sim, "CyberwareCapacityChanged");
    const failed = collect<{ reason: string }>(sim, "PurchaseFailed");
    sim.step();
    expect(capacity).toEqual([{ used: 2, max: 12 }]);
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "kairos_overclock" });
    sim.step();
    expect(capacity.at(-1)).toEqual({ used: 9, max: 12 });
    // The reflex (8) would take 17 of 12: refused, nothing paid, nothing installed.
    const eddies = sim.domain.wallet.eddies;
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "tsubame_reflex" });
    sim.step();
    expect(failed.at(-1)).toMatchObject({ reason: "over-capacity" });
    expect(sim.domain.wallet.eddies).toBe(eddies);
    expect(sim.domain.character.cyberware.arms).toBeUndefined();
    for (let i = 0; i < 3; i++) {
      sim.enqueue({ type: "use-item", ref: { stack: "capacity_shard" } });
      sim.step();
    }
    expect(sim.domain.capacityShards).toBe(3);
    expect(capacity.at(-1)).toEqual({ used: 9, max: 12 + 3 * SHARD_CYBER_CAPACITY });
    expect(STACKABLE_CATALOG.capacity_shard.cyberCapacity).toBe(SHARD_CYBER_CAPACITY);
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "tsubame_reflex" });
    sim.step();
    expect(sim.domain.character.cyberware.arms).toBe("tsubame_reflex");
    expect(capacity.at(-1)).toEqual({ used: 17, max: 18 });
  });

  it("grows every third level (ADR-0059) and keeps the shards through a save", () => {
    const sim = simWith((d) => ({ ...d, contracts: { ...d.contracts, completed: 6 }, progression: progressionFromXp(xpForLevel(6)), capacityShards: 1 }));
    const capacity = collect<{ used: number; max: number }>(sim, "CyberwareCapacityChanged");
    sim.step();
    expect(capacity).toEqual([{ used: 2, max: 12 + 4 + SHARD_CYBER_CAPACITY }]);
    expect(Simulation.fromSnapshot(sim.snapshot(null, "t", "")).domain.capacityShards).toBe(1);
  });

  it("an implant from the bag past the pool is refused too", () => {
    const sim = simWith((d) => {
      const r = rich(d);
      return { ...r, inventory: { ...r.inventory, items: [...r.inventory.items, { uid: "i9", def: "tsubame_reflex", rarity: "common" }], nextUid: 10 }, character: { ...r.character, cyberware: { ...r.character.cyberware, nervous: "kairos_overclock" } } };
    });
    const failed = collect<{ reason: string }>(sim, "PurchaseFailed");
    sim.enqueue({ type: "install-cyberware-item", uid: "i9" });
    sim.step();
    expect(failed).toEqual([{ reason: "over-capacity", shopId: "clinic" }]);
  });
});

describe("buffs (ADR-0033)", () => {
  it("ramen heals at once and then regenerates 0.5 HP/s for two minutes", () => {
    const sim = simWith(carrying({ ramen: 1 }));
    const p = sim.player()!;
    const applied = collect<{ buffId: string; duration: number }>(sim, "BuffApplied");
    const ended = collect<{ buffId: string }>(sim, "BuffEnded");
    p.health = { current: 20, max: 100 };
    sim.enqueue({ type: "use-item", ref: { stack: "ramen" } });
    sim.step();
    expect(applied).toEqual([{ buffId: "regen", duration: BUFF_CATALOG.regen.duration }]);
    expect(p.health.current).toBe(50);
    run(sim, ticks(10));
    expect(p.health.current).toBe(55);
    run(sim, ticks(BUFF_CATALOG.regen.duration));
    expect(ended).toEqual([{ buffId: "regen" }]);
    expect(sim.domain.buffs).toEqual([]);
    expect(p.health.current).toBe(100);
  });

  it("the coffee is drunk at full health and runs the overdrive's cooldown 1.5 times faster", () => {
    const cooldownAfter = (coffee: boolean): number => {
      const sim = simWith((d) => carrying({ synth_coffee: 1 })({ ...d, character: { ...d.character, cyberware: { ...d.character.cyberware, nervous: "kairos_overclock" } } }));
      if (coffee) sim.enqueue({ type: "use-item", ref: { stack: "synth_coffee" } });
      sim.step(input({ ability: true }));
      run(sim, ticks(4));
      return sim.domain.ability.cooldown;
    };
    const plain = cooldownAfter(false);
    const fast = cooldownAfter(true);
    expect(plain).toBeCloseTo(ABILITY_CATALOG.reflex_overdrive.cooldown - 4, 1);
    expect(fast).toBeCloseTo(ABILITY_CATALOG.reflex_overdrive.cooldown - 6, 1);
  });

  it("the stim steadies the aim while it lasts", () => {
    const sim = simWith(carrying({ steady_stim: 1 }));
    run(sim, 3);
    const before = sim.aimSpread();
    sim.enqueue({ type: "use-item", ref: { stack: "steady_stim" } });
    sim.step();
    expect(sim.aimSpread()).toBeLessThan(before);
    run(sim, ticks(BUFF_CATALOG.steady.duration));
    expect(sim.aimSpread()).toBeCloseTo(before);
  });

  it("a running buff is saved with its seconds left and announced after loading", () => {
    const sim = simWith(carrying({ ramen: 1 }));
    sim.player()!.health = { current: 40, max: 100 };
    sim.enqueue({ type: "use-item", ref: { stack: "ramen" } });
    run(sim, ticks(30));
    const loaded = Simulation.fromSnapshot(sim.snapshot(null, "t", ""));
    const left = loaded.domain.buffs[0]?.left ?? 0;
    expect(left).toBeCloseTo(BUFF_CATALOG.regen.duration - 30, 0);
    const applied = collect<{ buffId: string; duration: number }>(loaded, "BuffApplied");
    loaded.step();
    expect(applied).toEqual([{ buffId: "regen", duration: left }]);
    run(sim, ticks(20));
    run(loaded, ticks(20) - 1);
    expect(loaded.player()!.health!.current).toBe(sim.player()!.health!.current);
  });
});
