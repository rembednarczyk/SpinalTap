import { describe, expect, it } from "vitest";
import {
  BASE_STATS,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type InventoryState,
  WEAR_PER_HIT,
  ZONE_ARMOR_CAP,
  ZONE_MULTIPLIERS,
  addInstance,
  conditionFactor,
  defenseOf,
  effectiveWeapon,
  findItem,
  garmentArmor,
  garmentModifiers,
  holsterTime,
  installMod,
  mountedMods,
  npcWeapon,
  outfitDefense,
  reloadPlan,
  removeMod,
  resolveAttack,
  starterKit,
  usesAmmo,
  wearGarments,
  weaponStatsOf,
  wornGarments,
  zoneArmor,
} from "../src";

const noCrit = { next: () => 0.99 };
const hit = (damage: number, defender: ReturnType<typeof outfitDefense>, zone: "head" | "torso" | "arm" | "leg") =>
  resolveAttack({ damage, critChance: 0, critMultiplier: 2, damageBonus: 0 }, defender, noCrit, zone).damage;

const GANGER = outfitDefense(["hebi_jacket", "cargo_pants"]);

describe("acceptance numbers (plan §9, E2)", () => {
  it("Unity-9 into a ganger: 19 on the torso, 44 on the bare head", () => {
    const unity = effectiveWeapon("unity9", "common");
    expect(hit(unity.damage, GANGER, "torso")).toBe(19);
    // ADR-0016 keeps the head at ×2.0 for every weapon (the plan's ×1.6 would give 35).
    expect(hit(unity.damage, GANGER, "head")).toBe(44);
  });

  it("the ganger's SMG into a player with no clothes deals 5", () => {
    const smg = npcWeapon("hebi_smg");
    expect(smg).toMatchObject({ damage: 7, interval: 0.9, range: 18, magazine: 30, reload: 2 });
    expect(hit(smg.damage, defenseOf(BASE_STATS, []), "torso")).toBe(5);
  });

  it("the ganger outfit is the Hebi jacket: torso 3, arms 2, legs 1, head 0", () => {
    expect(GANGER.zoneArmor).toEqual({ head: 0, torso: 3, arm: 2, leg: 1 });
  });
});

describe("effective weapon", () => {
  it("is the definition for a common weapon without mods", () => {
    expect(effectiveWeapon("unity9", "common")).toMatchObject({ damage: 22, magazine: 12, reload: 1.4, interval: 0.28, alertRadius: 22, zones: ZONE_MULTIPLIERS });
    expect(effectiveWeapon("raijin12", "common")).toMatchObject({ pellets: 9, reloadMode: "per-round", zones: { head: 1.25 } });
  });

  it("applies rarity to damage and base spread", () => {
    const rare = effectiveWeapon("hebi_smg", "rare");
    expect(rare.damage).toBeCloseTo(9 * 1.16);
    expect(rare.spread.base).toBeCloseTo(0.06 * 0.85);
    expect(rare.spread.bloomPerShot).toBe(0.025);
  });

  it("applies mods", () => {
    const full = effectiveWeapon("unity9", "common", ["suppressor", "holo_sight", "extended_mag"]);
    expect(full.damage).toBeCloseTo(22 * 0.95);
    expect(full.alertRadius).toBe(8);
    expect(full.spread.base).toBeCloseTo(0.02 * 0.8);
    expect(full.magazine).toBe(18);
    expect(full.reload).toBeCloseTo(1.4 * 1.15);
    expect(effectiveWeapon("hebi_smg", "common", ["extended_mag"]).magazine).toBe(45);
    expect(effectiveWeapon("raijin12", "common", ["extended_mag"]).magazine).toBe(8);
  });

  it("NPCs without a profile use the plain weapon", () => {
    expect(npcWeapon("tessen_ar5")).toEqual(effectiveWeapon("tessen_ar5", "common"));
    expect(npcWeapon("unity9")).toMatchObject({ damage: 14, interval: 1.1 });
  });

  it("holsters in half the draw time; melee has no ammo", () => {
    expect(holsterTime(effectiveWeapon("hebi_smg", "common"))).toBeCloseTo(0.275);
    expect(usesAmmo(effectiveWeapon("baton", "common"))).toBe(false);
    expect(usesAmmo(effectiveWeapon("unity9", "common"))).toBe(true);
  });
});

