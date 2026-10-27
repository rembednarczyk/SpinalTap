import { describe, expect, it } from "vitest";
import {
  CONTRACT_KIND_IDS,
  CYBERWARE_CATALOG,
  type ContractKind,
  EMPTY_CONTRACTS,
  ITEM_CATALOG,
  createReputation,
  generateContractOfKind,
} from "../src";
import { sequenceRng } from "./helpers";

/**
 * Balance guard rails from ADR-0018, at neutral standing and before experience grows the jobs.
 * If one of these fails, a price or a payout moved: update the ADR together with the numbers.
 */
const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 0, ticksPerSecond: 60 } as const;

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

describe("balance (ADR-0018)", () => {
  it("pay ranges per kind", () => {
    expect(Object.fromEntries(CONTRACT_KIND_IDS.map((k) => [k, payouts(k)]))).toEqual({
      eliminate: [500, 625],
      delivery: [250, 325, 400],
      retrieve: [470, 580],
      protect: [550, 675],
    });
  });

  it("jobs with a fight pay more than a delivery; protection, which can fail, pays the most", () => {
    const avg = Object.fromEntries(CONTRACT_KIND_IDS.map((k) => [k, mean(payouts(k))])) as Record<ContractKind, number>;
    expect(avg.delivery).toBeLessThan(avg.retrieve);
    expect(avg.retrieve).toBeLessThan(avg.eliminate);
    expect(avg.eliminate).toBeLessThan(avg.protect);
  });

  it("every implant costs one to two and a half average jobs", () => {
    const job = mean(CONTRACT_KIND_IDS.map((k) => mean(payouts(k))));
    for (const def of Object.values(CYBERWARE_CATALOG)) {
      if (def.price === 0) continue;
      expect(def.price / job).toBeGreaterThanOrEqual(0.95);
      expect(def.price / job).toBeLessThanOrEqual(2.5);
    }
    // The active ability is the big purchase: more than three average deliveries.
    expect(CYBERWARE_CATALOG.kairos_overclock.price).toBeGreaterThan(3 * mean(payouts("delivery")));
  });

  it("a medkit costs less than half of the cheapest job", () => {
    expect(ITEM_CATALOG.medkit.price).toBeLessThan(Math.min(...CONTRACT_KIND_IDS.flatMap(payouts)) / 2);
  });
});
