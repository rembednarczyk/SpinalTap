import { describe, expect, it } from "vitest";
import { strideReach } from "../src/renderer/clips/leg-pose";

/*
 * The run's stride (user's notes of 21.11: the steps and their sounds came too quick): up to the run
 * clip's own pace the stride is the clip's; past it, up to the sprint (6 m/s), it lengthens by up to
 * 35%, so the steps quicken less than the speed.
 */
describe("the stride at speed", () => {
  it("is the clip's up to its pace, a third longer at a sprint, no longer past it", () => {
    expect(strideReach(1.5)).toBe(1);
    expect(strideReach(3.5)).toBe(1);
    expect(strideReach(6)).toBeCloseTo(1.35, 6);
    expect(strideReach(9)).toBeCloseTo(1.35, 6);
    // Steps a minute at a sprint: the run clip's 171 at 3.65 m/s, quickened by speed over stride.
    const cadence = (v: number) => (171 * (v / 3.65)) / strideReach(v);
    expect(cadence(6)).toBeLessThan(215);
    expect(cadence(6)).toBeGreaterThan(200);
  });
});
