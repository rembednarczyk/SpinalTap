import { describe, expect, it } from "vitest";
import {
  BACKPACK_PRICES,
  type CharacterState,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type InventoryState,
  MAX_CAPACITY,
  SHOPS,
  SHOP_IDS,
  type TradeState,
  addInstance,
  addStack,
  backpackPrice,
  buyStock,
  createCharacter,
  findItem,
  freeCells,
  installCyberwareItem,
  installFee,
  isShopId,
  removeCyberware,
  repair,
  repairQuote,
  sell,
  sellFactor,
  sellPrice,
  shopBuys,
  shopItemDescription,
  shopItemName,
  shopTerms,
  starterKit,
  stockEntry,
  stockListPrice,
  stockName,
  stowImplant,
  upgradeBackpack,
} from "../src";

const NEUTRAL = shopTerms(0);
const HOSTILE = shopTerms(-80);

const state = (patch: Partial<TradeState> = {}): TradeState => ({ wallet: { eddies: 5000 }, ...starterKit(), ...patch });

/** The starter kit plus one more piece in the bag. */
const withItem = (def: Parameters<typeof addInstance>[2], rarity: Parameters<typeof addInstance>[3] = "common", patch = {}) => {
  const s = state();
  const r = addInstance(s.inventory, s.equipment, def, rarity, patch);
  if (!r.ok) throw new Error("bag full");
  return { s: { ...s, inventory: r.inventory }, uid: r.item.uid };
};

/** A bag with every cell taken (24 loose pieces). */
const fullBag = (): InventoryState => {
  let inv = EMPTY_INVENTORY;
  for (let i = 0; i < 24; i++) {
    const r = addInstance(inv, EMPTY_EQUIPMENT, "baton", "common");
    if (r.ok) inv = r.inventory;
  }
  return inv;
};

describe("sale prices (plan §6)", () => {
  it("pays a quarter of value × rarity, junk in full", () => {
    expect(sellPrice({ def: "hebi_smg", rarity: "common" })).toBe(175);
    expect(sellPrice({ def: "hebi_smg", rarity: "uncommon" })).toBe(280);
    expect(sellPrice({ def: "hebi_smg", rarity: "rare" })).toBe(455);
    expect(sellPrice({ def: "steady_grip" })).toBe(125);
    expect(sellPrice({ def: "medkit" })).toBe(22);
    expect(sellPrice({ def: "scrap" })).toBe(12);
    expect(sellPrice({ def: "datachip" })).toBe(40);
  });

  it("scales by the trader's opinion and by a garment's condition", () => {
    expect([shopTerms(-30), shopTerms(0), shopTerms(30), shopTerms(80)].map((t) => sellFactor(t.tier))).toEqual([0.75, 1, 1.1, 1.2]);
    expect(sellFactor("hostile")).toBe(0);
    expect(sellPrice({ def: "scrap" }, shopTerms(-30))).toBe(9);
    expect(sellPrice({ def: "scrap" }, shopTerms(30))).toBe(13);
    expect(sellPrice({ def: "medkit" }, shopTerms(80))).toBe(27);
    expect(sellPrice({ def: "hebi_jacket", rarity: "common", condition: 100 })).toBe(150);
    expect(sellPrice({ def: "hebi_jacket", rarity: "common", condition: 50 })).toBe(112);
    expect(sellPrice({ def: "hebi_jacket", rarity: "common", condition: 0 })).toBe(75);
  });

  it("the starter optics are worth nothing", () => {
    expect(sellPrice({ def: "hitomi_optics_mk1" })).toBe(0);
  });

  it("each shop buys its own kinds", () => {
    expect(shopBuys("clinic", "steady_grip")).toBe(true);
    expect(shopBuys("clinic", "scrap")).toBe(false);
    expect(shopBuys("oyaji", "scrap")).toBe(true);
    expect(shopBuys("oyaji", "hebi_smg")).toBe(true);
    expect(SHOP_IDS.every(isShopId)).toBe(true);
    expect(isShopId("hana")).toBe(false);
  });
});

