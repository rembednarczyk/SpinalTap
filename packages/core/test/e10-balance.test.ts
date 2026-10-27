import { describe, expect, it } from "vitest";
import {
  BACKPACK_PRICES,
  type ContractKind,
  EMPTY_CONTRACTS,
  LOOT_TABLES,
  type LootEntry,
  MOD_CATALOG,
  type Rarity,
  SHOPS,
  STANDARD_TERMS,
  createReputation,
  generateContractOfKind,
  isAmmoId,
  sellPrice,
  shopBuys,
  stockListPrice,
} from "../src";
import { sequenceRng } from "./helpers";

/**
 * Loot against contract pay (plan §6, E10), worked out analytically from the tables: no random
 * runs. Everything a ganger drops is valued at what Oyaji pays for it at neutral standing;
 * rounds go into the pouch and count as nothing. Target: the loot of a job's gangers is 20 to
 * 30% of what the job pays, so searching bags is worth it but does not replace contracts.
 */

const ROLLED: readonly [Rarity, number][] = [
  ["common", 0.75],
  ["uncommon", 0.2],
  ["rare", 0.05],
];

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Expected cash from one entry when it is drawn. */
const entryCash = (e: LootEntry): number => {
  if (isAmmoId(e.item) || !shopBuys("oyaji", e.item)) return 0;
  const qty = (e.qty[0] + e.qty[1]) / 2;
  const item = e.item;
  if (e.rarity === "roll") return qty * ROLLED.reduce((s, [rarity, p]) => s + p * sellPrice({ def: item, rarity }, STANDARD_TERMS), 0);
  return qty * sellPrice({ def: item, rarity: e.rarity ?? "common" }, STANDARD_TERMS);
};

/** Expected cash a Hebi ganger's bag brings at Oyaji's stall. */
const gangerLootCash = (): number => {
  const table = LOOT_TABLES.hebi_common;
  const total = table.entries.reduce((s, e) => s + e.weight, 0);
  const drawn = table.entries.reduce((s, e) => s + (e.weight / total) * entryCash(e), 0);
  return mean(table.eddies) + table.guaranteed.reduce((s, e) => s + entryCash(e), 0) + table.rolls * drawn;
};

const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 0, ticksPerSecond: 60 } as const;

/** The early variants of a job with a fight: the generator's draws at their extremes (as in m4-balance). */
const variants = (kind: ContractKind) =>
  [
    [0, 0],
    [0, 0.99],
    [0.5, 0],
    [0.99, 0.99],
  ].map(([a = 0, b = 0]) => generateContractOfKind(kind, ctx, sequenceRng(a, b)));

const lootShare = (kind: ContractKind): number => mean(variants(kind).map((c) => (c.targets * gangerLootCash()) / c.reward));

describe("loot and contract pay (E10)", () => {
  it("a ganger's bag is worth about 50 €$ in cash", () => {
    expect(gangerLootCash()).toBeCloseTo(50.6, 1);
  });

  it("the loot of a job's gangers is 20 to 30% of its pay, for every kind with a fight", () => {
    for (const kind of ["eliminate", "retrieve", "protect"] as const) {
      expect(lootShare(kind), kind).toBeGreaterThanOrEqual(0.2);
      expect(lootShare(kind), kind).toBeLessThanOrEqual(0.3);
    }
  });

  it("the plan's example: three targets for 625 €$ leave loot for about 24% of the pay", () => {
    expect((3 * gangerLootCash()) / 625).toBeCloseTo(0.243, 2);
  });

  it("purchases at the stall fit between the jobs", () => {
    const job = mean((["eliminate", "delivery", "retrieve", "protect"] as const).flatMap((k) => variants(k).map((c) => c.reward)));
    // Mods fill the gaps between big purchases; the first backpack is one job, the second two.
    for (const mod of Object.values(MOD_CATALOG)) expect(mod.value).toBeLessThan(job);
    expect(BACKPACK_PRICES[0]! / job).toBeGreaterThan(1);
    expect(BACKPACK_PRICES[0]! / job).toBeLessThan(1.5);
    expect(BACKPACK_PRICES[1]! / job).toBeLessThan(2.5);
    // A box of rounds costs less than what one ganger's bag brings.
    for (const e of SHOPS.oyaji.stock) if (e.kind === "ammo") expect(stockListPrice(e)).toBeLessThan(gangerLootCash());
  });
});