describe("weapons in the inventory", () => {
  const modded = (): InventoryState => ({
    ...EMPTY_INVENTORY,
    items: [
      { uid: "i1", def: "unity9", rarity: "uncommon", loaded: 18, mods: { magazine: "i2" } },
      { uid: "i2", def: "extended_mag", rarity: "common" },
      { uid: "i3", def: "holo_sight", rarity: "common" },
      { uid: "i4", def: "hebi_jacket", rarity: "common", condition: 100 },
      { uid: "i5", def: "raijin12", rarity: "common", loaded: 0, mods: {} },
      { uid: "i6", def: "suppressor", rarity: "common" },
    ],
    nextUid: 7,
  });

  it("resolves stats with mounted mods", () => {
    const inv = modded();
    expect(mountedMods(inv, "i1")).toEqual(["extended_mag"]);
    expect(mountedMods(inv, "i4")).toEqual([]);
    expect(mountedMods(inv, "i99")).toEqual([]);
    expect(mountedMods({ ...inv, items: [{ uid: "i1", def: "unity9", rarity: "common", mods: { sight: "gone" } }] }, "i1")).toEqual([]);
    expect(weaponStatsOf(inv, "i1")?.magazine).toBe(18);
    expect(weaponStatsOf(inv, "i4")).toBeNull();
    expect(weaponStatsOf(inv, "i99")).toBeNull();
    expect(weaponStatsOf(inv, null)).toBeNull();
  });

  it("installs a compatible mod and returns the one it replaces", () => {
    const inv = modded();
    const r = installMod(inv, EMPTY_EQUIPMENT, "i1", "i3");
    expect(r).toMatchObject({ ok: true, slot: "sight", replaced: null });
    expect(r.ok && findItem(r.inventory, "i1")?.mods).toEqual({ magazine: "i2", sight: "i3" });
    const withSecond: InventoryState = { ...inv, items: [...inv.items, { uid: "i7", def: "extended_mag", rarity: "rare" }] };
    expect(installMod(withSecond, EMPTY_EQUIPMENT, "i1", "i7")).toMatchObject({ ok: true, replaced: "i2" });
  });

  it("refuses incompatible, missing and mounted mods", () => {
    const inv = modded();
    expect(installMod(inv, EMPTY_EQUIPMENT, "i1", "i99")).toEqual({ ok: false, reason: "not-found" });
    expect(installMod(inv, EMPTY_EQUIPMENT, "i99", "i3")).toEqual({ ok: false, reason: "not-found" });
    expect(installMod(inv, EMPTY_EQUIPMENT, "i4", "i3")).toEqual({ ok: false, reason: "incompatible" });
    expect(installMod(inv, EMPTY_EQUIPMENT, "i1", "i4")).toEqual({ ok: false, reason: "incompatible" });
    expect(installMod(inv, EMPTY_EQUIPMENT, "i5", "i6")).toEqual({ ok: false, reason: "incompatible" });
    expect(installMod(inv, EMPTY_EQUIPMENT, "i5", "i2")).toEqual({ ok: false, reason: "in-use" });
  });

  it("removing the extended magazine sends the extra rounds to the pouch", () => {
    const r = removeMod(modded(), EMPTY_EQUIPMENT, "i1", "magazine");
    expect(r).toMatchObject({ ok: true, modUid: "i2", excess: 6 });
    expect(r.ok && findItem(r.inventory, "i1")).toMatchObject({ loaded: 12, mods: {} });
    const light = { ...modded(), items: modded().items.map((i) => (i.uid === "i1" ? { ...i, loaded: 4 } : i)) };
    expect(removeMod(light, EMPTY_EQUIPMENT, "i1", "magazine")).toMatchObject({ ok: true, excess: 0 });
    const noLoad = { ...modded(), items: modded().items.map((i) => (i.uid === "i1" ? { uid: "i1", def: "unity9" as const, rarity: "common" as const, mods: { magazine: "i2" } } : i)) };
    expect(removeMod(noLoad, EMPTY_EQUIPMENT, "i1", "magazine")).toMatchObject({ ok: true, excess: 0 });
  });

  it("refuses to remove a missing mod or into a full bag", () => {
    const inv = modded();
    expect(removeMod(inv, EMPTY_EQUIPMENT, "i99", "sight")).toEqual({ ok: false, reason: "not-found" });
    expect(removeMod(inv, EMPTY_EQUIPMENT, "i4", "sight")).toEqual({ ok: false, reason: "incompatible" });
    expect(removeMod(inv, EMPTY_EQUIPMENT, "i1", "sight")).toEqual({ ok: false, reason: "empty-slot" });
    expect(removeMod(inv, EMPTY_EQUIPMENT, "i5", "sight")).toEqual({ ok: false, reason: "empty-slot" });
    expect(removeMod({ ...inv, capacity: 4 }, EMPTY_EQUIPMENT, "i1", "magazine")).toEqual({ ok: false, reason: "inventory-full" });
  });
});

