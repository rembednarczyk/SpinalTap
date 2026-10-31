import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  BASE_CYBER_CAPACITY,
  BUFF_CATALOG,
  CYBERWARE_CATALOG,
  type ContractKind,
  type CyberwareDefinition,
  type CyberwareSlot,
  EMPTY_CONTRACTS,
  GARMENT_CATALOG,
  MAX_AIM_STABILITY,
  SHARD_CYBER_CAPACITY,
  STACKABLE_CATALOG,
  capacityMax,
  createReputation,
  generateContractOfKind,
} from "../src";
import { sequenceRng } from "./helpers";

/**
 * Balance guard rails of ADR-0033: capacity makes the build a choice, buffs are felt in a
 * fight without replacing medical kit, disguises are no armour.
 */
const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 0, ticksPerSecond: 60 } as const;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pay = (kind: ContractKind): number => mean([0, 0.5, 0.99].map((r) => generateContractOfKind(kind, ctx, sequenceRng(r, r)).reward));
const marketJob = mean((["eliminate", "delivery", "retrieve", "protect"] as const).map(pay));

const implants: readonly CyberwareDefinition[] = Object.values(CYBERWARE_CATALOG);
/** The most capacity one implant per slot can take. */
const fullBuild = (): number => {
  const best = new Map<CyberwareSlot, number>();
  for (const d of implants) best.set(d.slot, Math.max(best.get(d.slot) ?? 0, d.capacity));
  return [...best.values()].reduce((a, b) => a + b, 0);
};

describe("cyberware capacity (ADR-0033)", () => {
  it("a fresh game fits the starting optics and one big implant, not two", () => {
    const optics = CYBERWARE_CATALOG.hitomi_optics_mk1.capacity;
    expect(optics + CYBERWARE_CATALOG.kairos_overclock.capacity).toBeLessThanOrEqual(BASE_CYBER_CAPACITY);
    expect(optics + CYBERWARE_CATALOG.kairos_overclock.capacity + CYBERWARE_CATALOG.tsubame_reflex.capacity).toBeGreaterThan(BASE_CYBER_CAPACITY);
  });

  it("the pool after the first district (level 10, ADR-0059) does not fit the fullest build: shards close the gap", () => {
    const steps = capacityMax(10, 0);
    expect(fullBuild()).toBeGreaterThan(steps);
    const shards = Math.ceil((fullBuild() - steps) / SHARD_CYBER_CAPACITY);
    expect(shards).toBeGreaterThanOrEqual(1);
    expect(shards).toBeLessThanOrEqual(3);
  });

  it("a shard costs about a market job; the perk implants are big purchases", () => {
    expect(STACKABLE_CATALOG.capacity_shard.value / marketJob).toBeGreaterThan(0.8);
    expect(STACKABLE_CATALOG.capacity_shard.value / marketJob).toBeLessThan(1.2);
    for (const id of ["kitsune_tendons", "tsubame_reflex"] as const) {
      expect(CYBERWARE_CATALOG[id].price).toBeGreaterThan(CYBERWARE_CATALOG.steady_grip.price);
      expect(CYBERWARE_CATALOG[id].capacity).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("buffs (ADR-0033)", () => {
  it("ramen heals more than a medkit over two minutes, but less at once and under 1 HP/s", () => {
    const regen = BUFF_CATALOG.regen;
    const total = STACKABLE_CATALOG.ramen.heal + regen.duration * (regen.regen ?? 0);
    expect(total).toBeGreaterThan(STACKABLE_CATALOG.medkit.heal);
    expect(total).toBeLessThanOrEqual(2.5 * STACKABLE_CATALOG.medkit.heal);
    expect(regen.regen ?? 0).toBeLessThan(1);
  });

  it("the coffee shortens the overdrive's cooldown but never makes it permanent", () => {
    const rate = BUFF_CATALOG.quick_cooldown.cooldownRate ?? 1;
    const def = ABILITY_CATALOG.reflex_overdrive;
    expect(rate).toBeGreaterThan(1);
    expect(def.cooldown / rate).toBeGreaterThan(2 * def.duration);
  });

  it("the stim steadies less than the grip implant and stays under the cap", () => {
    const steady = BUFF_CATALOG.steady.modifiers?.aimStability ?? 0;
    expect(steady).toBeGreaterThan(0);
    expect(steady).toBeLessThan(CYBERWARE_CATALOG.steady_grip.modifiers.aimStability);
    expect(steady).toBeLessThan(MAX_AIM_STABILITY);
  });

  it("a drink costs less than a medkit", () => {
    for (const id of ["synth_coffee", "steady_stim"] as const) expect(STACKABLE_CATALOG[id].value).toBeLessThan(STACKABLE_CATALOG.medkit.value);
  });
});

describe("disguises (ADR-0033)", () => {
  it("a uniform protects less than the armour it imitates", () => {
    const sum = (a: Readonly<Partial<Record<string, number>>>) => Object.values(a).reduce<number>((s, v) => s + (v ?? 0), 0);
    expect(sum(GARMENT_CATALOG.tessen_uniform.armor)).toBeLessThan(sum(GARMENT_CATALOG.tessen_vest.armor));
    expect(sum(GARMENT_CATALOG.tessen_overalls.armor)).toBeLessThan(sum(GARMENT_CATALOG.tessen_uniform.armor));
  });
});
