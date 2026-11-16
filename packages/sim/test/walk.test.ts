import { describe, expect, it } from "vitest";
import { MAX_WALK_SLOPE } from "../src/world/ground";
import { SNAP_DOWN, STEP_HEIGHT } from "../src/systems/movement-system";
import { walkBoth, walkStep } from "../src/world/walk";

const at = (y: number, slope = 0, flight = false) => ({ y, slope, flight });

describe("walkStep (ADR-0080)", () => {
  it("takes the thresholds of the movement and of ADR-0043", () => {
    expect([STEP_HEIGHT, SNAP_DOWN]).toEqual([0.45, 0.35]);
    expect(MAX_WALK_SLOPE).toBeCloseTo(Math.tan((35 * Math.PI) / 180), 12);
  });

  it("walks up a step up to STEP_HEIGHT and no higher", () => {
    expect(walkStep(at(0), at(0.44))).toBeNull();
    expect(walkStep(at(0), at(0.45))).toBeNull();
    expect(walkStep(at(0), at(0.46))).toBe("rise");
  });

  it("walks down a step up to SNAP_DOWN and no lower", () => {
    expect(walkStep(at(0.34), at(0))).toBeNull();
    expect(walkStep(at(0.35), at(0))).toBeNull();
    expect(walkStep(at(0.36), at(0))).toBe("drop");
  });

  it("goes up a 0.4 m step but not down it: the pair is blocked", () => {
    expect(walkStep(at(0), at(0.4))).toBeNull();
    expect(walkStep(at(0.4), at(0))).toBe("drop");
    expect(walkBoth(at(0), at(0.4))).toBe("drop");
    expect(walkBoth(at(0), at(0.3))).toBeNull();
  });

  it("stops at a bank steeper than MAX_WALK_SLOPE", () => {
    expect(walkStep(at(0), at(0.1, MAX_WALK_SLOPE - 0.01))).toBeNull();
    expect(walkStep(at(0), at(0.1, MAX_WALK_SLOPE + 0.01))).toBe("steep");
    // Off a bank onto level ground one goes; the pair is blocked the other way.
    expect(walkStep(at(0.1, 1), at(0))).toBeNull();
    expect(walkBoth(at(0.1, 1), at(0))).toBe("steep");
  });

  it("takes a flight of steps steeper than a bank, but not a riser over a step", () => {
    expect(walkStep(at(0), at(0.15, 1.2, true))).toBeNull();
    expect(walkBoth(at(0, 1.2, true), at(0.15, 1.2, true))).toBeNull();
    expect(walkStep(at(0, 1.2, true), at(0.5, 1.2, true))).toBe("rise");
  });
});
