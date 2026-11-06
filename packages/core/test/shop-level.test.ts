import { describe, expect, it } from "vitest";
import {
  type ItemStockEntry,
  SHOP_RARITY_STEPS,
  type TradeState,
  buyStock,
  itemValue,
  repairQuote,
  sellPrice,
  shopTerms,
  starterKit,
  stockEntry,
  stockGrade,
  stockListPrice,
  stockPrice,
} from "../src";

const NEUTRAL = shopTerms(0);
const FRIENDLY = shopTerms(30);
const TRUSTED = shopTerms(80);

const entry = (item: string): ItemStockEntry => {
  const e = stockEntry("oyaji", item as ItemStockEntry["item"]);
  if (e?.kind !== "item") throw new Error(`no piece ${item}`);
  return e;
};

const state = (): TradeState => ({ wallet: { eddies: 10000 }, ...starterKit() });

describe("stock in the player's band (ADR-0059)", () => {
  it("is of the player's level, with a better tier for a regular, never past rare", () => {
    expect(SHOP_RARITY_STEPS).toMatchObject({ neutral: 0, friendly: 1, trusted: 2 });
    expect(stockGrade(entry("oni44"))).toEqual({ rarity: "common", level: 1 });
    expect(stockGrade(entry("oni44"), "neutral", 10)).toEqual({ rarity: "common", level: 10 });
    expect(stockGrade(entry("oni44"), "wary", 31)).toEqual({ rarity: "common", level: 30 });
    expect(stockGrade(entry("oni44"), "friendly", 4)).toEqual({ rarity: "uncommon", level: 4 });
    expect(stockGrade(entry("oni44"), "trusted", 4)).toEqual({ rarity: "rare", level: 4 });
    expect(stockGrade(entry("hebi_smg"), "trusted", 4)).toEqual({ rarity: "rare", level: 4 });
    // A mod has no level and keeps its tier: its effect does not change with it.
    expect(stockGrade(entry("suppressor"), "friendly", 9)).toEqual({ rarity: "common" });
    expect(stockGrade(entry("suppressor"), "trusted", 9)).toEqual({ rarity: "common" });
    // A piece listed above the top keeps its tier.
    expect(stockGrade({ kind: "item", item: "oni44", rarity: "epic" }, "trusted", 2)).toEqual({ rarity: "epic", level: 2 });
  });

  it("is priced by value × tier × level, then the terms", () => {
    expect(stockListPrice(entry("oni44"))).toBe(1300);
    expect(stockListPrice(entry("oni44"), "neutral", 10)).toBe(Math.round(1300 * 1.36));
    expect(stockListPrice(entry("oni44"), "friendly", 1)).toBe(2080);
    expect(stockListPrice(entry("suppressor"), "neutral", 30)).toBe(350);
    // A good standing makes a mod cheaper, never dearer (ADR-0011): 350, 315, 280.
    const mod = entry("suppressor");
    expect(stockPrice(mod, FRIENDLY, 9)).toBeLessThan(stockPrice(mod, NEUTRAL, 9));
    expect(stockPrice(mod, TRUSTED, 9)).toBeLessThan(stockPrice(mod, FRIENDLY, 9));
    expect([stockPrice(mod, NEUTRAL, 9), stockPrice(mod, FRIENDLY, 9), stockPrice(mod, TRUSTED, 9)]).toEqual([350, 315, 280]);
    expect(stockPrice(entry("oni44"))).toBe(1300);
    expect(stockPrice(entry("oni44"), FRIENDLY, 1)).toBe(Math.round(2080 * 0.9));
    expect(stockPrice(entry("oni44"), TRUSTED, 30)).toBe(Math.round(1300 * 2.6 * 2.16 * 0.8));
    // Rounds and stacks have no level.
    const box = stockEntry("oyaji", "9mm")!;
    expect(stockPrice(box, NEUTRAL, 30)).toBe(stockPrice(box, NEUTRAL, 1));
  });

  it("sells the piece it quotes: the same tier and level for the same price", () => {
    const r = buyStock(state(), "oyaji", "oni44", FRIENDLY, 12);
    if (!r.ok) throw new Error(r.reason);
    expect(r.added).toMatchObject({ def: "oni44", rarity: "uncommon", level: 12 });
    expect(r.price).toBe(stockPrice(entry("oni44"), FRIENDLY, 12));
    expect(r.wallet.eddies).toBe(10000 - r.price);
    const plain = buyStock(state(), "oyaji", "oni44");
    expect(plain.ok && plain.added).toMatchObject({ rarity: "common", level: 1 });
  });
});

describe("value of a levelled piece", () => {
  it("grows with the level for sale and repair; mods and stacks have none", () => {
    expect(itemValue({ def: "hebi_smg", rarity: "rare", level: 30 })).toBeCloseTo(700 * 2.6 * 2.16);
    expect(sellPrice({ def: "hebi_smg", rarity: "rare", level: 30 })).toBe(Math.floor(700 * 2.6 * 2.16 * 0.25));
    expect(sellPrice({ def: "hebi_smg", rarity: "rare" })).toBe(455);
    expect(sellPrice({ def: "suppressor", rarity: "common" })).toBe(87);
    expect(repairQuote({ def: "hebi_jacket", rarity: "common", level: 11, condition: 0 }, 0, 0).base).toBe(Math.ceil(600 * 1.4 * 0.3));
  });
});