describe("selling", () => {
  it("sells part of a stack and credits the wallet", () => {
    const s = state();
    const inv = addStack(s.inventory, s.equipment, "scrap", 5).inventory;
    const r = sell({ ...s, inventory: inv }, "oyaji", { stack: "scrap" }, 3, NEUTRAL);
    expect(r).toMatchObject({ ok: true, defId: "scrap", qty: 3, price: 36, wallet: { eddies: 5036 } });
    if (r.ok) expect(r.inventory.stacks.scrap).toBe(2);
  });

  it("sells a loose piece; rounds in a sold gun go back to the pouch", () => {
    const { s, uid } = withItem("hebi_smg", "uncommon", { loaded: 10 });
    const r = sell(s, "oyaji", { uid }, 1, NEUTRAL);
    expect(r).toMatchObject({ ok: true, price: 280, qty: 1, ammo: { "9mm": 58 } });
    if (r.ok) expect(findItem(r.inventory, uid)).toBeUndefined();
    const empty = withItem("hebi_smg");
    const r2 = sell(empty.s, "oyaji", { uid: empty.uid }, 1, NEUTRAL);
    expect(r2.ok && r2.ammo).toEqual({ "9mm": 48 });
    const jacket = withItem("hebi_jacket");
    expect(sell(jacket.s, "oyaji", { uid: jacket.uid }, 1, NEUTRAL)).toMatchObject({ ok: true, price: 150 });
  });

  it("refuses what is worn, unknown, unwanted, worthless, or a hostile customer", () => {
    const s = state();
    expect(sell(s, "oyaji", { uid: "i1" }, 1, NEUTRAL)).toEqual({ ok: false, reason: "in-use" });
    expect(sell(s, "oyaji", { uid: "i99" }, 1, NEUTRAL)).toEqual({ ok: false, reason: "not-found" });
    expect(sell(s, "oyaji", { stack: "scrap" }, 1, NEUTRAL)).toEqual({ ok: false, reason: "not-found" });
    expect(sell(s, "oyaji", { stack: "medkit" }, 0, NEUTRAL)).toEqual({ ok: false, reason: "not-found" });
    expect(sell(s, "clinic", { stack: "medkit" }, 1, NEUTRAL)).toEqual({ ok: false, reason: "not-bought-here" });
    expect(sell(s, "clinic", { uid: "i2" }, 1, NEUTRAL)).toEqual({ ok: false, reason: "not-bought-here" });
    expect(sell(s, "oyaji", { stack: "medkit" }, 1, HOSTILE)).toEqual({ ok: false, reason: "refused" });
    const optics = withItem("hitomi_optics_mk1");
    expect(sell(optics.s, "clinic", { uid: optics.uid }, 1, NEUTRAL)).toEqual({ ok: false, reason: "worthless" });
    const grip = withItem("steady_grip");
    expect(sell(grip.s, "clinic", { uid: grip.uid }, 1, NEUTRAL)).toMatchObject({ ok: true, price: 125 });
  });

  it("a piece carrying mods stays until they come off", () => {
    const { s, uid } = withItem("hebi_smg");
    const modded = { ...s, inventory: { ...s.inventory, items: s.inventory.items.map((i) => (i.uid === uid ? { ...i, mods: { sight: "i9" } } : i)) } };
    expect(sell(modded, "oyaji", { uid }, 1, NEUTRAL)).toEqual({ ok: false, reason: "in-use" });
  });

  it("a stack nobody pays for is refused before anything moves", () => {
    // Junk at a hostile tier would be worth 0; terms close the shop first, so check the guard directly.
    expect(sellPrice({ def: "scrap" }, { open: true, multiplier: 1, tier: "hostile" })).toBe(0);
    const s = state();
    const inv = addStack(s.inventory, s.equipment, "scrap", 1).inventory;
    expect(sell({ ...s, inventory: inv }, "oyaji", { stack: "scrap" }, 1, { open: true, multiplier: 1, tier: "hostile" })).toEqual({ ok: false, reason: "worthless" });
  });
});

