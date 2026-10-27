import { describe, expect, it } from "vitest";
import {
  CYBERWARE_CATALOG,
  FACTION_IDS,
  STANDARD_TERMS,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  buyCyberware,
  buyItem,
  changeReputation,
  contractPayout,
  createCharacter,
  createReputation,
  createWallet,
  credit,
  debit,
  factionStance,
  isFactionId,
  priceWithTerms,
  reputationEffects,
  reputationTier,
  shopTerms,
  stanceOf,
} from "../src";

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
    expect(isFactionId("clinic")).toBe(true);
    expect(isFactionId("arasaka")).toBe(false);
    expect(FACTION_IDS).toEqual(["fixers", "hebi", "civilians", "clinic"]);
    expect(Object.keys(createReputation())).toEqual([...FACTION_IDS]);
  });

  it("collapses tiers into three stances at ±10", () => {
    expect([-100, -50, -11].map(stanceOf)).toEqual(["hostile", "hostile", "hostile"]);
    expect([-10, 0, 10].map(stanceOf)).toEqual(["neutral", "neutral", "neutral"]);
    expect([11, 49, 100].map(stanceOf)).toEqual(["friendly", "friendly", "friendly"]);
    expect(factionStance({ ...createReputation(), hebi: 30 }, "hebi")).toBe("friendly");
  });

  it("killing a ganger angers the gang and unsettles the street", () => {
    expect(reputationEffects({ type: "member-killed", faction: "hebi" })).toEqual([
      { faction: "hebi", delta: -4 },
      { faction: "civilians", delta: -1 },
    ]);
  });

  it("killing anyone outside the gang costs far more", () => {
    expect(reputationEffects({ type: "member-killed", faction: "civilians" })).toEqual([{ faction: "civilians", delta: -25 }]);
    expect(reputationEffects({ type: "member-killed", faction: "clinic" })).toEqual([
      { faction: "clinic", delta: -25 },
      { faction: "civilians", delta: -10 },
    ]);
  });

  it("completed contracts please the fixers and the street, not the gang", () => {
    expect(reputationEffects({ type: "contract-completed" })).toEqual([
      { faction: "fixers", delta: 3 },
      { faction: "hebi", delta: -5 },
      { faction: "civilians", delta: 1 },
    ]);
  });

  it("the clinic rewards paying customers, implants more than consumables", () => {
    expect(reputationEffects({ type: "clinic-purchase", kind: "cyberware" })).toEqual([{ faction: "clinic", delta: 4 }]);
    expect(reputationEffects({ type: "clinic-purchase", kind: "item" })).toEqual([{ faction: "clinic", delta: 1 }]);
  });
});

describe("shop terms", () => {
  it("prices by the owner's standing and refuses hostile customers", () => {
    expect(shopTerms(-60)).toEqual({ open: false, multiplier: 1, tier: "hostile" });
    expect(shopTerms(-20)).toMatchObject({ open: true, multiplier: 1.25 });
    expect(shopTerms(0)).toEqual(STANDARD_TERMS);
    expect(shopTerms(20)).toMatchObject({ open: true, multiplier: 0.9 });
    expect(shopTerms(80)).toMatchObject({ open: true, multiplier: 0.8 });
  });

  it("rounds to whole eddies and keeps free items free", () => {
    expect(priceWithTerms(90, shopTerms(20))).toBe(81);
    expect(priceWithTerms(450, shopTerms(-20))).toBe(563);
    expect(priceWithTerms(0, shopTerms(-20))).toBe(0);
    expect(priceWithTerms(1, shopTerms(80))).toBe(1);
  });

  it("charges the adjusted price and refuses service when closed", () => {
    const c = createCharacter();
    const discounted = buyCyberware({ eddies: 2000 }, c, "subdermal_weave", shopTerms(80));
    expect(discounted).toMatchObject({ ok: true, price: priceWithTerms(CYBERWARE_CATALOG.subdermal_weave.price, shopTerms(80)) });
    expect(buyCyberware({ eddies: 99999 }, c, "subdermal_weave", shopTerms(-80))).toEqual({ ok: false, reason: "refused" });
    expect(buyItem({ eddies: 81 }, EMPTY_INVENTORY, EMPTY_EQUIPMENT, "medkit", shopTerms(20))).toMatchObject({ ok: true, wallet: { eddies: 0 }, inventory: { stacks: { medkit: 1 } }, price: 81 });
    expect(buyItem({ eddies: 99999 }, EMPTY_INVENTORY, EMPTY_EQUIPMENT, "medkit", shopTerms(-80))).toEqual({ ok: false, reason: "refused" });
  });
});
