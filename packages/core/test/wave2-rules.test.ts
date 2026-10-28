import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  BASE_CYBER_CAPACITY,
  BUFF_CATALOG,
  CYBERWARE_CATALOG,
  DISGUISE_SUSPICION_DECAY,
  ENFORCER_SUSPICION_RATE,
  FORBIDDEN_SUSPICION_RATE,
  NO_BUFFS,
  NO_DISGUISE,
  SHARD_CYBER_CAPACITY,
  STANDARD_TERMS,
  activate,
  addInstance,
  addStack,
  applyBuff,
  buffModifiers,
  buyCyberware,
  capacityAfter,
  capacityMax,
  capacityUsed,
  cooldownRateOf,
  createCharacter,
  deriveStats,
  disguiseHolds,
  disguiseOf,
  disguiseSuspicionRate,
  equip,
  fitsCapacity,
  hasPerk,
  installCyberwareItem,
  needsWounds,
  regenBetween,
  starterKit,
  tickAbility,
  tickBuffs,
  useConsumable,
  type BuffList,
  type CyberwareLoadout,
} from "../src";

describe("cyberware capacity (ADR-0033)", () => {
  it("every implant takes 2 to 8 points", () => {
    for (const def of Object.values(CYBERWARE_CATALOG)) {
      expect(def.capacity, def.id).toBeGreaterThanOrEqual(2);
      expect(def.capacity, def.id).toBeLessThanOrEqual(8);
    }
  });

  it("the pool grows at 3, 6 and 10 finished contracts and with every shard", () => {
    expect(capacityMax(0, 0)).toBe(BASE_CYBER_CAPACITY);
    expect(capacityMax(2, 0)).toBe(12);
    expect(capacityMax(3, 0)).toBe(15);
    expect(capacityMax(6, 0)).toBe(18);
    expect(capacityMax(10, 0)).toBe(21);
    expect(capacityMax(40, 0)).toBe(21);
    expect(capacityMax(0, 2)).toBe(12 + 2 * SHARD_CYBER_CAPACITY);
  });

  it("counts the installed implants and what a swap would leave", () => {
    const start = createCharacter().cyberware;
    expect(capacityUsed(start)).toBe(2);
    const loadout: CyberwareLoadout = { ...start, nervous: "kairos_overclock", arms: "steady_grip" };
    expect(capacityUsed(loadout)).toBe(12);
    // The synapse booster (5) replaces the overdrive (7).
    expect(capacityAfter(loadout, "synapse_booster")).toBe(10);
    expect(capacityAfter(loadout, "tsubame_reflex")).toBe(17);
  });

  it("refuses an implant past the pool, but never a swap down", () => {
    const full: CyberwareLoadout = { optics: "hitomi_optics_mk1", nervous: "kairos_overclock", arms: "steady_grip" };
    expect(fitsCapacity(full, "subdermal_weave", 12)).toBe(false);
    expect(fitsCapacity(full, "subdermal_weave", 16)).toBe(true);
    expect(fitsCapacity(full, "synapse_booster", 12)).toBe(true);
    // Over the pool already (an old save): a smaller implant still goes in.
    expect(fitsCapacity(full, "synapse_booster", 8)).toBe(true);
    expect(fitsCapacity(full, "tsubame_reflex", 8)).toBe(false);
  });

  it("the ripperdoc says over-capacity before taking money", () => {
    const character = { ...createCharacter(), cyberware: { optics: "hitomi_optics_mk1", nervous: "kairos_overclock", arms: "steady_grip" } as const };
    expect(buyCyberware({ eddies: 5000 }, character, "subdermal_weave", STANDARD_TERMS, 12)).toEqual({ ok: false, reason: "over-capacity" });
    expect(buyCyberware({ eddies: 5000 }, character, "subdermal_weave", STANDARD_TERMS, 16)).toMatchObject({ ok: true, price: 650 });
    // Without a pool given there is no limit (old callers).
    expect(buyCyberware({ eddies: 5000 }, character, "subdermal_weave")).toMatchObject({ ok: true });
  });

  it("an implant from the bag is checked the same way", () => {
    const kit = starterKit();
    const r = addInstance(kit.inventory, kit.equipment, "tsubame_reflex", "common");
    if (!r.ok) throw new Error("no room");
    const character = createCharacter();
    expect(installCyberwareItem({ eddies: 5000 }, character, r.inventory, kit.equipment, r.item.uid, STANDARD_TERMS, 9)).toEqual({ ok: false, reason: "over-capacity" });
    expect(installCyberwareItem({ eddies: 5000 }, character, r.inventory, kit.equipment, r.item.uid, STANDARD_TERMS, 10)).toMatchObject({ ok: true, cyberwareId: "tsubame_reflex" });
  });

  it("the new implants carry the perks", () => {
    expect(hasPerk({ skeleton: "kitsune_tendons" }, "dash")).toBe(true);
    expect(hasPerk({ arms: "tsubame_reflex" }, "deflect")).toBe(true);
    expect(hasPerk(createCharacter().cyberware, "dash")).toBe(false);
    // The legs share the skeleton slot with the weave: mobility or armour.
    expect(CYBERWARE_CATALOG.kitsune_tendons.slot).toBe(CYBERWARE_CATALOG.subdermal_weave.slot);
  });
});