describe("repairs (plan §6)", () => {
  it("30% of the value for the missing condition, 25 €$ off per part", () => {
    expect(repairQuote({ def: "hebi_jacket", rarity: "common", condition: 64 }, 0, 0)).toEqual({ base: 65, parts: 0, price: 65 });
    expect(repairQuote({ def: "hebi_jacket", rarity: "common", condition: 64 }, 2, 5)).toEqual({ base: 65, parts: 2, price: 15 });
    // Never more parts than needed, or than owned.
    expect(repairQuote({ def: "hebi_jacket", rarity: "common", condition: 64 }, 9, 9)).toEqual({ base: 65, parts: 3, price: 0 });
    expect(repairQuote({ def: "seki_jacket", rarity: "common", condition: 0 }, 4, 1)).toEqual({ base: 45, parts: 1, price: 20 });
    expect(repairQuote({ def: "hebi_jacket", rarity: "rare", condition: 90 }, 0, 0).base).toBe(47);
  });

  it("mends a worn garment and spends the parts", () => {
    const s = state();
    const worn = { ...s.inventory, items: s.inventory.items.map((i) => (i.uid === "i2" ? { ...i, condition: 0 } : i)) };
    const inv = addStack(worn, s.equipment, "weapon_parts", 3).inventory;
    const r = repair({ eddies: 100 }, inv, "i2", 1, NEUTRAL);
    expect(r).toMatchObject({ ok: true, price: 20, parts: 1, wallet: { eddies: 80 } });
    if (r.ok) {
      expect(findItem(r.inventory, "i2")?.condition).toBe(100);
      expect(r.inventory.stacks.weapon_parts).toBe(2);
    }
    const free = repair({ eddies: 0 }, inv, "i2", 3, NEUTRAL);
    expect(free).toMatchObject({ ok: true, price: 0, parts: 2, wallet: { eddies: 0 } });
  });

  it("refuses intact or unknown pieces, weapons, short wallets and hostile customers", () => {
    const s = state();
    expect(repair({ eddies: 100 }, s.inventory, "i2", 0, NEUTRAL)).toEqual({ ok: false, reason: "not-damaged" });
    expect(repair({ eddies: 100 }, s.inventory, "i1", 0, NEUTRAL)).toEqual({ ok: false, reason: "not-damaged" });
    expect(repair({ eddies: 100 }, s.inventory, "i42", 0, NEUTRAL)).toEqual({ ok: false, reason: "not-found" });
    const worn = { ...s.inventory, items: s.inventory.items.map((i) => (i.uid === "i2" ? { ...i, condition: 0 } : i)) };
    expect(repair({ eddies: 10 }, worn, "i2")).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(repair({ eddies: 100 }, worn, "i2", 0, HOSTILE)).toEqual({ ok: false, reason: "refused" });
  });
});

describe("backpack", () => {
  it("grows twice by six cells, 600 then 1200 €$", () => {
    expect(BACKPACK_PRICES).toEqual([600, 1200]);
    const first = upgradeBackpack({ eddies: 2000 }, EMPTY_INVENTORY, NEUTRAL);
    expect(first).toMatchObject({ ok: true, price: 600, inventory: { capacity: 30 }, wallet: { eddies: 1400 } });
    if (!first.ok) return;
    expect(backpackPrice(first.inventory)).toBe(1200);
    const second = upgradeBackpack(first.wallet, first.inventory);
    expect(second).toMatchObject({ ok: true, price: 1200, inventory: { capacity: MAX_CAPACITY } });
    if (!second.ok) return;
    expect(backpackPrice(second.inventory)).toBeNull();
    expect(upgradeBackpack({ eddies: 9999 }, second.inventory)).toEqual({ ok: false, reason: "max-capacity" });
    expect(upgradeBackpack({ eddies: 100 }, EMPTY_INVENTORY)).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(upgradeBackpack({ eddies: 9999 }, EMPTY_INVENTORY, HOSTILE)).toEqual({ ok: false, reason: "refused" });
  });
});

