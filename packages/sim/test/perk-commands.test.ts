import { describe, expect, it } from "vitest";
import { BASE_RAM, type DomainEvents, START_ATTRIBUTES, STANDARD_TERMS, respecPrice } from "@seki/core";
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
    patchDomain(sim, (d) => ({ ...d, netrun: { ...d.netrun, ram: ramMaxOf(d) } }));
    sim.enqueue({ type: "respec" });
    sim.step();
    expect(sim.domain.progression).toMatchObject({ attributes: START_ATTRIBUTES, perks: {}, unspent: { attribute: 6, perk: 6 }, level: 7 });
    expect(sim.domain.wallet.eddies).toBe(5000 - price);
    expect(paid).toEqual([expect.objectContaining({ delta: -price })]);
    expect(ram.at(-1)).toEqual({ current: BASE_RAM, max: BASE_RAM });
    expect(sim.domain.netrun.ram).toBe(BASE_RAM);
  });

  it("is refused without the money, with nothing to give back, and with implants that only fit thanks to the points", () => {
    const failed = (sim: Simulation) => {
      const out = collect<DomainEvents["PurchaseFailed"]>(sim, "PurchaseFailed");
      sim.enqueue({ type: "respec" });
      sim.step();
      return out.map((f) => f.reason);
    };
    const poor = built(10);
    expect(failed(poor)).toEqual(["insufficient-funds"]);
    expect(poor.domain.progression.perks).toEqual({ tech_overclock: 2, net_buffer: 1 });
    expect(failed(street())).toEqual(["empty-slot"]);
    const loaded = built(5000);
    patchDomain(loaded, (d) => ({ ...d, character: { ...d.character, cyberware: { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons", arms: "tsubame_reflex", nervous: "synapse_booster" } } }));
    const pool = cyberCapacityOf(loaded.domain);
    expect(pool.used).toBeLessThanOrEqual(pool.max);
    expect(failed(loaded)).toEqual(["over-capacity"]);
    expect(loaded.domain.wallet.eddies).toBe(5000);
  });
});
