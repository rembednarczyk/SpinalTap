import { describe, expect, it } from "vitest";
import { LOW_QUALITY_MAX_RATIO, lowQualityScaling } from "../src/renderer/stage";

describe("low quality render scale", () => {
  it("renders phones at up to 1.5 device pixels per CSS pixel, never below the CSS size", () => {
    // Level L renders cssSize / L pixels: 1 / 1.5 is 1.5x the CSS size.
    expect(lowQualityScaling(3)).toBeCloseTo(1 / LOW_QUALITY_MAX_RATIO);
    expect(lowQualityScaling(2.5)).toBeCloseTo(1 / 1.5);
    expect(lowQualityScaling(1.25)).toBeCloseTo(1 / 1.25);
    expect(lowQualityScaling(1)).toBe(1);
    expect(lowQualityScaling(0)).toBe(1);
    for (const dpr of [1, 1.5, 2, 2.75, 3, 4]) expect(lowQualityScaling(dpr)).toBeLessThanOrEqual(1);
  });
});