describe("buffs (ADR-0033)", () => {
  it("applies, refreshes without stacking and keeps a stable order", () => {
    let b: BuffList = applyBuff(NO_BUFFS, "steady");
    b = applyBuff(b, "regen", 10);
    expect(b.map((x) => x.id)).toEqual(["regen", "steady"]);
    expect(applyBuff(b, "regen").find((x) => x.id === "regen")?.left).toBe(BUFF_CATALOG.regen.duration);
    expect(applyBuff(b, "steady", 1).find((x) => x.id === "steady")?.left).toBe(BUFF_CATALOG.steady.duration);
  });

  it("ticks down and reports what ended", () => {
    const r = tickBuffs([{ id: "steady", left: 0.01 }, { id: "quick_cooldown", left: 5 }], 0.02);
    expect(r.ended).toEqual(["steady"]);
    expect(r.buffs).toEqual([{ id: "quick_cooldown", left: 4.98 }]);
    expect(tickBuffs(NO_BUFFS, 1)).toEqual({ buffs: NO_BUFFS, ended: [], heal: 0 });
  });

  it("regeneration heals whole points, the same total for any step size", () => {
    const run = (dt: number): number => {
      let b: BuffList = applyBuff(NO_BUFFS, "regen");
      let healed = 0;
      while (b.length > 0) {
        const r = tickBuffs(b, dt);
        healed += r.heal;
        expect(Number.isInteger(r.heal)).toBe(true);
        b = r.buffs;
      }
      return healed;
    };
    const total = BUFF_CATALOG.regen.duration * (BUFF_CATALOG.regen.regen ?? 0);
    expect(run(1 / 60)).toBe(total);
    expect(run(0.5)).toBe(total);
    expect(regenBetween(0.5, 10, 2)).toBe(1);
  });

  it("speeds the cooldowns up and steadies the aim", () => {
    expect(cooldownRateOf(NO_BUFFS)).toBe(1);
    expect(cooldownRateOf([{ id: "quick_cooldown", left: 3 }])).toBe(1.5);
    const fired = activate({ activeTime: 0, cooldown: 0 }, ABILITY_CATALOG.reflex_overdrive);
    if (!fired) throw new Error("not ready");
    expect(tickAbility(fired, 2, 1.5)).toEqual({ activeTime: 2, cooldown: 13 });
    const base = deriveStats(createCharacter());
    expect(deriveStats(createCharacter(), buffModifiers([{ id: "steady", left: 1 }])).aimStability).toBeCloseTo(base.aimStability + 0.2);
  });

  it("food and drinks with a buff are taken at full health, plain healing is not", () => {
    const kit = starterKit();
    const inv = addStack(addStack(kit.inventory, kit.equipment, "synth_coffee", 1).inventory, kit.equipment, "medkit", 1).inventory;
    const full = { current: 100, max: 100 };
    expect(useConsumable(inv, "synth_coffee", full)).toMatchObject({ ok: true, healed: 0 });
    expect(useConsumable(inv, "medkit", full)).toEqual({ ok: false, reason: "full-health" });
    expect(needsWounds("bandage")).toBe(true);
    expect(needsWounds("ramen")).toBe(false);
    expect(needsWounds("capacity_shard")).toBe(false);
  });
});

describe("disguises (ADR-0033)", () => {
  const wearing = (def: "hebi_jacket" | "tessen_uniform" | "tessen_overalls" | "seki_jacket") => {
    const kit = starterKit();
    const r = addInstance(kit.inventory, kit.equipment, def, "common");
    if (!r.ok) throw new Error("no room");
    const e = equip(r.inventory, kit.equipment, r.item.uid, "torso");
    if (!e.ok) throw new Error("cannot wear");
    return disguiseOf(r.inventory, e.equipment);
  };

  it("the torso garment sets the role", () => {
    expect(wearing("hebi_jacket")).toBe("hebi");
    expect(wearing("tessen_uniform")).toBe("tessen_guard");
    expect(wearing("tessen_overalls")).toBe("tessen_staff");
    expect(wearing("seki_jacket")).toBeNull();
  });

  it("holds against its own faction until blown", () => {
    expect(disguiseHolds({ role: "tessen_staff", blown: false }, "tessen")).toBe(true);
    expect(disguiseHolds({ role: "tessen_staff", blown: false }, "hebi")).toBe(false);
    expect(disguiseHolds({ role: "hebi", blown: true }, "hebi")).toBe(false);
    expect(disguiseHolds(NO_DISGUISE, "hebi")).toBe(false);
  });

  it("only an enforcer or a forbidden act raises suspicion, closer is faster", () => {
    expect(disguiseSuspicionRate(true, false, false, 2, 18)).toBe(-DISGUISE_SUSPICION_DECAY);
    expect(disguiseSuspicionRate(false, true, true, 2, 18)).toBe(-DISGUISE_SUSPICION_DECAY);
    expect(disguiseSuspicionRate(true, true, false, 18, 18)).toBeCloseTo(ENFORCER_SUSPICION_RATE * 0.5);
    expect(disguiseSuspicionRate(true, true, false, 0, 18)).toBeCloseTo(ENFORCER_SUSPICION_RATE * 1.5);
    expect(disguiseSuspicionRate(true, false, true, 0, 18)).toBeCloseTo(FORBIDDEN_SUSPICION_RATE * 1.5);
  });
});
