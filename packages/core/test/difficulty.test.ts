import { describe, expect, it } from "vitest";
import { DIFFICULTY_FIELDS, DIFFICULTY_MAX, DIFFICULTY_MIN, DIFFICULTY_PRESETS, NORMAL_DIFFICULTY, createDomainState, isDifficultyProfile, presetOf } from "../src";

describe("difficulty profile (ADR-0066)", () => {
  it("'normal' is all ones and a new game's profile", () => {
    for (const f of DIFFICULTY_FIELDS) expect(NORMAL_DIFFICULTY[f]).toBe(1);
    expect(createDomainState().difficulty).toEqual(NORMAL_DIFFICULTY);
  });

  it("the presets follow the ADR's table: easier one way, harder the other, field by field", () => {
    expect(DIFFICULTY_PRESETS.story).toEqual({ damageTaken: 0.5, npcAccuracy: 0.6, awareness: 0.6, reinforce: 0.5, npcHealth: 0.8, snipeTell: 1.6 });
    expect(DIFFICULTY_PRESETS.hard).toEqual({ damageTaken: 1.4, npcAccuracy: 1.25, awareness: 1.3, reinforce: 1.5, npcHealth: 1.2, snipeTell: 0.8 });
    // A longer warning is easier; every other multiplier is easier below one.
    for (const f of DIFFICULTY_FIELDS) {
      const easier = f === "snipeTell" ? (a: number, b: number) => a > b : (a: number, b: number) => a < b;
      expect(easier(DIFFICULTY_PRESETS.story[f], 1), f).toBe(true);
      expect(easier(1, DIFFICULTY_PRESETS.hard[f]), f).toBe(true);
    }
  });

  it("names the preset of a profile, or 'custom'", () => {
    expect(presetOf({ ...DIFFICULTY_PRESETS.hard })).toBe("hard");
    expect(presetOf(DIFFICULTY_PRESETS.story)).toBe("story");
    expect(presetOf(NORMAL_DIFFICULTY)).toBe("normal");
    expect(presetOf({ ...NORMAL_DIFFICULTY, awareness: 1.1 })).toBe("custom");
  });

  it("a valid profile has all six multipliers in range", () => {
    for (const p of Object.values(DIFFICULTY_PRESETS)) expect(isDifficultyProfile(p)).toBe(true);
    expect(isDifficultyProfile({ ...NORMAL_DIFFICULTY, npcHealth: DIFFICULTY_MIN })).toBe(true);
    expect(isDifficultyProfile({ ...NORMAL_DIFFICULTY, npcHealth: DIFFICULTY_MAX })).toBe(true);
    expect(isDifficultyProfile({ ...NORMAL_DIFFICULTY, npcHealth: DIFFICULTY_MIN / 2 })).toBe(false);
    expect(isDifficultyProfile({ ...NORMAL_DIFFICULTY, reinforce: Infinity })).toBe(false);
    expect(isDifficultyProfile({ ...NORMAL_DIFFICULTY, reinforce: "1" })).toBe(false);
    expect(isDifficultyProfile(null)).toBe(false);
    expect(isDifficultyProfile({ damageTaken: 1 })).toBe(false);
  });
});