describe("reload plan", () => {
  const unity = effectiveWeapon("unity9", "common");
  const raijin = effectiveWeapon("raijin12", "common");

  it("refills the magazine and returns the old rounds to the reserve", () => {
    expect(reloadPlan(unity, 0, 48)).toEqual({ duration: 1.4, loaded: 12, reserve: 36 });
    expect(reloadPlan(unity, 5, 48)).toEqual({ duration: 1.4, loaded: 12, reserve: 41 });
    expect(reloadPlan(unity, 2, 4)).toEqual({ duration: 1.4, loaded: 6, reserve: 0 });
  });

  it("loads a shotgun one round at a time", () => {
    expect(reloadPlan(raijin, 3, 10)).toEqual({ duration: 0.5, loaded: 4, reserve: 9 });
  });

  it("has nothing to do when full, empty-handed or out of ammo", () => {
    expect(reloadPlan(unity, 12, 48)).toBeNull();
    expect(reloadPlan(unity, 3, 0)).toBeNull();
    expect(reloadPlan(effectiveWeapon("baton", "common"), 0, 10)).toBeNull();
  });
});

describe("zone armor", () => {
  const kit = starterKit();
  const worn = wornGarments(kit.inventory, kit.equipment);

  it("the starter clothes cover torso, arms and legs", () => {
    expect(worn.map((g) => g.def)).toEqual(["seki_jacket", "cargo_pants"]);
    expect(zoneArmor(BASE_STATS, worn, "torso")).toBe(3);
    expect(zoneArmor(BASE_STATS, worn, "arm")).toBe(3);
    expect(zoneArmor(BASE_STATS, worn, "leg")).toBe(3);
    expect(zoneArmor(BASE_STATS, worn, "head")).toBe(2);
    expect(zoneArmor({ armor: 2, headArmor: 3 }, worn, "head")).toBe(5);
  });

  it("is capped and scales with condition and rarity", () => {
    expect(zoneArmor({ armor: 6, headArmor: 0 }, [{ def: "ballistic_vest", rarity: "rare", condition: 100 }], "torso")).toBe(ZONE_ARMOR_CAP);
    expect(conditionFactor(0)).toBe(0.5);
    expect(conditionFactor(100)).toBe(1);
    expect(conditionFactor(150)).toBe(1);
    expect(garmentArmor({ def: "hebi_jacket", rarity: "uncommon", condition: 0 }, "torso")).toBe(2);
    expect(garmentArmor({ def: "hebi_jacket", rarity: "uncommon", condition: 100 }, "arm")).toBe(2);
    expect(garmentArmor({ def: "hebi_jacket", rarity: "rare", condition: 100 }, "head")).toBe(0);
  });

  it("skips missing pieces and assumes mint condition when none is stored", () => {
    const eq = { ...EMPTY_EQUIPMENT, head: "i9", torso: "i1", legs: "i2" };
    const inv: InventoryState = {
      ...EMPTY_INVENTORY,
      items: [
        { uid: "i1", def: "hebi_jacket", rarity: "common" },
        { uid: "i2", def: "unity9", rarity: "common" },
      ],
    };
    expect(wornGarments(inv, eq)).toEqual([{ def: "hebi_jacket", rarity: "common", condition: 100 }]);
  });

  it("vests slow the wearer", () => {
    expect(garmentModifiers([{ def: "ballistic_vest", rarity: "common", condition: 100 }, ...worn])).toEqual([{ moveSpeed: -0.2 }]);
  });

  it("a hit wears the pieces that cover the zone", () => {
    const inv = wearGarments(kit.inventory, kit.equipment, "arm");
    expect(findItem(inv, "i2")?.condition).toBe(100 - WEAR_PER_HIT);
    expect(findItem(inv, "i3")?.condition).toBe(100);
    expect(wearGarments(kit.inventory, kit.equipment, "head")).toBe(kit.inventory);
  });

  it("stops at zero and ignores broken references", () => {
    const eq = { ...EMPTY_EQUIPMENT, torso: "i1", legs: "i2" };
    const inv: InventoryState = {
      ...EMPTY_INVENTORY,
      items: [
        { uid: "i1", def: "hebi_jacket", rarity: "common", condition: 1 },
        { uid: "i2", def: "cargo_pants", rarity: "common" },
      ],
    };
    const once = wearGarments(inv, eq, "torso");
    expect(findItem(once, "i1")?.condition).toBe(0);
    expect(wearGarments(once, eq, "torso")).toBe(once);
    expect(wearGarments(inv, eq, "leg")).toBe(inv);
    expect(wearGarments(inv, { ...eq, torso: "gone" }, "torso")).toBe(inv);
  });

  it("an extra piece added by loot does not change what is worn", () => {
    const r = addInstance(kit.inventory, kit.equipment, "moto_helmet", "common");
    expect(r.ok && wornGarments(r.inventory, kit.equipment)).toHaveLength(2);
  });
});
