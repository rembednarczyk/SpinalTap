import { describe, expect, it } from "vitest";
import { changeReputation, contractPayout, createReputation, createWallet, credit, debit, isFactionId, reputationTier } from "../src";

describe("wallet", () => {
  it("credits and debits integer amounts", () => {
    const r = credit(createWallet(10), 5);
    expect(r).toEqual({ ok: true, wallet: { eddies: 15 } });
    expect(debit({ eddies: 15 }, 15)).toEqual({ ok: true, wallet: { eddies: 0 } });
  });

  it("rejects overdraft and invalid amounts", () => {
    expect(debit({ eddies: 1 }, 2)).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(credit({ eddies: 1 }, 0)).toEqual({ ok: false, reason: "invalid-amount" });
    expect(debit({ eddies: 1 }, 0.5)).toEqual({ ok: false, reason: "invalid-amount" });
  });

  it("scales contract payout with fixer reputation within ±50%", () => {
    expect(contractPayout(500, 0)).toBe(500);
    expect(contractPayout(500, 40)).toBe(600);
    expect(contractPayout(500, 1000)).toBe(750);
    expect(contractPayout(500, -1000)).toBe(250);
  });
});

describe("reputation", () => {
  it("clamps values to the allowed range", () => {
    const r = changeReputation(changeReputation(createReputation(), "hebi", -80), "hebi", -80);
    expect(r.hebi).toBe(-100);
    expect(r.fixers).toBe(0);
  });

  it("maps values to tiers", () => {
    expect(reputationTier(-60)).toBe("hostile");
    expect(reputationTier(-20)).toBe("wary");
    expect(reputationTier(0)).toBe("neutral");
    expect(reputationTier(30)).toBe("friendly");
    expect(reputationTier(80)).toBe("trusted");
  });

  it("guards faction ids", () => {
    expect(isFactionId("hebi")).toBe(true);
    expect(isFactionId("arasaka")).toBe(false);
  });
});
