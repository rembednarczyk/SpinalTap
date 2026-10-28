import { describe, expect, it } from "vitest";
import {
  CYBERWARE_CATALOG,
  type ContractKind,
  DOCKS_CONTRACT_KINDS,
  EMPTY_CONTRACTS,
  ENEMY_TYPES,
  LOOT_TABLES,
  STACKABLE_CATALOG,
  createReputation,
  generateContractOfKind,
} from "../src";
import { sequenceRng } from "./helpers";

/**
 * Balance guard rails from ADR-0018 (Shinsekai and the market) and ADR-0024 (the docks), at
 * neutral standing and before experience grows the jobs. If one of these fails, a price or a
 * payout moved: update the ADR tables together with the numbers.
 */
const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 0, ticksPerSecond: 60 } as const;

/** The jobs of Kaito and Hana (ADR-0018). */
const MARKET_KINDS: readonly ContractKind[] = ["eliminate", "delivery", "retrieve", "protect"];

/** Pay of every early variant of a kind (the generator's random draws at their extremes). */
const payouts = (kind: ContractKind): number[] => {
  const draws = [
    [0, 0],
    [0, 0.99],
    [0.5, 0],
    [0.99, 0.99],
  ];
  return [...new Set(draws.map(([a = 0, b = 0]) => generateContractOfKind(kind, ctx, sequenceRng(a, b)).reward))].sort((x, y) => x - y);
};

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const average = (kinds: readonly ContractKind[]) => mean(kinds.map((k) => mean(payouts(k))));

describe("balance (ADR-0018)", () => {
  it("pay ranges per kind", () => {
    expect(Object.fromEntries(MARKET_KINDS.map((k) => [k, payouts(k)]))).toEqual({
      eliminate: [500, 625],
      delivery: [250, 325, 400],
      retrieve: [470, 580],
      protect: [550, 675],
    });
  });

  it("jobs with a fight pay more than a delivery; protection, which can fail, pays the most", () => {
    const avg = Object.fromEntries(MARKET_KINDS.map((k) => [k, mean(payouts(k))])) as Record<ContractKind, number>;
    expect(avg.delivery).toBeLessThan(avg.retrieve);
    expect(avg.retrieve).toBeLessThan(avg.eliminate);
    expect(avg.eliminate).toBeLessThan(avg.protect);
  });

  it("every implant costs one to two and a half average jobs", () => {
    const job = average(MARKET_KINDS);
    for (const def of Object.values(CYBERWARE_CATALOG)) {
      if (def.price === 0) continue;
      expect(def.price / job).toBeGreaterThanOrEqual(0.95);
      expect(def.price / job).toBeLessThanOrEqual(2.5);
    }
    // The active ability is the big purchase: more than three average deliveries.
    expect(CYBERWARE_CATALOG.kairos_overclock.price).toBeGreaterThan(3 * mean(payouts("delivery")));
  });

  it("a medkit costs less than half of the cheapest job", () => {
    expect(STACKABLE_CATALOG.medkit.value).toBeLessThan(Math.min(...MARKET_KINDS.flatMap(payouts)) / 2);
  });
});

/** Rough minutes per job, the walk from the giver and back included (ADR-0024 table). */
const MINUTES: Readonly<Record<ContractKind, number>> = {
  eliminate: 2.5,
  delivery: 1.5,
  retrieve: 2.5,
  protect: 2.5,
  escort: 3,
  infiltrate: 3,
  hack: 3.5,
};

describe("balance in the docks (ADR-0024)", () => {
  it("pay ranges per kind", () => {
    expect(Object.fromEntries(DOCKS_CONTRACT_KINDS.map((k) => [k, payouts(k)]))).toEqual({
      escort: [580, 710],
      infiltrate: [620, 700],
      hack: [700, 820],
    });
  });

  it("a docks job pays a third to a half more than a market job, and more than any market average", () => {
    const docks = average(DOCKS_CONTRACT_KINDS);
    const market = average(MARKET_KINDS);
    expect(docks / market).toBeGreaterThanOrEqual(1.25);
    expect(docks / market).toBeLessThanOrEqual(1.5);
    const cheapest = Math.min(...DOCKS_CONTRACT_KINDS.map((k) => mean(payouts(k))));
    for (const k of MARKET_KINDS) expect(cheapest).toBeGreaterThan(mean(payouts(k)));
  });

  it("the hack, with a wave and a sniper, pays the most", () => {
    const hack = mean(payouts("hack"));
    for (const k of [...MARKET_KINDS, ...DOCKS_CONTRACT_KINDS]) if (k !== "hack") expect(mean(payouts(k))).toBeLessThan(hack);
  });

  it("income per minute stays in the ADR-0018 band wherever the job is", () => {
    for (const k of [...MARKET_KINDS, ...DOCKS_CONTRACT_KINDS]) {
      const perMinute = mean(payouts(k)) / MINUTES[k];
      expect(perMinute).toBeGreaterThanOrEqual(185);
      expect(perMinute).toBeLessThanOrEqual(265);
    }
  });

  it("any implant is at most two docks jobs; a medkit under a sixth of the cheapest", () => {
    const job = average(DOCKS_CONTRACT_KINDS);
    for (const def of Object.values(CYBERWARE_CATALOG)) expect(def.price / job).toBeLessThanOrEqual(2);
    expect(STACKABLE_CATALOG.medkit.value).toBeLessThan(Math.min(...DOCKS_CONTRACT_KINDS.flatMap(payouts)) / 6);
  });

  it("Tessen carry more than Hebi and are harder to put down", () => {
    const eddies = (id: keyof typeof LOOT_TABLES) => mean(LOOT_TABLES[id].eddies);
    expect(eddies("tessen_guard")).toBeGreaterThan(eddies("hebi_common"));
    expect(eddies("tessen_sniper")).toBeGreaterThan(eddies("hebi_common"));
    expect(ENEMY_TYPES.tessen_guard.hp).toBeGreaterThan(ENEMY_TYPES.hebi_ganger.hp);
    // The sniper is fragile: its threat is reach, not toughness.
    expect(ENEMY_TYPES.tessen_sniper.hp).toBeLessThan(ENEMY_TYPES.hebi_ganger.hp);
  });
});
