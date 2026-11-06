import { describe, expect, it } from "vitest";
import { BASE_RAM, type DomainEvents, type GameCommand, START_ATTRIBUTES, STANDARD_TERMS, respecPrice } from "@seki/core";
import { type Simulation, cyberCapacityOf } from "../src";
import { ramMaxOf } from "../src/world/progression-ops";
import { collect, streetSim } from "./helpers";
import { patchDomain, perked, setProgression } from "./perk-scenes";

/* The perk and respec commands (ADR-0059, stage 3): what the simulation takes and refuses. */

/** A new game in the street, nobody armed about. */
const street = (): Simulation => {
  const sim = streetSim({ seed: 5 });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  sim.step();
  return sim;
};

describe("spend-perk-point", () => {
  it("buys a rank with a point on an open tier; refuses a closed tier, the last rank and no point", () => {
    const sim = street();
    // Level 3: two points of each kind; Net 4 opens Buffer, not Recycler.
    setProgression(sim, perked({ net_buffer: 0 }, 3));
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    patchDomain(sim, (d) => ({ ...d, progression: { ...d.progression, attributes: { ...START_ATTRIBUTES, net: 4 }, unspent: { attribute: 1, perk: 2 } } }));
    sim.enqueue({ type: "spend-perk-point", perk: "net_recycler" });
    sim.step();
    expect(sim.domain.progression.perks).toEqual({});
    sim.enqueue({ type: "spend-perk-point", perk: "net_buffer" });
    sim.step();
    expect(sim.domain.progression).toMatchObject({ perks: { net_buffer: 1 }, unspent: { perk: 1 } });
    // Buffer grows the pool: the HUD hears of it at once.
    expect(ram).toEqual([{ current: BASE_RAM, max: BASE_RAM + 1 }]);
    sim.enqueue({ type: "spend-perk-point", perk: "net_buffer" });
    sim.enqueue({ type: "spend-perk-point", perk: "net_buffer" });
    sim.step();
    expect(sim.domain.progression).toMatchObject({ perks: { net_buffer: 2 }, unspent: { perk: 0 } });
    expect(ramMaxOf(sim.domain)).toBe(BASE_RAM + 2);
  });
});

/** Sends `cmd` (the respec by default) and returns the reasons of its refusals. */
const failed = (sim: Simulation, cmd: GameCommand = { type: "respec" }): string[] => {
  const out = collect<DomainEvents["PurchaseFailed"]>(sim, "PurchaseFailed");
  sim.enqueue(cmd);
  sim.step();
  return out.map((f) => f.reason);
};

describe("respec at Mori's", () => {
  /** Level 7 with Tech 8, Overclock at two ranks and Buffer, and `eddies`. */
  const built = (eddies: number): Simulation => {
    const sim = street();
    setProgression(sim, perked({ tech_overclock: 2, net_buffer: 1 }, 7));
    patchDomain(sim, (d) => ({ ...d, wallet: { eddies } }));
    return sim;
  };

  it("gives every point back for the level's price, and the RAM pool shrinks with Buffer", () => {
    const sim = built(5000);
    const price = respecPrice(7, STANDARD_TERMS);
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    const paid = collect<DomainEvents["EddiesChanged"]>(sim, "EddiesChanged");
    const reset = collect<DomainEvents["ProgressionReset"]>(sim, "ProgressionReset");
    patchDomain(sim, (d) => ({ ...d, netrun: { ...d.netrun, ram: ramMaxOf(d) } }));
    sim.enqueue({ type: "respec" });
    sim.step();
    expect(reset).toEqual([{ price, attribute: 6, perk: 6 }]);
    expect(sim.domain.progression).toMatchObject({ attributes: START_ATTRIBUTES, perks: {}, unspent: { attribute: 6, perk: 6 }, level: 7 });
    expect(sim.domain.wallet.eddies).toBe(5000 - price);
    expect(paid).toEqual([expect.objectContaining({ delta: -price })]);
    expect(ram.at(-1)).toEqual({ current: BASE_RAM, max: BASE_RAM });
    expect(sim.domain.netrun.ram).toBe(BASE_RAM);
  });

  it("is refused without the money and with nothing to give back", () => {
    const poor = built(10);
    expect(failed(poor)).toEqual(["insufficient-funds"]);
    expect(poor.domain.progression.perks).toEqual(perked({ tech_overclock: 2, net_buffer: 1 }, 7).perks);
    expect(failed(street())).toEqual(["empty-slot"]);
  });

  it("leaves implants over the shrunk pool in (stage 3b); a new one does not go in over it", () => {
    const loaded = built(5000);
    patchDomain(loaded, (d) => ({ ...d, character: { ...d.character, cyberware: { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons", arms: "tsubame_reflex", nervous: "synapse_booster" } } }));
    const before = cyberCapacityOf(loaded.domain);
    expect(before.used).toBeLessThanOrEqual(before.max);
    const reset = collect<DomainEvents["ProgressionReset"]>(loaded, "ProgressionReset");
    expect(failed(loaded)).toEqual([]);
    expect(loaded.domain.character.cyberware).toMatchObject({ arms: "tsubame_reflex", nervous: "synapse_booster" });
    const after = cyberCapacityOf(loaded.domain);
    expect(after.used).toBe(before.used);
    expect(after.used).toBeGreaterThan(after.max);
    expect(reset).toEqual([{ price: respecPrice(7, STANDARD_TERMS), attribute: 6, perk: 6 }]);
    // Taking the optics out is free; putting them back in over the pool is refused.
    expect(failed(loaded, { type: "remove-cyberware", slot: "optics" })).toEqual([]);
    expect(loaded.domain.character.cyberware.optics).toBeUndefined();
    expect(failed(loaded, { type: "buy-cyberware", cyberwareId: "hitomi_optics_mk1" })).toEqual(["over-capacity"]);
  });
});
