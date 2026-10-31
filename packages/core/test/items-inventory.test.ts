import { describe, expect, it } from "vitest";
import {
  AMMO_CATALOG,
  BASE_CAPACITY,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type InventoryState,
  RARITY,
  STACKABLE_CATALOG,
  addAmmo,
  addInstance,
  addStack,
  ammoCount,
  bestRarity,
  equip,
  findItem,
  freeCells,
  isAmmoId,
  isConsumableId,
  isGarmentId,
  isInstanceDefId,
  isModId,
  isPlaced,
  isRarity,
  isStackableId,
  isWeaponId,
  itemSummary,
  newInstance,
  removeInstance,
  removeStack,
  setAmmo,
  slotFor,
  stackRoom,
  starterKit,
  unequip,
  updateItem,
  useConsumable,
  usedCells,
} from "../src";

const eq = EMPTY_EQUIPMENT;

/** `base` plus `n` loose mods, one cell each. */
const filled = (n: number, base: InventoryState = EMPTY_INVENTORY, equipment = eq): InventoryState => {
  let inv = base;
  for (let i = 0; i < n; i++) {
    const r = addInstance(inv, equipment, "suppressor", "common");
    if (!r.ok) throw new Error("full");
    inv = r.inventory;
  }
  return inv;
};

describe("rarity", () => {
  it("has fixed multipliers and a label key for every tier", () => {
    expect(RARITY.uncommon).toMatchObject({ damage: 1.08, spread: 0.92, armor: 1, value: 1.6, label: "inventory.rarity.uncommon" });
    expect(RARITY.rare).toMatchObject({ damage: 1.16, spread: 0.85, armor: 2, value: 2.6 });
    expect(isRarity("rare")).toBe(true);
    expect(isRarity("epic")).toBe(false);
    expect(isRarity(3)).toBe(false);
  });

  it("finds the rarest tier", () => {
    expect(bestRarity([])).toBeNull();
    expect(bestRarity(["common", "rare", "uncommon"])).toBe("rare");
    expect(bestRarity(["uncommon", "common"])).toBe("uncommon");
  });
});

describe("catalog guards", () => {
  it("tells item kinds apart", () => {
    expect(isWeaponId("unity9")).toBe(true);
    expect(isWeaponId("rocket")).toBe(false);
    expect(isGarmentId("hebi_jacket")).toBe(true);
    expect(isModId("suppressor")).toBe(true);
    expect(isAmmoId("9mm")).toBe(true);
    expect(isAmmoId(9)).toBe(false);
    expect(isStackableId("scrap")).toBe(true);
    expect(isConsumableId("bandage")).toBe(true);
    expect(isConsumableId("scrap")).toBe(false);
    expect(isConsumableId("nope")).toBe(false);
    expect(isInstanceDefId("steady_grip")).toBe(true);
    expect(isInstanceDefId("medkit")).toBe(false);
    expect(isInstanceDefId(null)).toBe(false);
  });

  it("summarises every kind of item", () => {
    expect(itemSummary("medkit")).toMatchObject({ name: "item.medkit.name", category: "consumable", value: 90 });
    expect(itemSummary("hebi_smg")).toMatchObject({ category: "weapon", value: 700 });
    expect(itemSummary("kevlar_pants")).toMatchObject({ category: "garment", value: 500 });
    expect(itemSummary("holo_sight")).toMatchObject({ category: "mod", value: 300 });
    expect(itemSummary("steady_grip")).toEqual({ name: "Stabilizator chwytu", category: "cyberware", value: 500 });
  });

  it("uses the plan's stack and pouch limits", () => {
    expect(STACKABLE_CATALOG.medkit.stack).toBe(9);
    expect(STACKABLE_CATALOG.scrap.stack).toBe(20);
    expect(STACKABLE_CATALOG.weapon_parts.stack).toBe(10);
    expect(STACKABLE_CATALOG.datachip.stack).toBe(5);
    expect(AMMO_CATALOG["9mm"].limit).toBe(180);
    expect(AMMO_CATALOG["12g"].limit).toBe(40);
  });
});

describe("starter kit", () => {
  it("is Unity-9 loaded, a jacket, cargo pants, one medkit and 48 rounds of 9 mm", () => {
    const kit = starterKit();
    expect(kit.inventory.items.map((i) => i.def)).toEqual(["unity9", "seki_jacket", "cargo_pants"]);
    expect(findItem(kit.inventory, "i1")).toMatchObject({ loaded: 12, rarity: "common", mods: {} });
    expect(findItem(kit.inventory, "i2")?.condition).toBe(100);
    expect(kit.equipment).toMatchObject({ secondary: "i1", torso: "i2", legs: "i3", primary: null, active: "secondary" });
    expect(kit.ammo).toEqual({ "9mm": 48 });
    expect(kit.inventory.nextUid).toBe(4);
    // Everything is worn, so only the medkit takes a cell.
    expect(usedCells(kit.inventory, kit.equipment)).toBe(1);
  });

  it("creates fresh pieces by kind", () => {
    expect(newInstance("i9", "hebi_smg", "rare")).toEqual({ uid: "i9", def: "hebi_smg", rarity: "rare", loaded: 0, mods: {} });
    expect(newInstance("i9", "moto_helmet", "common")).toEqual({ uid: "i9", def: "moto_helmet", rarity: "common", condition: 100 });
    expect(newInstance("i9", "steady_grip", "common")).toEqual({ uid: "i9", def: "steady_grip", rarity: "common" });
  });
});

