import { describe, expect, it } from "vitest";
import { LOW_QUALITY_MAX_RATIO, RENDER_RESOLUTION_RANGE, lowQualityScaling, renderScaling } from "../src/renderer/stage";

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

describe("render resolution (graphics options 14.11)", () => {
  it("renders the device's pixels at 100% and the slider's share of them below", () => {
    expect(renderScaling("high", 2, 1)).toBeCloseTo(1 / 2);
    expect(renderScaling("high", 2, 0.7)).toBeCloseTo(1 / 1.4);
    expect(renderScaling("medium", 1, 0.5)).toBeCloseTo(2);
    expect(renderScaling(undefined, 3, 0.75)).toBeCloseTo(1 / 2.25);
  });

  it("keeps Low's cap: 100% is today's Low scale, the slider only lowers it", () => {
    for (const dpr of [1, 1.25, 2, 3]) expect(renderScaling("low", dpr, 1)).toBeCloseTo(lowQualityScaling(dpr));
    expect(renderScaling("low", 3, 0.5)).toBeCloseTo(1 / 0.75);
    // Never more pixels on Low than on High at the same share.
    for (const dpr of [1, 2, 3]) for (const s of [0.5, 0.7, 1]) expect(renderScaling("low", dpr, s)).toBeGreaterThanOrEqual(renderScaling("high", dpr, s) - 1e-9);
  });

  it("clamps the share to 50-100% and takes a broken one as 100%", () => {
    expect(RENDER_RESOLUTION_RANGE).toEqual([0.5, 1]);
    expect(renderScaling("high", 1, 0.2)).toBeCloseTo(2);
    expect(renderScaling("high", 1, 1.6)).toBe(1);
    expect(renderScaling("high", 1, Number.NaN)).toBe(1);
    expect(renderScaling("high", 0, 1)).toBe(1);
  });
});
