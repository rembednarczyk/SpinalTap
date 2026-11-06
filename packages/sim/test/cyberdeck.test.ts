import { describe, expect, it } from "vitest";
import { BASE_RAM, type DomainEvents, type DomainState, type ImplantGrade, QUICKHACKS, deckStats, fitImplant, freeCells, implantOffer, priceWithTerms, shopTerms } from "@seki/core";
import { SIM_DT, Simulation, docks, gangerEntity } from "../src";
import { collect, input, run, streetSim, teleportPlayer } from "./helpers";

/*
 * The cyberdeck implant in the running game (decision of 6.11 after ADR-0059 stage 6): a deck
 * grows the RAM pool, uploads quickhacks faster and brings the RAM back faster. Without one the
 * hacking is as before (the golden hashes hold).
 */

const DECK = "kumo_cyberdeck" as const;
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game in the street, nobody about, with `patch` applied to the domain. */
const simWith = (patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = streetSim({ seed: 5 });
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch({ ...snap.domain, wallet: { eddies: 5000 } }) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const withDeck =
  (grade: ImplantGrade) =>
  (d: DomainState): DomainState => ({ ...d, character: fitImplant(d.character, DECK, grade).character });

/** The first quickhack started on a guard 8 m away, looked at through the scanner. */
const firstUpload = (sim: Simulation): DomainEvents["QuickhackStarted"] => {
  teleportPlayer(sim, docks(16, 0, 97), -Math.PI / 2);
  sim.step();
  const p = sim.player()!.position;
  sim.world.add(gangerEntity(90010, { key: "test-guard", position: { ...p, x: p.x - 8 }, yaw: Math.PI / 2 }, null, 1e6, "nabrzeze-1-1", undefined, "tessen_guard"));
  sim.player()!.pitch = Math.atan2(1.62 - 1.25, 8);
  const started = collect<DomainEvents["QuickhackStarted"]>(sim, "QuickhackStarted");
  sim.step(input({ scan: true }));
  sim.step(input({ scan: true, quickhack: 1 }));
  return started[0]!;
};

describe("the cyberdeck in the running game", () => {
  it("uploads a quickhack faster, more with a better tier and level", () => {
    const plain = firstUpload(simWith());
    const common = firstUpload(simWith(withDeck({ rarity: "common", level: 1 })));
    const rare = firstUpload(simWith(withDeck({ rarity: "rare", level: 10 })));
    expect(plain.upload).toBe(QUICKHACKS[plain.hackId].upload);
    expect(common.upload).toBeCloseTo(plain.upload * 0.92, 9);
    expect(rare.upload).toBeCloseTo(plain.upload * deckStats(DECK, { rarity: "rare", level: 10 }).uploadScale, 9);
    expect(rare.upload).toBeLessThan(common.upload);
  });

  it("bought at the clinic, grows the RAM pool at once, fills up to it and costs the offer's price", () => {
    const sim = simWith();
    sim.step();
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    const installed = collect<DomainEvents["CyberwareInstalled"]>(sim, "CyberwareInstalled");
    sim.enqueue({ type: "buy-cyberware", cyberwareId: DECK });
    sim.step();
    const price = priceWithTerms(implantOffer(DECK, "neutral", 1).listPrice, shopTerms(0));
    expect(installed).toEqual([{ cyberwareId: DECK, replaced: null, price, stowed: false }]);
    expect(sim.domain.wallet.eddies).toBe(5000 - price);
    expect(sim.domain.character.implantGrades).toEqual({ nervous: { rarity: "common", level: 1 } });
    expect(ram).toEqual([{ current: BASE_RAM, max: BASE_RAM + 2 }]);
    run(sim, ticks(5));
    expect(sim.domain.netrun.ram).toBe(BASE_RAM + 2);
    // Taken out, the pool shrinks back and the RAM with it; the deck goes into the bag with its grade.
    sim.enqueue({ type: "remove-cyberware", slot: "nervous" });
    sim.step();
    expect(ram.at(-1)).toEqual({ current: BASE_RAM, max: BASE_RAM });
    expect(sim.domain.inventory.items.find((i) => i.def === DECK)).toMatchObject({ rarity: "common", level: 1 });
  });

  it("brings the RAM back faster", () => {
    const after = (patch?: (d: DomainState) => DomainState) => {
      const sim = simWith((d) => {
        const p = patch ? patch(d) : d;
        return { ...p, netrun: { ...p.netrun, ram: 0 } };
      });
      run(sim, ticks(4));
      return sim.domain.netrun.ram;
    };
    const plain = after();
    const decked = after(withDeck({ rarity: "rare", level: 10 }));
    expect(plain).toBeGreaterThan(0);
    expect(decked).toBeCloseTo(plain * deckStats(DECK, { rarity: "rare", level: 10 }).regenScale, 1);
  });
});

/** The bag with no free cell left. */
const fullBag = (d: DomainState): DomainState => ({ ...d, inventory: { ...d.inventory, capacity: d.inventory.capacity - freeCells(d.inventory, d.equipment) } });

describe("a deck swapped at the clinic with a full bag", () => {
  const swap = (grade: ImplantGrade) => {
    const sim = simWith((d) => fullBag(withDeck(grade)(d)));
    sim.step();
    const failed = collect<DomainEvents["PurchaseFailed"]>(sim, "PurchaseFailed");
    const installed = collect<DomainEvents["CyberwareInstalled"]>(sim, "CyberwareInstalled");
    sim.enqueue({ type: "buy-cyberware", cyberwareId: DECK });
    sim.step();
    return { sim, failed, installed };
  };

  it("is refused, so a graded deck is never lost for a common one", () => {
    const { sim, failed, installed } = swap({ rarity: "legendary", level: 20 });
    expect(failed.map((f) => f.reason)).toEqual(["inventory-full"]);
    expect(installed).toEqual([]);
    expect(sim.domain.wallet.eddies).toBe(5000);
    expect(sim.domain.character.cyberware.nervous).toBe(DECK);
    expect(sim.domain.character.implantGrades).toEqual({ nervous: { rarity: "legendary", level: 20 } });
  });

  it("also keeps a common deck of a higher level", () => {
    const { sim, failed } = swap({ rarity: "common", level: 5 });
    expect(failed.map((f) => f.reason)).toEqual(["inventory-full"]);
    expect(sim.domain.character.implantGrades).toEqual({ nervous: { rarity: "common", level: 5 } });
  });
});
