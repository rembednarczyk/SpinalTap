import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_IDS,
  BASE_STATS,
  INITIAL_PROGRESSION,
  PERKS,
  PERK_IDS,
  PERK_TIERS,
  type ProgressionState,
  STANDARD_TERMS,
  START_ATTRIBUTES,
  abilityCooldownRate,
  buyRespec,
  cameraSpotScale,
  carrySpeedBonus,
  chainRadius,
  combineModifiers,
  crouchSpeedBonus,
  dashCooldownScale,
  healScale,
  isConsistentProgression,
  noiseScale,
  parryStunScale,
  perkCyberCapacity,
  perkDef,
  perkModifiers,
  perkRam,
  perkRefusal,
  perkUploadScale,
  progressionFromXp,
  progressionModifiers,
  ramRegenScale,
  reloadTimeScale,
  resetProgression,
  respecListPrice,
  respecPrice,
  secondHeartShare,
  shopTerms,
  spendAttributePoint,
  spendPerkPoint,
  staminaRegenScale,
  takedownTimeScale,
  useConsumable,
  validPerks,
  xpForLevel,
} from "../src";

/** A character at `level` with every point still to spend. */
const at = (level: number): ProgressionState => progressionFromXp(xpForLevel(level));

/** Spends `n` attribute points on `attribute`. */
const raise = (s: ProgressionState, attribute: (typeof ATTRIBUTE_IDS)[number], n: number): ProgressionState => {
  let state = s;
  for (let i = 0; i < n; i++) {
    const r = spendAttributePoint(state, attribute);
    if (!r.ok) throw new Error(r.reason);
    state = r.state;
  }
  return state;
};

describe("perk trees (ADR-0059, stage 3): the data", () => {
  it("one tree per attribute, every tier filled, one key perk on the last tier", () => {
    for (const tree of ATTRIBUTE_IDS) {
      const perks = PERK_IDS.filter((id) => perkDef(id).tree === tree);
      expect(perks.length).toBeGreaterThanOrEqual(5);
      expect(new Set(perks.map((id) => perkDef(id).tier))).toEqual(new Set([0, 1, 2, 3]));
      const keys = perks.filter((id) => perkDef(id).key);
      expect(keys).toHaveLength(1);
      expect(perkDef(keys[0]!).tier).toBe(3);
    }
    expect(PERK_TIERS).toEqual([4, 8, 12, 15]);
  });

  it("the 29 points of a whole game buy less than every rank, so the trees are a choice", () => {
    const ranks = Object.values(PERKS).reduce((sum, p) => sum + p.ranks, 0);
    expect(ranks).toBeGreaterThan(29);
    for (const id of PERK_IDS) expect(perkDef(id).ranks).toBeGreaterThanOrEqual(1);
  });

  it("no perk does anything before it is bought: every scale 1, every bonus 0", () => {
    const none = {};
    expect(combineModifiers(BASE_STATS, [perkModifiers(none)])).toEqual(BASE_STATS);
    const scales = [staminaRegenScale, parryStunScale, reloadTimeScale, dashCooldownScale, healScale, abilityCooldownRate, perkUploadScale, ramRegenScale, cameraSpotScale, noiseScale, takedownTimeScale];
    expect(scales.map((f) => f(none))).toEqual(scales.map(() => 1));
    const bonuses = [perkCyberCapacity, secondHeartShare, perkRam, chainRadius, carrySpeedBonus, crouchSpeedBonus];
    expect(bonuses.map((f) => f(none))).toEqual(bonuses.map(() => 0));
  });
});