describe("cells and stacks", () => {
  it("counts one cell per loose piece and per started stack", () => {
    const inv: InventoryState = { ...EMPTY_INVENTORY, stacks: { medkit: 10, scrap: 20 } };
    expect(usedCells(inv, eq)).toBe(3);
    expect(freeCells(inv, eq)).toBe(BASE_CAPACITY - 3);
  });

  it("fills the last started cell before taking new ones", () => {
    const inv = filled(BASE_CAPACITY - 1, { ...EMPTY_INVENTORY, stacks: { medkit: 7 } });
    expect(freeCells(inv, eq)).toBe(0);
    expect(stackRoom(inv, eq, "medkit")).toBe(2);
    expect(stackRoom(inv, eq, "scrap")).toBe(0);
    const r = addStack(inv, eq, "medkit", 5);
    expect(r.added).toBe(2);
    expect(r.inventory.stacks.medkit).toBe(9);
    expect(addStack(r.inventory, eq, "medkit", 1)).toEqual({ inventory: r.inventory, added: 0 });
  });

  it("a stack over its limit takes the next cell", () => {
    const r = addStack(EMPTY_INVENTORY, eq, "datachip", 7);
    expect(r.added).toBe(7);
    expect(usedCells(r.inventory, eq)).toBe(2);
  });

  it("ignores non-positive amounts", () => {
    expect(addStack(EMPTY_INVENTORY, eq, "scrap", 0).added).toBe(0);
    expect(addStack(EMPTY_INVENTORY, eq, "scrap", -3).added).toBe(0);
  });

  it("removes from a stack and drops the id at zero", () => {
    const inv: InventoryState = { ...EMPTY_INVENTORY, stacks: { scrap: 3 } };
    expect(removeStack(inv, "scrap", 2)?.stacks).toEqual({ scrap: 1 });
    expect(removeStack(inv, "scrap", 3)?.stacks).toEqual({});
    expect(removeStack(inv, "scrap", 4)).toBeNull();
    expect(removeStack(inv, "scrap", 0)).toBeNull();
  });
});

describe("instances", () => {
  it("adds with sequential uids and refuses a full bag", () => {
    const a = addInstance(EMPTY_INVENTORY, eq, "hebi_smg", "uncommon", { loaded: 30 });
    expect(a.ok && a.item).toMatchObject({ uid: "i1", loaded: 30, rarity: "uncommon" });
    const full = filled(BASE_CAPACITY);
    expect(addInstance(full, eq, "hebi_jacket", "common")).toEqual({ ok: false, reason: "inventory-full" });
  });

  it("removes loose pieces only", () => {
    const kit = starterKit();
    expect(removeInstance(kit.inventory, kit.equipment, "i1")).toEqual({ ok: false, reason: "in-use" });
    expect(removeInstance(kit.inventory, kit.equipment, "i99")).toEqual({ ok: false, reason: "not-found" });
    const added = addInstance(kit.inventory, kit.equipment, "baton", "common");
    if (!added.ok) throw new Error("full");
    const r = removeInstance(added.inventory, kit.equipment, added.item.uid);
    expect(r.ok && r.inventory.items).toHaveLength(3);
    const jacket = addInstance(kit.inventory, kit.equipment, "hebi_jacket", "common");
    if (!jacket.ok) throw new Error("full");
    expect(removeInstance(jacket.inventory, kit.equipment, jacket.item.uid)).toMatchObject({ ok: true, item: { def: "hebi_jacket" } });
  });

  it("refuses to drop a weapon with mods on it", () => {
    const inv: InventoryState = {
      ...EMPTY_INVENTORY,
      items: [
        { uid: "i1", def: "hebi_smg", rarity: "common", loaded: 0, mods: { muzzle: "i2" } },
        { uid: "i2", def: "suppressor", rarity: "common" },
      ],
    };
    expect(removeInstance(inv, eq, "i1")).toEqual({ ok: false, reason: "in-use" });
    expect(removeInstance(inv, eq, "i2")).toEqual({ ok: false, reason: "in-use" });
    expect(isPlaced(inv, eq, "i2")).toBe(true);
    expect(usedCells(inv, eq)).toBe(1);
  });

  it("updates one piece by uid", () => {
    const kit = starterKit();
    const inv = updateItem(kit.inventory, "i1", (i) => ({ ...i, loaded: 3 }));
    expect(findItem(inv, "i1")?.loaded).toBe(3);
    expect(findItem(inv, "i2")).toBe(findItem(kit.inventory, "i2"));
  });
});

