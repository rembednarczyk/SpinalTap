import { describe, expect, it } from "vitest";
import { type DomainState, type GameCommand, addInstance, addStack, findItem } from "@seki/core";
import { SCHEDULES, Simulation, shopOpen } from "../src";
import { byKey, collect, input, teleportPlayer } from "./helpers";

/** A fresh game (21:00, the stall still open) with the domain patched the way a load would build it. */
const simWith = (patch: (d: DomainState) => Partial<DomainState> = () => ({})): Simulation => {
  const snap = Simulation.create({ seed: 5 }).snapshot(null, "test", "");
  const domain = { ...snap.domain, wallet: { eddies: 3000 } };
  return Simulation.fromSnapshot({ ...snap, domain: { ...domain, ...patch(domain) } });
};

const withStack = (d: DomainState, id: Parameters<typeof addStack>[2], qty: number) => addStack(d.inventory, d.equipment, id, qty).inventory;

const withPiece = (d: DomainState, def: Parameters<typeof addInstance>[2]) => {
  const r = addInstance(d.inventory, d.equipment, def, "common");
  if (!r.ok) throw new Error("bag full");
  return r.inventory;
};

const apply = (sim: Simulation, ...cmds: GameCommand[]) => {
  for (const c of cmds) sim.enqueue(c);
  sim.step();
};

const STALL = SCHEDULES.oyaji!.stops[0]!.path.at(-1)!;

describe("Oyaji's stall (E10)", () => {
  it("opens as a shop by day, with Oyaji's ink knot behind it", () => {
    const sim = Simulation.create({ seed: 5 });
    const started = collect(sim, "InteractionStarted");
    teleportPlayer(sim, { x: STALL.x, y: STALL.y, z: STALL.z - 1.4 });
    sim.step();
    expect(byKey(sim, "oyaji")?.interactable).toMatchObject({ kind: "shop", shopId: "oyaji", prompt: "Stragan Oyajiego" });
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "shop", shopId: "oyaji", dialogueId: "oyaji" })]);
  });

  it("buys scrap and pieces, pays from the same function the panel quotes with", () => {
    const sim = simWith((d) => ({ inventory: withPiece({ ...d, inventory: withStack(d, "scrap", 4) }, "hebi_smg") }));
    const sold = collect(sim, "ItemSold");
    const money = collect(sim, "EddiesChanged");
    const smg = sim.domain.inventory.items.at(-1)!.uid;
    apply(sim, { type: "sell-item", shopId: "oyaji", ref: { stack: "scrap" }, qty: 4 }, { type: "sell-item", shopId: "oyaji", ref: { uid: smg }, qty: 1 });
    expect(sold).toEqual([
      { shopId: "oyaji", defId: "scrap", qty: 4, price: 48 },
      { shopId: "oyaji", defId: "hebi_smg", qty: 1, price: 175 },
    ]);
    expect(money).toEqual([
      { balance: 3048, delta: 48, source: "sale" },
      { balance: 3223, delta: 175, source: "sale" },
    ]);
    expect(sim.domain.inventory.stacks.scrap).toBeUndefined();
    expect(findItem(sim.domain.inventory, smg)).toBeUndefined();
  });

  it("is shut at night and once Oyaji is dead; nothing changes", () => {
    const night = simWith((d) => ({ inventory: withStack(d, "scrap", 2) }));
    const failed = collect(night, "PurchaseFailed");
    apply(night, { type: "wait", minutes: 60 });
    expect(shopOpen(night.domain, "oyaji")).toBe(false);
    expect(shopOpen(night.domain, "clinic")).toBe(true);
    apply(night, { type: "sell-item", shopId: "oyaji", ref: { stack: "scrap" }, qty: 1 }, { type: "upgrade-capacity" }, { type: "repair-item", uid: "i2", useParts: 0 });
    expect(failed).toEqual([
      { reason: "closed", shopId: "oyaji" },
      { reason: "closed", shopId: "oyaji" },
      { reason: "closed", shopId: "oyaji" },
    ]);
    expect(night.domain.inventory.stacks.scrap).toBe(2);
    const dead = simWith((d) => ({ flags: [...d.flags, "dead:oyaji"] }));
    expect(shopOpen(dead.domain, "oyaji")).toBe(false);
  });

  it("refuses a customer the street is wary of no more than a hostile one", () => {
    const sim = simWith((d) => ({ inventory: withStack(d, "scrap", 1), reputation: { ...d.reputation, civilians: -80 } }));
    const failed = collect(sim, "PurchaseFailed");
    apply(sim, { type: "sell-item", shopId: "oyaji", ref: { stack: "scrap" }, qty: 1 });
    expect(failed).toEqual([{ reason: "refused", shopId: "oyaji" }]);
    const wary = simWith((d) => ({ inventory: withStack(d, "scrap", 4), reputation: { ...d.reputation, civilians: -30 } }));
    const sold = collect<{ price: number }>(wary, "ItemSold");
    apply(wary, { type: "sell-item", shopId: "oyaji", ref: { stack: "scrap" }, qty: 4 });
    expect(sold[0]?.price).toBe(36);
  });

  it("mends a worn jacket with weapon parts", () => {
    const sim = simWith((d) => ({
      inventory: withStack({ ...d, inventory: { ...d.inventory, items: d.inventory.items.map((i) => (i.uid === "i2" ? { ...i, condition: 0 } : i)) } }, "weapon_parts", 2),
    }));
    const repaired = collect(sim, "ItemRepaired");
    const removed = collect(sim, "ItemRemoved");
    apply(sim, { type: "repair-item", uid: "i2", useParts: 5 });
    expect(repaired).toEqual([{ uid: "i2", defId: "seki_jacket", price: 0, parts: 2 }]);
    expect(removed).toEqual([{ ref: { stack: "weapon_parts" }, qty: 2, reason: "repair" }]);
    expect(findItem(sim.domain.inventory, "i2")?.condition).toBe(100);
    const failed = collect(sim, "PurchaseFailed");
    apply(sim, { type: "repair-item", uid: "i2", useParts: 0 }, { type: "repair-item", uid: "i99", useParts: 0 });
    expect(failed).toEqual([
      { reason: "not-damaged", shopId: "oyaji" },
      { reason: "not-found", shopId: "oyaji" },
    ]);
  });

  it("sells backpacks, boxes of rounds and mods", () => {
    const sim = simWith();
    const bought = collect(sim, "ItemBought");
    const grown = collect(sim, "CapacityUpgraded");
    const added = collect(sim, "ItemAdded");
    apply(sim, { type: "upgrade-capacity" }, { type: "buy-item", shopId: "oyaji", itemId: "9mm" }, { type: "buy-item", shopId: "oyaji", itemId: "holo_sight" });
    expect(grown).toEqual([{ capacity: 30, price: 600 }]);
    expect(sim.domain.inventory.capacity).toBe(30);
    expect(sim.domain.ammo["9mm"]).toBe(72);
    expect(bought).toEqual([
      { itemId: "9mm", price: 24, shopId: "oyaji", qty: 24 },
      { itemId: "holo_sight", price: 300, shopId: "oyaji", qty: 1 },
    ]);
    expect(added).toEqual([expect.objectContaining({ defId: "holo_sight", source: "shop" })]);
    expect(sim.domain.wallet.eddies).toBe(3000 - 600 - 24 - 300);
    // The clinic does not stock rounds.
    const failed = collect(sim, "PurchaseFailed");
    apply(sim, { type: "buy-item", itemId: "9mm" });
    expect(failed).toEqual([{ reason: "not-sold-here", shopId: "clinic" }]);
  });

  it("trading consumes no randomness", () => {
    const sim = simWith((d) => ({ inventory: withStack(d, "scrap", 3) }));
    const before = sim.rngState;
    apply(sim, { type: "sell-item", shopId: "oyaji", ref: { stack: "scrap" }, qty: 3 }, { type: "upgrade-capacity" });
    const twin = simWith((d) => ({ inventory: withStack(d, "scrap", 3) }));
    twin.step();
    expect(sim.rngState).toBe(twin.rngState);
    expect(before).toBe(Simulation.create({ seed: 5 }).rngState);
  });
});

