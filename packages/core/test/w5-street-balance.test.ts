import { describe, expect, it } from "vitest";
import { CONSUMABLE_IDS, CONTRACT_SITES, ELIMINATION_SITE_IDS, SHOPS, STACKABLE_CATALOG, sellPrice, shopBuys, stockListPrice } from "../src";

/**
 * Balance guard rails of ADR-0026: the street food of Fumiko's stall heals cheaper per HP than
 * medical kit, but never as much at once, and it cannot be turned into money. The stashes
 * themselves are content (sim); their money is checked there.
 */
const perHp = (id: "medkit" | "bandage" | "ramen" | "yakitori"): number => STACKABLE_CATALOG[id].value / STACKABLE_CATALOG[id].heal;

describe("street food (ADR-0026)", () => {
  it("is a consumable sold by the ramen stall only", () => {
    expect(CONSUMABLE_IDS).toEqual(expect.arrayContaining(["ramen", "yakitori"]));
    expect(SHOPS.yatai.stock.map((e) => e.item)).toEqual(["ramen", "yakitori"]);
    for (const shop of ["clinic", "oyaji"] as const) expect(SHOPS[shop].stock.some((e) => e.item === "ramen" || e.item === "yakitori")).toBe(false);
  });

  it("heals cheaper per HP than a medkit or a bandage, and a meal heals less than a medkit", () => {
    for (const food of ["ramen", "yakitori"] as const) {
      expect(perHp(food)).toBeLessThan(perHp("bandage"));
      expect(perHp(food)).toBeLessThan(perHp("medkit"));
      expect(STACKABLE_CATALOG[food].heal).toBeLessThan(STACKABLE_CATALOG.medkit.heal);
    }
    // Bulky: a cell of ramen holds a third of a cell of medkits.
    expect(STACKABLE_CATALOG.ramen.stack).toBeLessThan(STACKABLE_CATALOG.medkit.stack);
  });

  it("cannot be sold back for a profit", () => {
    expect(SHOPS.yatai.buys).toEqual([]);
    for (const entry of SHOPS.yatai.stock) {
      if (entry.kind !== "stack") continue;
      expect(shopBuys("oyaji", entry.item)).toBe(true);
      expect(sellPrice({ def: entry.item })).toBeLessThan(stockListPrice(entry));
    }
  });
});

describe("the job under the footbridge (ADR-0026)", () => {
  it("joins Kaito's eliminations after the four M1 sites", () => {
    expect(ELIMINATION_SITE_IDS).toEqual(["east_lot", "koi_back", "car_wash", "south_gate", "kanal_bridge"]);
    expect(CONTRACT_SITES.kanal_bridge.label).toContain("kładką");
  });
});
