import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_MAX,
  BASE_CYBER_CAPACITY,
  BASE_STATS,
  type Attributes,
  INITIAL_PROGRESSION,
  MAX_AIM_STABILITY,
  START_ATTRIBUTES,
  ZONE_ARMOR_CAP,
  adsTimeScale,
  attributeCyberCapacity,
  attributeModifiers,
  attributePoints,
  attributeRam,
  capacityMax,
  combineModifiers,
  detectionScale,
  progressionModifiers,
  uploadTimeScale,
  zoneArmor,
} from "../src";

const at = (patch: Partial<Attributes>): Attributes => ({ ...START_ATTRIBUTES, ...patch });

describe("passive effects of the attributes (ADR-0059, stage 2)", () => {
  it("a new character (3 everywhere) is exactly as before the attributes existed", () => {
    const stats = combineModifiers(BASE_STATS, [attributeModifiers(START_ATTRIBUTES)]);
    expect(stats).toEqual(BASE_STATS);
    expect([adsTimeScale(START_ATTRIBUTES), uploadTimeScale(START_ATTRIBUTES), detectionScale(START_ATTRIBUTES)]).toEqual([1, 1, 1]);
    expect([attributeRam(START_ATTRIBUTES), attributeCyberCapacity(START_ATTRIBUTES)]).toEqual([0, 0]);
    expect(combineModifiers(BASE_STATS, progressionModifiers(INITIAL_PROGRESSION))).toEqual(BASE_STATS);
  });

  it("Might: +4 health and +2% melee damage per point", () => {
    const stats = combineModifiers(BASE_STATS, [attributeModifiers(at({ might: 8 }))]);
    expect(stats.maxHp).toBe(BASE_STATS.maxHp + 20);
    expect(stats.meleeDamage).toBeCloseTo(0.1);
  });

  it("Reflex: +1% aim stability per point and a shorter time to aim down sights", () => {
    const stats = combineModifiers(BASE_STATS, [attributeModifiers(at({ reflex: 13 }))]);
    expect(stats.aimStability).toBeCloseTo(0.1);
    expect(adsTimeScale(at({ reflex: 13 }))).toBeCloseTo(0.8);
    // Implants and the attribute together still stop at the cap.
    expect(combineModifiers(BASE_STATS, [{ aimStability: MAX_AIM_STABILITY }, attributeModifiers(at({ reflex: 15 }))]).aimStability).toBe(MAX_AIM_STABILITY);
  });

  it("Tech: +1 armor on the zones clothes protect, and a cyberware point per 3 points", () => {
    const stats = combineModifiers(BASE_STATS, [attributeModifiers(at({ tech: 5 }))]);
    const jacket = [{ def: "seki_jacket" as const, rarity: "common" as const, condition: 100 }];
    expect(zoneArmor(stats, jacket, "torso")).toBe(zoneArmor(BASE_STATS, jacket, "torso") + 2);
    // A bare zone gets nothing: the bonus is the clothes'.
    expect(zoneArmor(stats, jacket, "leg")).toBe(zoneArmor(BASE_STATS, jacket, "leg"));
    expect(zoneArmor({ ...stats, garmentArmor: 99 }, jacket, "torso")).toBe(ZONE_ARMOR_CAP);
    expect([4, 5, 6, 9, 15].map((tech) => attributeCyberCapacity(at({ tech })))).toEqual([0, 0, 1, 2, 4]);
    expect(capacityMax(1, 0, attributeCyberCapacity(at({ tech: 15 })))).toBe(BASE_CYBER_CAPACITY + 4);
  });

  it("Net: +1 RAM per 2 points and a faster upload", () => {
    expect([4, 5, 6, 15].map((net) => attributeRam(at({ net })))).toEqual([0, 1, 1, 6]);
    expect(uploadTimeScale(at({ net: 8 }))).toBeCloseTo(0.9);
  });

  it("Shadow: detection 2% slower per point and +0.5% crit chance", () => {
    expect(detectionScale(at({ shadow: 15 }))).toBeCloseTo(0.76);
    expect(combineModifiers(BASE_STATS, [attributeModifiers(at({ shadow: 7 }))]).critChance).toBeCloseTo(BASE_STATS.critChance + 0.02);
  });

  it("counts only 3..15: a broken value neither takes away nor goes past the cap", () => {
    expect(attributePoints(at({ might: 1 }), "might")).toBe(0);
    expect(attributePoints(at({ might: 40 }), "might")).toBe(ATTRIBUTE_MAX - 3);
    expect(attributePoints(at({ might: Number.NaN }), "might")).toBe(0);
  });
});
