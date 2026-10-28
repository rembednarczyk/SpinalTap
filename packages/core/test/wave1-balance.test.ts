import { describe, expect, it } from "vitest";
import {
  CONTRACT_BONUS,
  CONTRACT_KIND_IDS,
  CYBERWARE_CATALOG,
  type ContractKind,
  EMPTY_CONTRACTS,
  FIXER_STYLE,
  CONTRACT_KINDS,
  STYLE_SHARE,
  createReputation,
  generateContractOfKind,
  styleBonusOf,
} from "../src";
import { sequenceRng } from "./helpers";

/**
 * Balance of the contract layer (ADR-0029): the bonus condition and the fixer's style add to a
 * job's pay without turning a clean run into a second job. If one of these fails, update the
 * ADR-0029 table together with the numbers.
 */
const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 0, ticksPerSecond: 60 } as const;

const meanPay = (kind: ContractKind): number => {
  const draws = [
    [0, 0],
    [0, 0.99],
    [0.5, 0],
    [0.99, 0.99],
  ];
  const pays = draws.map(([a = 0, b = 0]) => generateContractOfKind(kind, ctx, sequenceRng(a, b)).reward);
  return pays.reduce((s, p) => s + p, 0) / pays.length;
};

describe("balance of bonuses and style (ADR-0029)", () => {
  it("the bonus condition pays 10 to 25 percent of the job", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      const share = CONTRACT_BONUS[kind].bonus / meanPay(kind);
      expect(share, kind).toBeGreaterThanOrEqual(0.1);
      expect(share, kind).toBeLessThanOrEqual(0.25);
    }
  });

  it("a perfect run (bonus and both style badges) adds at most 40 percent", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      const pay = meanPay(kind);
      const style = FIXER_STYLE[CONTRACT_KINDS[kind].giver];
      const extra = CONTRACT_BONUS[kind].bonus + styleBonusOf(kind, style, pay);
      expect(extra / pay, kind).toBeLessThanOrEqual(0.4);
      expect(styleBonusOf(kind, style, pay)).toBeLessThanOrEqual(Math.ceil(pay * STYLE_SHARE * 2 / 5) * 5);
    }
  });

  it("no single perfect job buys an implant", () => {
    const cheapest = Math.min(...Object.values(CYBERWARE_CATALOG).map((c) => c.price).filter((p) => p > 0));
    for (const kind of CONTRACT_KIND_IDS) {
      const pay = meanPay(kind);
      const style = FIXER_STYLE[CONTRACT_KINDS[kind].giver];
      expect(CONTRACT_BONUS[kind].bonus + styleBonusOf(kind, style, pay), kind).toBeLessThan(cheapest / 2);
    }
  });
});
