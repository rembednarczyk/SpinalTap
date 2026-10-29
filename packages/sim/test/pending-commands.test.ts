import { describe, expect, it } from "vitest";
import { type DomainState, type GameCommand, newInstance } from "@seki/core";
import { stateHash } from "../src/replay";
import { Simulation } from "../src/simulation";
import { collect, input, run, streetSim } from "./helpers";

/** A new game with a looted Hebi SMG ("i4"), a holo sight ("i5") and some scrap in the bag. */
const withSmg = (seed = 11): Simulation => {
  const snap = streetSim({ seed }).snapshot(null, "t", "");
  const d: DomainState = snap.domain;
  const domain: DomainState = {
    ...d,
    inventory: { ...d.inventory, stacks: { ...d.inventory.stacks, scrap: 3 }, items: [...d.inventory.items, newInstance("i4", "hebi_smg", "uncommon"), newInstance("i5", "holo_sight", "common")], nextUid: 6 },
  };
  return Simulation.fromSnapshot({ ...snap, domain });
};

const MENU: readonly GameCommand[] = [
  { type: "equip-item", uid: "i4" },
  { type: "install-mod", weaponUid: "i4", modUid: "i5" },
  { type: "use-item", ref: { stack: "medkit" } },
  { type: "drop-item", ref: { stack: "scrap" }, qty: 2 },
];

describe("applyPendingCommands (menu while the clock stands)", () => {
  it("applies queued menu commands at once, without a tick", () => {
    const sim = withSmg();
    run(sim, 3, input({ moveX: 1 }));
    const equipped = collect(sim, "ItemEquipped");
    const tick = sim.tick;
    sim.enqueue({ type: "equip-item", uid: "i4" });
    sim.applyPendingCommands();
    expect(sim.tick).toBe(tick);
    expect(sim.domain.equipment.primary).toBe("i4");
    expect(equipped).toEqual([{ uid: "i4", slot: "primary", replaced: null }]);
    // Nothing is left for the next step, and an empty queue is a no-op.
    const before = sim.domain;
    sim.applyPendingCommands();
    expect(sim.domain).toBe(before);
  });

  it("ends in the same state as leaving the commands for the next step", () => {
    const early = withSmg();
    const late = withSmg();
    for (const sim of [early, late]) run(sim, 20, input({ moveZ: 1 }));
    for (const c of MENU) early.enqueue(c);
    early.applyPendingCommands();
    for (const c of MENU) late.enqueue(c);
    for (const sim of [early, late]) run(sim, 40, input({ moveX: 1, fire: true }));
    expect(early.domain.equipment.primary).toBe("i4");
    expect(early.domain.loot.containers).toHaveLength(1);
    expect(stateHash(early.snapshot(null, "t", ""))).toBe(stateHash(late.snapshot(null, "t", "")));
  });
});
