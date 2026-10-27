import { describe, expect, it } from "vitest";
import {
  BASE_STATS,
  createCharacter,
  deriveStats,
  installCyberware,
  isCyberwareId,
  isMemoryId,
  setAlias,
  uninstallCyberware,
  unlockMemory,
} from "../src";

describe("character", () => {
  it("starts nameless with starter optics", () => {
    const c = createCharacter();
    expect(c.alias).toBeNull();
    expect(c.cyberware.optics).toBe("hitomi_optics_mk1");
    expect(deriveStats(c).critChance).toBeCloseTo(BASE_STATS.critChance + 0.04);
  });

  it("memories add stat modifiers and unlock idempotently", () => {
    const c = unlockMemory(unlockMemory(createCharacter(), "combat_reflex"), "combat_reflex");
    expect(c.memories).toEqual(["combat_reflex"]);
    expect(deriveStats(c).damageBonus).toBe(3);
  });

  it("sets the alias the fixer gives her", () => {
    expect(setAlias(createCharacter(), "Seki Senshi").alias).toBe("Seki Senshi");
  });

  it("guards catalog ids", () => {
    expect(isMemoryId("combat_reflex")).toBe(true);
    expect(isMemoryId("nope")).toBe(false);
    expect(isCyberwareId("subdermal_weave")).toBe(true);
    expect(isCyberwareId("toString")).toBe(false);
  });
});

describe("cyberware", () => {
  it("installs into a slot and reports the replaced implant", () => {
    const r = installCyberware({ skeleton: "subdermal_weave" }, "subdermal_weave");
    expect(r.replaced).toBe("subdermal_weave");
    const fresh = installCyberware({}, "synapse_booster");
    expect(fresh.replaced).toBeNull();
    expect(fresh.loadout.nervous).toBe("synapse_booster");
  });

  it("uninstalls without touching other slots", () => {
    const l = uninstallCyberware({ optics: "hitomi_optics_mk1", skeleton: "subdermal_weave" }, "skeleton");
    expect(l).toEqual({ optics: "hitomi_optics_mk1" });
  });

  it("feeds implant modifiers into derived stats", () => {
    const c = { ...createCharacter(), cyberware: { skeleton: "subdermal_weave" as const } };
    const s = deriveStats(c);
    expect(s.armor).toBe(BASE_STATS.armor + 4);
    expect(s.maxHp).toBe(BASE_STATS.maxHp + 15);
  });
});
