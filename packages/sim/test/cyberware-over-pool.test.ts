import { describe, expect, it } from "vitest";
import { type CyberwareLoadout, type DomainState, type ItemInstance, CYBERWARE_CATALOG } from "@seki/core";
import { SIM_DT, Simulation, cyberCapacityOf, gangerEntity, playerStatsOf } from "../src";
import { equippedAbility } from "../src/systems/ability-system";
import { collect, input, run, streetSim } from "./helpers";
import { patchDomain } from "./perk-scenes";

/*
 * Implants over the cyberware pool (ADR-0059, stage 3c): the ones that do not fit, in the fixed
 * order of the slots, give no stats, no perk and no ability, and work again as soon as room is
 * freed. A fresh game's pool is 12.
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game with these implants and `shards`, loaded through a snapshot; the street's AI removed. */
const simWith = (cyberware: CyberwareLoadout, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = streetSim({ seed: 21 });
  const snap = base.snapshot(null, "t", "");
  const domain = patch({ ...snap.domain, character: { ...snap.domain.character, cyberware } });
  const sim = Simulation.fromSnapshot({ ...snap, domain });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const shards = (n: number) => (d: DomainState): DomainState => ({ ...d, capacityShards: n });

/** Optics 2 + Synapse booster 5 + Kitsune tendons 6 = 13 over 12: the tendons (skeleton) come after the nervous slot. */
const LEGS_OVER: CyberwareLoadout = { optics: "hitomi_optics_mk1", nervous: "synapse_booster", skeleton: "kitsune_tendons" };

describe("the dash over the pool", () => {
  it("is off while the tendons do not fit, and back with a shard", () => {
    const sim = simWith(LEGS_OVER);
    expect(cyberCapacityOf(sim.domain)).toEqual({ used: 13, max: 12 });
    const dashes = collect(sim, "Dashed");
    run(sim, 5);
    sim.step(input({ dash: true, moveX: 1 }));
    expect(dashes).toEqual([]);
    // The tendons' walk speed is off too; the booster in front of them works.
    const stats = playerStatsOf(sim.domain);
    expect(stats.critMultiplier).toBeGreaterThan(playerStatsOf(simWith({ optics: "hitomi_optics_mk1" }).domain).critMultiplier);
    const speedOff = stats.moveSpeed;
    patchDomain(sim, shards(1));
    expect(playerStatsOf(sim.domain).moveSpeed).toBeCloseTo(speedOff + CYBERWARE_CATALOG.kitsune_tendons.modifiers.moveSpeed);
    run(sim, 2);
    sim.step(input({ dash: true, moveX: 1 }));
    expect(dashes).toHaveLength(1);
  });

  it("comes back when another implant comes out", () => {
    const sim = simWith(LEGS_OVER);
    const dashes = collect(sim, "Dashed");
    sim.enqueue({ type: "remove-cyberware", slot: "nervous" });
    run(sim, 5);
    sim.step(input({ dash: true, moveX: 1 }));
    expect(dashes).toHaveLength(1);
  });
});

describe("stats over the pool", () => {
  it("the subdermal weave over the pool gives no armour or health until it fits", () => {
    // Optics 2 + Kairos 7 + weave 4 = 13: the weave is off, the Kairos ability works.
    const over = simWith({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock", skeleton: "subdermal_weave" });
    const bare = simWith({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock" });
    expect(playerStatsOf(over.domain)).toEqual(playerStatsOf(bare.domain));
    expect(equippedAbility({ state: { domain: over.domain } } as Parameters<typeof equippedAbility>[0])?.id).toBe("reflex_overdrive");
    const fits = simWith({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock", skeleton: "subdermal_weave" }, shards(1));
    expect(playerStatsOf(fits.domain).armor - playerStatsOf(bare.domain).armor).toBe(CYBERWARE_CATALOG.subdermal_weave.modifiers.armor);
  });
});

describe("the deflect over the pool", () => {
  /** A drawn blade held up in guard against an SMG 7 m north, for two seconds. */
  const duel = (cyberware: CyberwareLoadout, patch: (d: DomainState) => DomainState) => {
    const sim = simWith(cyberware, (d) => {
      const blade: ItemInstance = { uid: "i9", def: "shirasaya", rarity: "common" };
      return patch({ ...d, inventory: { ...d.inventory, items: [...d.inventory.items, blade], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } });
    });
    const p = sim.player()!;
    p.yaw = 0;
    p.pitch = 0;
    const e = gangerEntity(4000, { key: "shooter", position: { x: p.position.x, y: p.position.y, z: p.position.z + 7 }, yaw: Math.PI }, null, 5000, p.chunk ?? "", undefined, "hebi_ganger");
    e.ai!.alerted = true;
    sim.world.add(e);
    const back = collect(sim, "ProjectileReflected");
    run(sim, ticks(2.4), input({ aim: true }));
    return back;
  };

  // Optics 2 + Kairos 7 + Tsubame 8 = 17 over 12: the arms come last and are off.
  const ARMS_OVER: CyberwareLoadout = { optics: "hitomi_optics_mk1", nervous: "kairos_overclock", arms: "tsubame_reflex" };

  it("sends nothing back while the Tsubame reflex is over the pool, and does once it fits", () => {
    expect(duel(ARMS_OVER, (d) => d)).toEqual([]);
    expect(duel(ARMS_OVER, shards(3)).length).toBeGreaterThan(0);
  });
});
