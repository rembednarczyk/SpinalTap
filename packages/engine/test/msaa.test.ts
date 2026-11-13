import { describe, expect, it } from "vitest";
import { applyMsaa, msaaSamples } from "../src/npr/msaa";
import { QUALITY_TIERS } from "../src/npr/quality";

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

  it("keeps phones on one sample and gives high quality two (user: High stuttered at four)", () => {
    expect(QUALITY_TIERS.low.msaa).toBe(1);
    expect(QUALITY_TIERS.low.sharpen).toBe(0);
    expect(QUALITY_TIERS.high.msaa).toBe(2);
  });
});