describe("equip and unequip", () => {
  const withSmg = () => {
    const kit = starterKit();
    const r = addInstance(kit.inventory, kit.equipment, "hebi_smg", "common");
    if (!r.ok) throw new Error("full");
    return { ...kit, inventory: r.inventory, uid: r.item.uid };
  };

  it("knows the slot of every equippable piece", () => {
    expect(slotFor("hebi_smg")).toBe("primary");
    expect(slotFor("oni44")).toBe("secondary");
    expect(slotFor("baton")).toBe("melee");
    expect(slotFor("moto_helmet")).toBe("head");
    expect(slotFor("suppressor")).toBeNull();
  });

  it("puts a weapon into an empty slot", () => {
    const { inventory, equipment, uid } = withSmg();
    const r = equip(inventory, equipment, uid);
    expect(r).toEqual({ ok: true, slot: "primary", replaced: null, equipment: { ...equipment, primary: uid } });
    expect(r.ok && usedCells(inventory, r.equipment)).toBe(1);
  });

  it("swaps the worn piece back into the bag without needing room", () => {
    const kit = starterKit();
    let inv = filled(BASE_CAPACITY - 2, kit.inventory, kit.equipment);
    const added = addInstance(inv, kit.equipment, "hebi_jacket", "uncommon");
    if (!added.ok) throw new Error("full");
    inv = added.inventory;
    expect(freeCells(inv, kit.equipment)).toBe(0);
    const r = equip(inv, kit.equipment, added.item.uid, "torso");
    expect(r.ok && r.replaced).toBe("i2");
    expect(r.ok && freeCells(inv, r.equipment)).toBe(0);
  });

  it("explains refusals", () => {
    const { inventory, equipment, uid } = withSmg();
    expect(equip(inventory, equipment, "i99")).toEqual({ ok: false, reason: "not-found" });
    expect(equip(inventory, equipment, uid, "secondary")).toEqual({ ok: false, reason: "wrong-slot" });
    expect(equip(inventory, equipment, "i1")).toEqual({ ok: false, reason: "already-equipped" });
    const modded = addInstance(inventory, equipment, "holo_sight", "common");
    if (!modded.ok) throw new Error("full");
    expect(equip(modded.inventory, equipment, modded.item.uid)).toEqual({ ok: false, reason: "not-equippable" });
  });

  it("unequips into a free cell and keeps the active slot", () => {
    const kit = starterKit();
    const r = unequip(kit.inventory, kit.equipment, "secondary");
    expect(r).toEqual({ ok: true, uid: "i1", equipment: { ...kit.equipment, secondary: null } });
    expect(r.ok && r.equipment.active).toBe("secondary");
    expect(unequip(kit.inventory, kit.equipment, "primary")).toEqual({ ok: false, reason: "empty-slot" });
    const full = filled(BASE_CAPACITY - 1, kit.inventory, kit.equipment);
    expect(unequip(full, kit.equipment, "torso")).toEqual({ ok: false, reason: "inventory-full" });
  });
});

describe("consumables", () => {
  it("heals up to the maximum and uses one", () => {
    const kit = starterKit();
    const r = useConsumable(kit.inventory, "medkit", { current: 70, max: 100 });
    expect(r).toMatchObject({ ok: true, healed: 30, health: { current: 100, max: 100 } });
    expect(r.ok && r.inventory.stacks.medkit).toBeUndefined();
  });

  it("keeps it at full health and fails without one", () => {
    const kit = starterKit();
    expect(useConsumable(kit.inventory, "medkit", { current: 100, max: 100 })).toEqual({ ok: false, reason: "full-health" });
    expect(useConsumable(kit.inventory, "bandage", { current: 10, max: 100 })).toEqual({ ok: false, reason: "none" });
    const bandaged = { ...kit.inventory, stacks: { bandage: 2 } };
    expect(useConsumable(bandaged, "bandage", { current: 10, max: 100 })).toMatchObject({ ok: true, healed: 15 });
  });
});

describe("ammo pouch", () => {
  it("adds up to the limit per type", () => {
    expect(addAmmo({ "9mm": 170 }, "9mm", 30)).toEqual({ ammo: { "9mm": 180 }, added: 10 });
    const full = { "44": 48 };
    expect(addAmmo(full, "44", 5)).toEqual({ ammo: full, added: 0 });
    expect(ammoCount({}, "556")).toBe(0);
    expect(setAmmo({ "9mm": 3 }, "9mm", -1)).toEqual({ "9mm": 0 });
  });
});
