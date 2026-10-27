import { describe, expect, it } from "vitest";
import { EMPTY_EQUIPMENT, type InventoryState, addInstance, addStack, bagCells, compareItems, starterKit, usedCells } from "../src";

const kit = () => starterKit();

/** Starter kit plus loose pieces from loot. */
const withLoot = () => {
  const { inventory, equipment } = kit();
  let inv: InventoryState = inventory;
  for (const [def, rarity] of [
    ["hebi_smg", "uncommon"],
    ["oni44", "common"],
    ["ballistic_vest", "common"],
    ["holo_sight", "common"],
    ["baton", "common"],
  ] as const) {
    const r = addInstance(inv, equipment, def, rarity);
    if (!r.ok) throw new Error("full");
    inv = r.inventory;
  }
  return { inv, eq: equipment };
};

describe("bag cells", () => {
  it("lists loose pieces first, then stacks split by their stack size; as many as usedCells", () => {
    const { inv: base, eq } = withLoot();
    const inv = addStack(addStack(base, eq, "scrap", 25).inventory, eq, "bandage", 2).inventory;
    const cells = bagCells(inv, eq);
    expect(cells.length).toBe(usedCells(inv, eq));
    // Equipped pistol, jacket and pants take no cell.
    expect(cells.filter((c) => c.kind === "item").map((c) => (c.kind === "item" ? c.item.def : null))).toEqual(["hebi_smg", "oni44", "ballistic_vest", "holo_sight", "baton"]);
    expect(cells.filter((c) => c.kind === "stack")).toEqual([
      { kind: "stack", id: "medkit", qty: 1, total: 1 },
      { kind: "stack", id: "scrap", qty: 20, total: 25 },
      { kind: "stack", id: "scrap", qty: 5, total: 25 },
      { kind: "stack", id: "bandage", qty: 2, total: 2 },
    ]);
  });
});

describe("compareItems", () => {
  it("puts a looted SMG next to the empty primary slot", () => {
    const { inv, eq } = withLoot();
    const c = compareItems(inv, eq, { uid: "i4" })!;
    expect(c.slot).toBe("primary");
    expect(c.against).toBeNull();
    expect(c.equipped).toBe(false);
    const byKey = Object.fromEntries(c.lines.map((l) => [l.key, l]));
    expect(byKey.damage!.value).toBeCloseTo(9.72);
    expect(byKey.rate!.value).toBeCloseTo(600);
    expect(byKey.magazine!.value).toBe(30);
    expect(byKey.spread!.value).toBeCloseTo((0.06 * 0.92 * 180) / Math.PI);
    expect(byKey.range!.value).toBe(25);
    expect(c.lines.every((l) => l.current === null && l.trend === null)).toBe(true);
  });

  it("weighs a revolver against the pistol in hand: more damage, slower reload", () => {
    const { inv, eq } = withLoot();
    const c = compareItems(inv, eq, { uid: "i5" })!;
    expect(c.against).toBe("i1");
    const byKey = Object.fromEntries(c.lines.map((l) => [l.key, l]));
    expect(byKey.damage).toMatchObject({ value: 48, current: 22, trend: "better" });
    expect(byKey.reload).toMatchObject({ value: 2.4, current: 1.4, trend: "worse" });
    expect(byKey.spread!.trend).toBe("better");
    expect(byKey.magazine!.trend).toBe("worse");
  });

  it("shows the equipped piece on its own, and melee without magazine or spread", () => {
    const { inv, eq } = withLoot();
    const pistol = compareItems(inv, eq, { uid: "i1" })!;
    expect(pistol).toMatchObject({ slot: "secondary", against: null, equipped: true });
    expect(pistol.lines.every((l) => l.current === null)).toBe(true);
    const baton = compareItems(inv, eq, { uid: "i8" })!;
    expect(baton.lines.map((l) => l.key)).toEqual(["damage", "rate", "range"]);
  });

  it("compares garments zone by zone, counting a zone only one of them covers as 0", () => {
    const { inv, eq } = withLoot();
    const c = compareItems(inv, eq, { uid: "i6" })!;
    expect(c.against).toBe("i2");
    expect(c.lines).toEqual([
      { key: "armor-torso", value: 5, current: 1, trend: "better" },
      { key: "speed", value: -0.2, current: 0, trend: "worse" },
      { key: "armor-arm", value: 0, current: 1, trend: "worse" },
    ]);
  });

  it("reads condition, and treats a garment without one as new", () => {
    const { inv, eq } = withLoot();
    const worn: InventoryState = { ...inv, items: inv.items.map((i) => (i.uid === "i6" ? { ...i, condition: 0 } : i.uid === "i2" ? { uid: i.uid, def: i.def, rarity: i.rarity } : i)) };
    const c = compareItems(worn, eq, { uid: "i6" })!;
    expect(c.lines[0]).toMatchObject({ key: "armor-torso", value: 2.5, current: 1, trend: "better" });
    // Same jacket against itself: no trend.
    const twin = addInstance(worn, eq, "seki_jacket", "common");
    if (!twin.ok) throw new Error("full");
    expect(compareItems(twin.inventory, eq, { uid: twin.item.uid })!.lines.every((l) => l.trend === null)).toBe(true);
  });

  it("has no numbers for mods and junk, the heal for consumables, null for what is not there", () => {
    const { inv, eq } = withLoot();
    expect(compareItems(inv, eq, { uid: "i7" })).toEqual({ slot: null, against: null, equipped: false, lines: [] });
    expect(compareItems(inv, eq, { stack: "medkit" })!.lines).toEqual([{ key: "heal", value: 40, current: null, trend: null }]);
    const junk = addStack(inv, eq, "scrap", 3).inventory;
    expect(compareItems(junk, eq, { stack: "scrap" })!.lines).toEqual([]);
    expect(compareItems(inv, eq, { stack: "bandage" })).toBeNull();
    expect(compareItems(inv, eq, { uid: "i99" })).toBeNull();
    // A slot pointing at a missing piece compares with nothing.
    expect(compareItems(inv, { ...EMPTY_EQUIPMENT, secondary: "i99" }, { uid: "i5" })!.against).toBeNull();
  });
});
