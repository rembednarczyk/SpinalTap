import { describe, expect, it } from "vitest";
import { applyMsaa, msaaSamples } from "../src/npr/msaa";
import { BLOOM_THRESHOLD, QUALITY_TIERS } from "../src/npr/quality";

describe("msaa (graphics backlog 13.11, step 1)", () => {
  it("asks for the tier's samples within the GPU's limit", () => {
    expect(msaaSamples(4, 8)).toBe(4);
    expect(msaaSamples(4, 2)).toBe(2);
    expect(msaaSamples(4, undefined)).toBe(1);
    expect(msaaSamples(0, 8)).toBe(1);
  });

  it("multisamples the first post-process on the camera, the one the scene renders into", () => {
    const lineArt = { samples: 1 };
    const grading = { samples: 1 };
    expect(applyMsaa([null, lineArt, grading], 4, 16)).toBe(4);
    expect(lineArt.samples).toBe(4);
    expect(grading.samples).toBe(1);
  });

  it("leaves the chain alone without post-processes or on one sample", () => {
    expect(applyMsaa([], 4, 16)).toBe(1);
    const only = { samples: 1 };
    expect(applyMsaa([only], 1, 16)).toBe(1);
    expect(only.samples).toBe(1);
  });

  it("keeps phones on one sample and gives high quality four", () => {
    expect(QUALITY_TIERS.low.msaa).toBe(1);
    expect(QUALITY_TIERS.low.sharpen).toBe(0);
    expect(QUALITY_TIERS.high.msaa).toBe(4);
  });
});

describe("bloom (graphics backlog 13.11, step 3)", () => {
  it("blooms on high quality only, over the brightest pixels", () => {
    expect(QUALITY_TIERS.high.bloom).toBeGreaterThan(0);
    expect(QUALITY_TIERS.medium.bloom).toBe(0);
    expect(QUALITY_TIERS.low.bloom).toBe(0);
    expect(BLOOM_THRESHOLD).toBeGreaterThanOrEqual(0.85);
  });
});