describe("shop stock", () => {
  it("the clinic sells medicine, Oyaji ammo, mods, clothes and guns", () => {
    // Wave 2 (ADR-0033): the steadying stim and the capacity shard join the medicine.
    expect(SHOPS.clinic.stock.map((e) => e.item)).toEqual(["medkit", "bandage", "steady_stim", "capacity_shard"]);
    const kinds = new Set(SHOPS.oyaji.stock.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["ammo", "item"]));
    for (const shop of SHOP_IDS) expect(new Set(SHOPS[shop].stock.map((e) => e.item)).size).toBe(SHOPS[shop].stock.length);
    expect(SHOPS.oyaji).toMatchObject({ owner: "civilians", repairs: true, backpacks: true, implants: false });
  });

  it("names and prices entries with catalog keys (ADR-0056)", () => {
    const box = stockEntry("oyaji", "9mm");
    expect(box && stockName(box)).toEqual({ key: "shop.stock.ammo", params: { ammo: { key: "ammo.9mm" }, qty: 24 } });
    expect(box && stockListPrice(box)).toBe(24);
    const smg = stockEntry("oyaji", "hebi_smg");
    expect(smg && stockListPrice(smg)).toBe(1120);
    const medkit = stockEntry("clinic", "medkit");
    expect(medkit && [stockName(medkit), stockListPrice(medkit)]).toEqual(["item.medkit.name", 90]);
    expect(stockEntry("clinic", "hebi_smg")).toBeUndefined();
    expect(shopItemName("12g")).toBe("ammo.12g");
    expect(shopItemName("holo_sight")).toBe("item.holo_sight.name");
    expect(shopItemDescription("556")).toEqual({ key: "shop.stock.ammoBox", params: { ammo: { key: "ammo.556" } } });
    expect(shopItemDescription("bandage")).toBe("item.bandage.desc");
    expect(shopItemDescription("tessen_ar5")).toBe("item.tessen_ar5.desc");
    expect(shopItemDescription("kevlar_pants")).toBe("item.kevlar_pants.desc");
    expect(shopItemDescription("suppressor")).toBe("item.suppressor.desc");
  });

  it("buys a box of rounds into the pouch, a piece into the bag, a stack piece", () => {
    const ammo = buyStock(state(), "oyaji", "9mm", NEUTRAL);
    expect(ammo).toMatchObject({ ok: true, price: 24, qty: 24, ammo: { "9mm": 72 }, added: null, wallet: { eddies: 4976 } });
    const smg = buyStock(state(), "oyaji", "hebi_smg", NEUTRAL);
    expect(smg).toMatchObject({ ok: true, price: 1120, qty: 1, added: { def: "hebi_smg", rarity: "uncommon", loaded: 0 } });
    const medkit = buyStock(state(), "clinic", "medkit", shopTerms(60));
    expect(medkit).toMatchObject({ ok: true, price: 72, inventory: { stacks: { medkit: 2 } } });
  });

  it("refuses what is not stocked, what does not fit, short wallets and hostile customers", () => {
    expect(buyStock(state(), "clinic", "9mm")).toEqual({ ok: false, reason: "not-sold-here" });
    expect(buyStock(state({ ammo: { "9mm": 170 } }), "oyaji", "9mm")).toEqual({ ok: false, reason: "inventory-full" });
    expect(buyStock(state({ inventory: fullBag(), equipment: EMPTY_EQUIPMENT }), "oyaji", "holo_sight")).toEqual({ ok: false, reason: "inventory-full" });
    expect(buyStock(state({ inventory: fullBag(), equipment: EMPTY_EQUIPMENT }), "clinic", "bandage")).toEqual({ ok: false, reason: "inventory-full" });
    expect(buyStock(state({ wallet: { eddies: 10 } }), "oyaji", "tessen_ar5")).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(buyStock(state(), "oyaji", "9mm", HOSTILE)).toEqual({ ok: false, reason: "refused" });
  });
});

