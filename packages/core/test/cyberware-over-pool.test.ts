import { describe, expect, it } from "vitest";
import {
  BASE_CYBER_CAPACITY,
  CAPACITY_ORDER,
  type CyberwareLoadout,
  activeCyberware,
  createDomainState,
  cyberPoolOf,
  hasPerk,
  inactiveCyberware,
  loadoutAbility,
  loadoutModifiers,
  progressionFromXp,
  uninstallCyberware,
  workingCyberware,
  xpForLevel,
} from "../src";

/* Implants over the pool (ADR-0059, stage 3c): which ones are off, from the implants and the pool alone. */

const FULL: CyberwareLoadout = { optics: "hitomi_optics_mk1", nervous: "kairos_overclock", skeleton: "kitsune_tendons", arms: "tsubame_reflex" };

describe("implants over the pool", () => {
  it("all work within the pool, and the loadout comes back as it is", () => {
    expect(inactiveCyberware(FULL, 23)).toEqual([]);
    expect(activeCyberware(FULL, 23)).toBe(FULL);
  });

  it("goes through the slots in a fixed order: one that does not fit is off, the next may still fit", () => {
    expect(CAPACITY_ORDER).toEqual(["optics", "nervous", "skeleton", "arms"]);
    // 2 + 7 + 6 = 15 of 16: the reflex (8) does not fit in the 1 left.
    expect(inactiveCyberware(FULL, 16)).toEqual(["tsubame_reflex"]);
    // 2 + 7 of 12 leaves 3: neither the tendons nor the reflex fit.
    expect(inactiveCyberware(FULL, 12)).toEqual(["kitsune_tendons", "tsubame_reflex"]);
    // Skipping the tendons leaves room for a smaller arm implant after them.
    expect(inactiveCyberware({ ...FULL, arms: "steady_grip" }, 12)).toEqual(["kitsune_tendons"]);
  });

  it("an implant that is off gives no stats, no perk and no ability", () => {
    const off = activeCyberware(FULL, 12);
    expect(off).toEqual({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock" });
    expect(hasPerk(FULL, "dash")).toBe(true);
    expect(hasPerk(off, "dash")).toBe(false);
    expect(hasPerk(off, "deflect")).toBe(false);
    expect(loadoutModifiers(activeCyberware({ optics: "hitomi_optics_mk1", skeleton: "subdermal_weave" }, 5))).toEqual([{ critChance: 0.04, aimStability: 0.1 }]);
    // An ability off only below the smallest real pool, but the rule is the same.
    expect(loadoutAbility(activeCyberware(FULL, 8))).toBeNull();
    expect(loadoutAbility(activeCyberware(FULL, 9))).toBe("reflex_overdrive");
  });

  it("the domain's pool decides, and room freed brings them back at once", () => {
    const d = { ...createDomainState(), character: { ...createDomainState().character, cyberware: FULL } };
    expect(cyberPoolOf(d)).toEqual({ used: 23, max: BASE_CYBER_CAPACITY });
    expect(workingCyberware(d)).toEqual({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock" });
    // Level 9 (+6) and two shards (+4): 22, the tendons come back.
    const grown = { ...d, progression: progressionFromXp(xpForLevel(9)), capacityShards: 2 };
    expect(workingCyberware(grown)).toEqual({ optics: "hitomi_optics_mk1", nervous: "kairos_overclock", skeleton: "kitsune_tendons" });
    // Out with the Kairos: 16 of 22, all work.
    const out = { ...grown, character: { ...grown.character, cyberware: uninstallCyberware(FULL, "nervous") } };
    expect(inactiveCyberware(out.character.cyberware, cyberPoolOf(out).max)).toEqual([]);
  });
});
