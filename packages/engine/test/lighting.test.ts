import { describe, expect, it } from "vitest";
import { DAY_RIG, NIGHT_RIG, mixHex, rigForDaylight } from "../src/npr/lighting";

describe("time-of-day light rig", () => {
  it("is exactly the night rig at night and the day rig by day", () => {
    expect(rigForDaylight(0)).toBe(NIGHT_RIG);
    expect(rigForDaylight(-1)).toBe(NIGHT_RIG);
    expect(rigForDaylight(1)).toBe(DAY_RIG);
    expect(rigForDaylight(2)).toBe(DAY_RIG);
  });

  it("interpolates ambient, fog and light colours in between, keeping the moon direction", () => {
    const dusk = rigForDaylight(0.5);
    expect(dusk.sunDir).toBe(NIGHT_RIG.sunDir);
    expect(dusk.ambient).toBe(mixHex(NIGHT_RIG.ambient, DAY_RIG.ambient, 0.5));
    expect(dusk.fogDensity).toBeCloseTo((NIGHT_RIG.fogDensity + DAY_RIG.fogDensity) / 2);
    expect(dusk.fogColor).not.toBe(NIGHT_RIG.fogColor);
    expect(dusk.fogColor).not.toBe(DAY_RIG.fogColor);
  });

  it("mixes hex colours per channel", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#102030", "#305070", 0.5)).toBe("#203850");
  });
});
