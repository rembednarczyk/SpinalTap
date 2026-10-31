import { describe, expect, it } from "vitest";
import { freshPuppet, puppetPose, setPuppetActivity, stepPuppet } from "../src/renderer/crowd-pose";
import { puppetDims } from "../src/renderer/crowd-puppet";

/**
 * The reference still is drawn after however long the page took to load (G-044, like G-030 for
 * named characters): with the clock stopped a resident's pose must not depend on how many frames
 * or how long they were.
 */
const poseAfter = (frames: number, dt: number, clock: number | undefined, speed: number, activity: "smoke" | null) => {
  const s = freshPuppet();
  setPuppetActivity(s, activity);
  for (let i = 0; i < frames; i++) stepPuppet(s, speed, 0, dt, clock ?? dt);
  return puppetPose(s, speed, puppetDims(1.7, 1), false);
};

describe("crowd clock in the reference still (G-044)", () => {
  it("poses a walking or busy resident the same however long the page took", () => {
    for (const [speed, activity] of [[1.2, null], [0, "smoke"]] as const) {
      expect(poseAfter(170, 1 / 23, 0, speed, activity)).toEqual(poseAfter(40, 1 / 60, 0, speed, activity));
    }
  });

  it("keeps walking and the activity cycle moving in play", () => {
    expect(poseAfter(170, 1 / 23, undefined, 1.2, null)).not.toEqual(poseAfter(40, 1 / 60, undefined, 1.2, null));
    expect(poseAfter(170, 1 / 23, undefined, 0, "smoke")).not.toEqual(poseAfter(40, 1 / 60, undefined, 0, "smoke"));
  });
});
