import { describe, expect, it } from "vitest";
import { WOUNDED_PACE, WOUND_CRITICAL, WOUND_FROM, woundedGait } from "../src";

describe("wounds slow the player (user notes of 18.11)", () => {
  it("leaves her as she is from half her health up, slows her step by step below, and stops her running when badly hurt", () => {
    expect(woundedGait(1)).toEqual({ pace: 1, sprint: true });
    expect(woundedGait(WOUND_FROM)).toEqual({ pace: 1, sprint: true });
    const mid = woundedGait((WOUND_FROM + WOUND_CRITICAL) / 2);
    expect(mid.pace).toBeCloseTo(1 - (1 - WOUNDED_PACE) / 2, 9);
    expect(mid.sprint).toBe(true);
    expect(woundedGait(WOUND_CRITICAL)).toEqual({ pace: WOUNDED_PACE, sprint: false });
    expect(woundedGait(0.05)).toEqual({ pace: WOUNDED_PACE, sprint: false });
  });
});
