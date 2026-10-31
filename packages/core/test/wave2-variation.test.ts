import { describe, expect, it } from "vitest";
import {
  CONTRACT_KIND_IDS,
  type Contract,
  type ContractVariation,
  KIND_MODIFIERS,
  PLAIN_VARIATION,
  TIME_LIMIT_SECONDS,
  VARIATION_PAY_MAX,
  VARIATION_PAY_MIN,
  applyVariation,
  contractFailureNote,
  rollContractVariation,
  variationDifficulty,
  variationPayFactor,
} from "../src";

/** A tiny deterministic stream for the tests (an LCG, not the game's generator). */
const stream = (seed: number) => {
  let s = seed >>> 0;
  return { next: () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32) };
};

const job: Contract = { id: "c3", kind: "eliminate", siteId: "east_lot", targets: 3, reward: 625, status: "active" };

describe("contract variations (ADR-0034)", () => {
  it("consumes six numbers whatever it rolls", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      let n = 0;
      const counting = { next: () => (n++, 0.5) };
      rollContractVariation(kind, "east_lot", counting);
      expect(n).toBe(6);
    }
  });

  it("rolls only what the kind can take, at most two modifiers, and a drinker only near the bar", () => {
    const rng = stream(7);
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const kind = CONTRACT_KIND_IDS[i % CONTRACT_KIND_IDS.length]!;
      const site = i % 2 === 0 ? "kanal_bridge" : "east_lot";
      const v = rollContractVariation(kind, site, rng);
      for (const m of v.modifiers) expect(KIND_MODIFIERS[kind]).toContain(m);
      // Twist forces a look-alike on top of the two rolled.
      expect(v.modifiers.length).toBeLessThanOrEqual(v.twist === "wrong_target" ? 3 : 2);
      expect(new Set(v.modifiers).size).toBe(v.modifiers.length);
      expect(v.modifiers.includes("night_only") && v.modifiers.includes("time_limit")).toBe(false);
      if (v.trait === "drinker") expect(site).toBe("east_lot");
      if (v.twist === "wrong_target") expect(v.modifiers).toContain("twin");
      if (kind === "delivery") expect(v).toEqual(PLAIN_VARIATION);
      seen.add(`${kind}:${v.modifiers.join("+")}:${v.security}:${v.trait ?? ""}:${v.twist ?? ""}`);
    }
    // Plenty of different plans come out of the axes.
    expect(seen.size).toBeGreaterThan(150);
  });

  it("pays more for a harder plan, within the band, and about a fifth more on average", () => {
    const hard: ContractVariation = { modifiers: ["bodyguards", "ambush"], security: "lockdown", trait: "armored", twist: "setup" };
    const soft: ContractVariation = { modifiers: [], security: "light", trait: "drinker" };
    expect(variationDifficulty(PLAIN_VARIATION)).toBe(0);
    expect(variationPayFactor(hard)).toBe(VARIATION_PAY_MAX);
    expect(variationPayFactor(soft)).toBeCloseTo(0.8);
    expect(variationPayFactor({ modifiers: ["twin"], security: "standard" })).toBeGreaterThan(variationPayFactor(PLAIN_VARIATION));
    const rng = stream(11);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 5000; i++) {
      const f = variationPayFactor(rollContractVariation("eliminate", "east_lot", rng));
      expect(f).toBeGreaterThanOrEqual(VARIATION_PAY_MIN);
      expect(f).toBeLessThanOrEqual(VARIATION_PAY_MAX);
      sum += f;
      n++;
    }
    // Balance: an elimination pays on average 10-30 % more than before wave 2, never double.
    expect(sum / n).toBeGreaterThan(1.1);
    expect(sum / n).toBeLessThan(1.3);
  });

  it("applies the guard count, the pay and the deadline", () => {
    const v: ContractVariation = { modifiers: ["time_limit"], security: "lockdown" };
    const c = applyVariation(job, v, 100, 60);
    expect(c).toMatchObject({ targets: 4, reward: Math.round(625 * 1.5), deadlineTick: 100 + TIME_LIMIT_SECONDS * 60, variation: v });
    expect(applyVariation({ ...job, targets: 1 }, { modifiers: [], security: "light" }, 0, 60).targets).toBe(1);
    expect(applyVariation({ ...job, targets: 6 }, { modifiers: [], security: "lockdown" }, 0, 60).targets).toBe(6);
    // A delivery keeps its own clock and no guards.
    const delivery: Contract = { id: "c1", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 300, status: "active", deadlineTick: 50 };
    expect(applyVariation(delivery, PLAIN_VARIATION, 0, 60)).toMatchObject({ targets: 0, deadlineTick: 50, reward: 300 });
  });

  it("tells a missed deadline of a job from a late package", () => {
    expect(contractFailureNote("timeout")).toBe("contract.failure.timeout");
    expect(contractFailureNote("timeout", "eliminate")).toBe("contract.failure.deadline");
  });
});