describe("buying perks", () => {
  it("needs a perk point and the attribute at the tier's threshold", () => {
    const s = at(4);
    expect(perkRefusal(s.attributes, s.perks, 0, "might_tough")).toBe("no-points");
    expect(spendPerkPoint(s, "might_tough")).toEqual({ ok: false, reason: "locked" });
    const strong = raise(s, "might", 1);
    const r = spendPerkPoint(strong, "might_tough");
    expect(r.ok && r.state.perks).toEqual({ might_tough: 1 });
    expect(r.ok && r.state.unspent.perk).toBe(2);
    expect(spendPerkPoint(strong, "might_second_wind")).toEqual({ ok: false, reason: "locked" });
    expect(spendPerkPoint(strong, "nope")).toEqual({ ok: false, reason: "unknown" });
  });

  it("stops at the last rank; a key perk needs 15", () => {
    let s = raise(at(16), "might", 12);
    for (let i = 0; i < 3; i++) {
      const r = spendPerkPoint(s, "might_tough");
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(spendPerkPoint(s, "might_tough")).toEqual({ ok: false, reason: "at-max" });
    const key = spendPerkPoint(s, "might_crushing_parry");
    expect(key.ok).toBe(true);
    expect(spendPerkPoint(raise(at(13), "reflex", 11), "reflex_bullet_dance")).toEqual({ ok: false, reason: "locked" });
  });

  it("the ranks count as perk points spent, so the state stays consistent and valid", () => {
    const r = spendPerkPoint(raise(at(4), "shadow", 1), "shadow_soft_steps");
    if (!r.ok) throw new Error(r.reason);
    expect(isConsistentProgression(r.state)).toBe(true);
    expect(validPerks(r.state.attributes, r.state.perks)).toBe(true);
    expect(isConsistentProgression({ ...r.state, unspent: { ...r.state.unspent, perk: 3 } })).toBe(false);
    expect(validPerks(START_ATTRIBUTES, r.state.perks)).toBe(false);
    expect(validPerks(r.state.attributes, { shadow_soft_steps: 3 })).toBe(false);
    expect(validPerks(r.state.attributes, { gone_perk: 1 })).toBe(false);
  });
});

describe("what the perks do", () => {
  it("stats through StatModifiers: health, melee, armor, aim, crit damage, clothes", () => {
    const m = perkModifiers({ might_tough: 3, might_brawler: 2, might_hardened: 1, reflex_steady: 2, reflex_deadeye: 1, tech_tailor: 2 });
    expect(m).toEqual({ maxHp: 24, meleeDamage: 0.2, armor: 2, aimStability: 0.08, critMultiplier: 0.2, garmentArmor: 2 });
    const s = { ...INITIAL_PROGRESSION, perks: { might_tough: 1 } };
    expect(combineModifiers(BASE_STATS, progressionModifiers(s)).maxHp).toBe(BASE_STATS.maxHp + 8);
  });

  it("scales and flags the systems read", () => {
    expect(staminaRegenScale({ might_second_wind: 1 })).toBe(1.5);
    expect(parryStunScale({ might_crushing_parry: 1 })).toBe(2);
    expect(reloadTimeScale({ reflex_quick_reload: 2 })).toBeCloseTo(0.7);
    expect(dashCooldownScale({ reflex_slipstream: 1 })).toBeCloseTo(0.6);
    expect(healScale({ tech_field_medic: 2 })).toBe(1.5);
    expect(perkCyberCapacity({ tech_overclock: 2 })).toBe(4);
    expect(abilityCooldownRate({ tech_coolant: 1 })).toBe(1.4);
    expect(secondHeartShare({ tech_second_heart: 1 })).toBe(0.25);
    expect(perkRam({ net_buffer: 2 })).toBe(2);
    expect(perkUploadScale({ net_fast_upload: 2 })).toBeCloseTo(0.8);
    expect(ramRegenScale({ net_recycler: 1 })).toBe(1.5);
    expect(cameraSpotScale({ net_ghost_signal: 2 })).toBeCloseTo(0.7);
    expect(chainRadius({ net_chain: 1 })).toBe(8);
    expect(noiseScale({ shadow_soft_steps: 2 })).toBe(0.5);
    expect(takedownTimeScale({ shadow_quick_takedown: 2 })).toBeCloseTo(0.6);
    expect(carrySpeedBonus({ shadow_mule: 1 })).toBe(0.25);
    expect(crouchSpeedBonus({ shadow_prowler: 1 })).toBe(0.4);
  });

  it("a rank above the perk's ranks counts as its last", () => {
    expect(perkModifiers({ might_tough: 9 }).maxHp).toBe(24);
  });

  it("a medkit heals more with Field Medic, in whole points", () => {
    const inv = { capacity: 10, items: [], stacks: { medkit: 2 } } as unknown as Parameters<typeof useConsumable>[0];
    const plain = useConsumable(inv, "medkit", { current: 10, max: 200 });
    const medic = useConsumable(inv, "medkit", { current: 10, max: 200 }, 1.25);
    expect(plain.ok && medic.ok && [plain.healed, medic.healed]).toEqual([40, 50]);
  });
});

describe("the respec at Mori's", () => {
  /** Level 6: two points of Net, then Buffer. */
  const built = (): ProgressionState => {
    const r = spendPerkPoint(raise(at(6), "net", 1), "net_buffer");
    if (!r.ok) throw new Error(r.reason);
    return raise(r.state, "might", 2);
  };

  it("gives back every point and keeps the XP and the level", () => {
    const s = built();
    const reset = resetProgression(s);
    expect(reset).toMatchObject({ xp: s.xp, level: 6, attributes: START_ATTRIBUTES, perks: {}, unspent: { attribute: 5, perk: 5 } });
    expect(isConsistentProgression(reset)).toBe(true);
  });

  it("costs more the higher the level, after the standing", () => {
    expect(respecListPrice(1)).toBeLessThan(respecListPrice(10));
    expect(respecListPrice(30)).toBe(respecListPrice(99));
    expect(respecPrice(6, shopTerms(80))).toBeLessThan(respecPrice(6, STANDARD_TERMS));
  });

  it("is paid, and refused on basic terms, without the money, with nothing spent or with implants that would not fit", () => {
    const s = built();
    const price = respecPrice(6, STANDARD_TERMS);
    const ok = buyRespec({ eddies: price + 5 }, s, STANDARD_TERMS, () => true);
    expect(ok.ok && [ok.wallet.eddies, ok.price]).toEqual([5, price]);
    expect(buyRespec({ eddies: price - 1 }, s, STANDARD_TERMS, () => true)).toEqual({ ok: false, reason: "insufficient-funds" });
    expect(buyRespec({ eddies: 1e6 }, s, shopTerms(-80), () => true)).toEqual({ ok: false, reason: "refused" });
    expect(buyRespec({ eddies: 1e6 }, at(6), STANDARD_TERMS, () => true)).toEqual({ ok: false, reason: "empty-slot" });
    expect(buyRespec({ eddies: 1e6 }, s, STANDARD_TERMS, () => false)).toEqual({ ok: false, reason: "over-capacity" });
  });
});
