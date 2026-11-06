import { describe, expect, it } from "vitest";
import {
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type Equipment,
  type InventoryState,
  WEAPON_CATALOG,
  addInstance,
  compareItems,
  effectiveWeapon,
  garmentArmor,
  garmentModifiers,
  itemLine,
  newInstance,
  wearGarments,
  weaponStatsOf,
  wornGarments,
  wornOf,
} from "../src";

describe("weapon level and traits (ADR-0059)", () => {
  it("scales the damage by the level, on top of the rarity", () => {
    expect(effectiveWeapon("unity9", "common", [], { level: 1 }).damage).toBe(22);
    expect(effectiveWeapon("unity9", "common", [], { level: 30 }).damage).toBeCloseTo(22 * 2.16);
    expect(effectiveWeapon("unity9", "rare", [], { level: 10 }).damage).toBeCloseTo(22 * 1.16 * 1.36);
    // Without a grade it is the weapon of before.
    expect(effectiveWeapon("unity9", "rare")).toEqual(effectiveWeapon("unity9", "rare", [], { level: 1 }));
  });

  it("applies the traits as data: damage, spread, rate, draw, alert and reach", () => {
    const plain = effectiveWeapon("unity9", "epic");
    const t = (trait: Parameters<typeof effectiveWeapon>[3]) => effectiveWeapon("unity9", "epic", [], trait);
    expect(t({ traits: ["hot_loads"] }).damage).toBeCloseTo(plain.damage * 1.1);
    expect(t({ traits: ["match_barrel"] }).spread.base).toBeCloseTo(plain.spread.base * 0.85);
    expect(t({ traits: ["light_trigger"] }).interval).toBeCloseTo(0.28 * 0.92);
    expect(t({ traits: ["quick_draw"] }).drawTime).toBeCloseTo(0.4 * 0.7);
    expect(t({ traits: ["silenced"] }).alertRadius).toBe(10);
    expect(t({ traits: ["silenced"] }).damage).toBe(plain.damage);
    // A suppressor mod hushes it further; the trait never makes it louder.
    expect(effectiveWeapon("unity9", "epic", ["suppressor"], { traits: ["silenced"] }).alertRadius).toBe(8);
    const baton = effectiveWeapon("baton", "legendary", [], { traits: ["long_reach", "weighted"] });
    expect(baton.range).toBeCloseTo(WEAPON_CATALOG.baton.range + 0.25);
    expect(baton.damage).toBeCloseTo(30 * 1.32 * 1.12);
  });

  it("reads the level and traits off the instance", () => {
    const r = addInstance(EMPTY_INVENTORY, EMPTY_EQUIPMENT, "unity9", { rarity: "epic", level: 5, traits: ["hot_loads"] });
    if (!r.ok) throw new Error("no room");
    expect(weaponStatsOf(r.inventory, r.item.uid)!.damage).toBeCloseTo(22 * 1.24 * 1.16 * 1.1);
  });
});

describe("garment level and traits (ADR-0059)", () => {
  it("scales the armor by the level and adds a padded trait's on every zone it covers", () => {
    expect(garmentArmor({ def: "hebi_jacket", rarity: "common", condition: 100 }, "torso")).toBe(3);
    expect(garmentArmor({ def: "hebi_jacket", rarity: "common", condition: 100, level: 30 }, "torso")).toBeCloseTo(3 * 2.16);
    const padded = { def: "hebi_jacket" as const, rarity: "legendary" as const, condition: 100, level: 1, traits: ["durable" as const, "padded" as const] };
    expect(garmentArmor(padded, "torso")).toBe(3 + 4 + 1);
    expect(garmentArmor(padded, "arm")).toBe(2 + 1);
    expect(garmentArmor(padded, "leg")).toBe(0);
  });

  it("speeds the wearer up with a lightweight trait, as a stat modifier", () => {
    const worn = [
      { def: "ballistic_vest" as const, rarity: "legendary" as const, condition: 100, traits: ["lightweight" as const, "padded" as const] },
      { def: "cargo_pants" as const, rarity: "common" as const, condition: 100 },
    ];
    expect(garmentModifiers(worn)).toEqual([{ moveSpeed: -0.2 }, { moveSpeed: 0.1 }]);
  });

  it("wears a durable piece half as fast", () => {
    let inv: InventoryState = { ...EMPTY_INVENTORY, items: [{ ...newInstance("i1", "hebi_jacket", { rarity: "legendary", traits: ["padded", "durable"] }) }, newInstance("i2", "cargo_pants", "common")], nextUid: 3 };
    const eq: Equipment = { ...EMPTY_EQUIPMENT, torso: "i1", legs: "i2" };
    inv = wearGarments(inv, eq, "torso");
    inv = wearGarments(inv, eq, "leg");
    expect(inv.items.map((i) => i.condition)).toEqual([99, 98]);
  });

  it("is worn and compared with its level and traits", () => {
    const item = newInstance("i1", "hebi_jacket", { rarity: "rare", level: 6, traits: [] });
    expect(wornOf("hebi_jacket", item)).toEqual({ def: "hebi_jacket", rarity: "rare", condition: 100, level: 6 });
    expect(wornOf("hebi_jacket", { rarity: "common" })).toEqual({ def: "hebi_jacket", rarity: "common", condition: 100 });
    expect(wornOf("hebi_jacket", { rarity: "epic", condition: 40, traits: ["padded"] })).toEqual({ def: "hebi_jacket", rarity: "epic", condition: 40, traits: ["padded"] });
    const inv: InventoryState = { ...EMPTY_INVENTORY, items: [item, newInstance("i2", "hebi_jacket", { rarity: "rare", level: 1 })], nextUid: 3 };
    const eq: Equipment = { ...EMPTY_EQUIPMENT, torso: "i2" };
    expect(wornGarments(inv, eq)).toEqual([{ def: "hebi_jacket", rarity: "rare", condition: 100, level: 1 }]);
    // Same tier, higher level: the comparison shows the gain.
    const torso = compareItems(inv, eq, { uid: "i1" })!.lines.find((l) => l.key === "armor-torso")!;
    expect(torso.value).toBeCloseTo(5 * 1.2);
    expect(torso.current).toBe(5);
    expect(torso.trend).toBe("better");
  });
});

describe("a dropped piece's loot line", () => {
  it("keeps the tier, level and traits, nothing of its state", () => {
    expect(itemLine({ ...newInstance("i1", "unity9", { rarity: "epic", level: 9, traits: ["silenced"] }), loaded: 7 })).toEqual({
      kind: "item",
      item: "unity9",
      rarity: "epic",
      level: 9,
      traits: ["silenced"],
      qty: 1,
    });
    expect(itemLine(newInstance("i1", "holo_sight", "common"))).toEqual({ kind: "item", item: "holo_sight", rarity: "common", qty: 1 });
  });
});
