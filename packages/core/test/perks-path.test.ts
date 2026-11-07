import { describe, expect, it } from "vitest";
import {
  BASE_STATS,
  type ProgressionState,
  abilityDurationScale,
  buffDurationScale,
  combineModifiers,
  deflectCostScale,
  garmentWearScale,
  hackDurationScale,
  knockbackScale,
  perkAdsTimeScale,
  perkDetectionScale,
  missingTier,
  perkModifiers,
  perkOpen,
  perkPathMet,
  perkRefusal,
  previousTier,
  progressionFromXp,
  scanRangeScale,
  shortCircuitScale,
  spendAttributePoint,
  spendPerkPoint,
  takedownReachBonus,
  validPerks,
  wearGarments,
  xpForLevel,
} from "../src";

/* Stage 3b of ADR-0059: a tier needs a perk of the tier below, and the trees' new perks. */

/** Level `level` with `n` points of Might and every other point still to spend. */
const mighty = (level: number, n: number): ProgressionState => {
  let s = progressionFromXp(xpForLevel(level));
  for (let i = 0; i < n; i++) {
    const r = spendAttributePoint(s, "might");
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
};

const buy = (s: ProgressionState, ...ids: string[]): ProgressionState =>
  ids.reduce((state, id) => {
    const r = spendPerkPoint(state, id);
    if (!r.ok) throw new Error(`${id}: ${r.reason}`);
    return r.state;
  }, s);

describe("the path through the tiers", () => {
  it("a tier above the first needs a perk of the tier below in the same tree, besides the attribute", () => {
    const s = mighty(20, 12);
    expect(previousTier("might_tough")).toBeNull();
    expect(previousTier("might_crushing_parry")).toBe(2);
    expect(spendPerkPoint(s, "might_second_wind")).toEqual({ ok: false, reason: "locked" });
    const t0 = buy(s, "might_thick_skull");
    expect(perkPathMet(t0.perks, "might_second_wind")).toBe(true);
    expect(perkPathMet(t0.perks, "might_hardened")).toBe(false);
    // Another tree's perk of the tier below does not count.
    expect(perkPathMet({ reflex_slipstream: 1 }, "might_hardened")).toBe(false);
    const t1 = buy(t0, "might_iron_guard");
    expect(perkRefusal(t1.attributes, t1.perks, t1.unspent.perk, "might_crushing_parry")).toBe("locked");
    const t2 = buy(t1, "might_battering_ram", "might_crushing_parry");
    expect(t2.perks).toEqual({ might_thick_skull: 1, might_iron_guard: 1, might_battering_ram: 1, might_crushing_parry: 1 });
  });

  it("the path does not open what the attribute keeps shut", () => {
    const s = buy(mighty(10, 1), "might_tough");
    expect(perkPathMet(s.perks, "might_second_wind")).toBe(true);
    expect(perkOpen(s.attributes, s.perks, "might_second_wind")).toBe(false);
  });

  it("a stage 3 save with a higher tier and nothing below stays valid and keeps its perks; every new rank needs the path (stage 3c)", () => {
    // Stage 3 opened a tier by the attribute alone: Might 12 bought Hardened straight away.
    const old = { ...mighty(12, 9), perks: { might_hardened: 1 }, unspent: { attribute: 2, perk: 10 } };
    expect(validPerks(old.attributes, old.perks)).toBe(true);
    // Its second rank waits for the path too (stage 3b let it through), and says which tier is missing.
    expect(missingTier(old.perks, "might_hardened")).toBe(0);
    expect(spendPerkPoint(old, "might_hardened")).toEqual({ ok: false, reason: "locked" });
    expect(spendPerkPoint(old, "might_second_wind")).toEqual({ ok: false, reason: "locked" });
    // The key tier above it needs the whole path, not only the tier right below.
    const key = { ...old, attributes: { ...old.attributes, might: 15 } };
    expect(perkPathMet(key.perks, "might_crushing_parry")).toBe(false);
    expect(missingTier(key.perks, "might_crushing_parry")).toBe(0);
    // Tier 4, then tier 8: the next rank and the key go on.
    const filled = buy(old, "might_tough");
    expect(missingTier(filled.perks, "might_hardened")).toBe(1);
    expect(buy(filled, "might_second_wind", "might_hardened").perks).toEqual({ might_hardened: 2, might_tough: 1, might_second_wind: 1 });
    expect(perkPathMet({ ...filled.perks, might_second_wind: 1 }, "might_crushing_parry")).toBe(true);
  });
});

describe("the new perks of stage 3b", () => {
  it("stats: Thick Skull (head armor), Sharpshooter and Assassin (crit chance), Light Step (walk speed)", () => {
    const m = perkModifiers({ might_thick_skull: 2, reflex_sharpshooter: 2, shadow_assassin: 1, reflex_light_step: 2 });
    expect(m).toMatchObject({ headArmor: 4, moveSpeed: 0.4 });
    expect(m.critChance).toBeCloseTo(0.1);
    const stats = combineModifiers(BASE_STATS, [m]);
    expect(stats.headArmor - BASE_STATS.headArmor).toBe(4);
    expect(stats.critChance).toBeCloseTo(BASE_STATS.critChance + 0.1);
  });

  it("scales the systems read, each 1 without the perk", () => {
    const none = {};
    const scales = [deflectCostScale, knockbackScale, perkAdsTimeScale, buffDurationScale, abilityDurationScale, garmentWearScale, scanRangeScale, hackDurationScale, shortCircuitScale, perkDetectionScale];
    expect(scales.map((f) => f(none))).toEqual(scales.map(() => 1));
    expect(takedownReachBonus(none)).toBe(0);
    expect(deflectCostScale({ might_iron_guard: 2 })).toBe(0.5);
    expect(knockbackScale({ might_battering_ram: 1 })).toBe(2);
    expect(perkAdsTimeScale({ reflex_snap_aim: 2 })).toBeCloseTo(0.7);
    expect(buffDurationScale({ tech_stim_tolerance: 2 })).toBe(1.5);
    expect(abilityDurationScale({ tech_capacitor: 2 })).toBeCloseTo(1.4);
    expect(garmentWearScale({ tech_reinforced_seams: 1 })).toBe(0.5);
    expect(scanRangeScale({ net_long_range: 2 })).toBeCloseTo(1.4);
    expect(hackDurationScale({ net_persistence: 2 })).toBeCloseTo(1.4);
    expect(shortCircuitScale({ net_overload: 2 })).toBe(1.5);
    expect(perkDetectionScale({ shadow_low_profile: 2 })).toBeCloseTo(0.9);
    expect(takedownReachBonus({ shadow_long_arms: 1 })).toBeCloseTo(0.4);
  });

  it("clothes wear by the wear given (Reinforced Seams halves it in whole points)", () => {
    const inv = { capacity: 10, items: [{ uid: "i1", def: "seki_jacket", rarity: "common", condition: 100 }], stacks: {}, nextUid: 2 } as unknown as Parameters<typeof wearGarments>[0];
    const eq = { torso: "i1", head: null, legs: null, feet: null, hands: null } as unknown as Parameters<typeof wearGarments>[1];
    const condition = (wear?: number) => wearGarments(inv, eq, "torso", wear).items[0]!.condition;
    expect(condition()).toBe(98);
    expect(condition(2 * garmentWearScale({ tech_reinforced_seams: 1 }))).toBe(99);
  });
});