describe("implants from the bag (E11)", () => {
  const character = (cyberware: CharacterState["cyberware"] = {}): CharacterState => ({ ...createCharacter(), cyberware });

  it("fitting a found grip stabiliser costs 125 €$ at list terms", () => {
    expect(installFee({ def: "steady_grip" })).toBe(125);
    expect(installFee({ def: "steady_grip", rarity: "uncommon" })).toBe(200);
    expect(installFee({ def: "steady_grip" }, shopTerms(80))).toBe(100);
    expect(installFee({ def: "hitomi_optics_mk1" })).toBe(0);
  });

  it("installs from the bag and returns the replaced implant", () => {
    const { s, uid } = withItem("synapse_booster");
    const r = installCyberwareItem({ eddies: 300 }, character({ nervous: "kairos_overclock" }), s.inventory, s.equipment, uid, NEUTRAL);
    expect(r).toMatchObject({ ok: true, fee: 225, cyberwareId: "synapse_booster", replaced: "kairos_overclock", wallet: { eddies: 75 } });
    if (!r.ok) return;
    expect(r.character.cyberware.nervous).toBe("synapse_booster");
    expect(findItem(r.inventory, uid)).toBeUndefined();
    expect(r.returned).toMatchObject({ def: "kairos_overclock", rarity: "common" });
    expect(freeCells(r.inventory, s.equipment)).toBe(freeCells(s.inventory, s.equipment));
  });

  it("an empty slot just takes the implant; free implants need no eddies", () => {
    const { s, uid } = withItem("steady_grip");
    const r = installCyberwareItem({ eddies: 125 }, character(), s.inventory, s.equipment, uid);
    expect(r).toMatchObject({ ok: true, fee: 125, replaced: null, returned: null, wallet: { eddies: 0 } });
    const optics = withItem("hitomi_optics_mk1");
    expect(installCyberwareItem({ eddies: 0 }, character(), optics.s.inventory, optics.s.equipment, optics.uid)).toMatchObject({ ok: true, fee: 0 });
  });

  it("refuses unknown pieces, non-implants, doubles, short wallets and hostile customers", () => {
    const { s, uid } = withItem("steady_grip");
    expect(installCyberwareItem({ eddies: 999 }, character(), s.inventory, s.equipment, "i77")).toEqual({ ok: false, reason: "not-found" });
    expect(installCyberwareItem({ eddies: 999 }, character(), s.inventory, s.equipment, "i2")).toEqual({ ok: false, reason: "not-sold-here" });
    expect(installCyberwareItem({ eddies: 999 }, character({ arms: "steady_grip" }), s.inventory, s.equipment, uid)).toEqual({ ok: false, reason: "already-installed" });
    expect(installCyberwareItem({ eddies: 10 }, character(), s.inventory, s.equipment, uid)).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(installCyberwareItem({ eddies: 999 }, character(), s.inventory, s.equipment, uid, HOSTILE)).toEqual({ ok: false, reason: "refused" });
  });

  it("an implant that is somehow placed stays put", () => {
    const { s, uid } = withItem("steady_grip");
    const placed = { ...s.equipment, head: uid };
    expect(installCyberwareItem({ eddies: 999 }, character(), s.inventory, placed, uid)).toEqual({ ok: false, reason: "in-use" });
  });

  it("removal is free and puts the implant into the bag", () => {
    const r = removeCyberware(character({ arms: "steady_grip" }), EMPTY_INVENTORY, EMPTY_EQUIPMENT, "arms");
    expect(r).toMatchObject({ ok: true, cyberwareId: "steady_grip", item: { def: "steady_grip" }, character: { cyberware: {} } });
    expect(removeCyberware(character(), EMPTY_INVENTORY, EMPTY_EQUIPMENT, "arms")).toEqual({ ok: false, reason: "empty-slot" });
    expect(removeCyberware(character({ arms: "steady_grip" }), fullBag(), EMPTY_EQUIPMENT, "arms")).toEqual({ ok: false, reason: "inventory-full" });
  });

  it("a removed implant without room is lost", () => {
    expect(stowImplant(fullBag(), EMPTY_EQUIPMENT, "steady_grip").item).toBeNull();
    expect(stowImplant(EMPTY_INVENTORY, EMPTY_EQUIPMENT, "steady_grip").item).toMatchObject({ uid: "i1", def: "steady_grip" });
  });
});