describe("implants as items at the clinic (E11)", () => {
  it("fits a found grip stabiliser for 125 €$", () => {
    const sim = simWith((d) => ({ inventory: withPiece(d, "steady_grip") }));
    const uid = sim.domain.inventory.items.at(-1)!.uid;
    const installed = collect(sim, "CyberwareInstalled");
    const removed = collect(sim, "ItemRemoved");
    apply(sim, { type: "install-cyberware-item", uid });
    expect(installed).toEqual([{ cyberwareId: "steady_grip", replaced: null, price: 125, fromBag: true, stowed: false }]);
    expect(removed).toEqual([{ ref: { uid }, qty: 1, reason: "installed" }]);
    expect(sim.domain.character.cyberware.arms).toBe("steady_grip");
    expect(sim.domain.wallet.eddies).toBe(2875);
    expect(sim.domain.reputation.clinic).toBe(4);
  });

  it("the replaced implant goes back into the bag, whether bought or fitted", () => {
    const sim = simWith((d) => ({ inventory: withPiece(d, "kairos_overclock") }));
    const uid = sim.domain.inventory.items.at(-1)!.uid;
    const added = collect(sim, "ItemAdded");
    apply(sim, { type: "buy-cyberware", cyberwareId: "synapse_booster" });
    apply(sim, { type: "install-cyberware-item", uid });
    expect(sim.domain.character.cyberware.nervous).toBe("kairos_overclock");
    expect(added.map((a) => (a as { defId: string }).defId)).toEqual(["synapse_booster"]);
    expect(sim.domain.inventory.items.some((i) => i.def === "synapse_booster")).toBe(true);
    apply(sim, { type: "buy-cyberware", cyberwareId: "hitomi_optics_mk1" });
    // The starter optics are already in; buying them again is refused.
    expect(sim.domain.inventory.items.filter((i) => i.def === "hitomi_optics_mk1")).toHaveLength(0);
  });

  it("takes an implant out for free, into the bag", () => {
    const sim = simWith();
    const removed = collect(sim, "CyberwareRemoved");
    const failed = collect(sim, "PurchaseFailed");
    apply(sim, { type: "remove-cyberware", slot: "optics" }, { type: "remove-cyberware", slot: "arms" });
    expect(removed).toEqual([{ cyberwareId: "hitomi_optics_mk1", slot: "optics" }]);
    expect(failed).toEqual([{ reason: "empty-slot", shopId: "clinic" }]);
    expect(sim.domain.character.cyberware.optics).toBeUndefined();
    expect(sim.domain.inventory.items.at(-1)).toMatchObject({ def: "hitomi_optics_mk1" });
    expect(sim.domain.wallet.eddies).toBe(3000);
  });

  it("a refused fitting changes nothing", () => {
    const sim = simWith((d) => ({ wallet: { eddies: 10 }, inventory: withPiece(d, "steady_grip") }));
    const failed = collect(sim, "PurchaseFailed");
    const before = sim.domain;
    apply(sim, { type: "install-cyberware-item", uid: sim.domain.inventory.items.at(-1)!.uid });
    expect(failed).toEqual([{ reason: "insufficient-funds", shopId: "clinic" }]);
    expect(sim.domain.inventory).toBe(before.inventory);
    expect(sim.domain.character).toBe(before.character);
  });
});
