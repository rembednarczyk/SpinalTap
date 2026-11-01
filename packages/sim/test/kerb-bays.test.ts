import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE } from "@seki/core";
import { bayDepth, bayLayout, bayReach, bayYaw, stripCut, stripDepth } from "../src/content/kerb-bays";

/** A strip along the x axis, 4 to 6.2 m off it towards -z: side 1 of a way heading +x. */
const STRIP: (readonly [number, number])[] = [
  [0, -4],
  [40, -4],
  [40, -6.2],
  [0, -6.2],
];
const AXIS: (readonly [number, number])[] = [
  [-10, 0],
  [50, 0],
];
/** Across the axis at x = 20 towards the strip. */
const across = (d: number) => ({ x: 20, z: -d });

describe("kerb car park bays (G-177)", () => {
  it("find the strip's edges across the street to a centimetre", () => {
    const cut = stripCut(STRIP, across, 16)!;
    expect(cut.from).toBeCloseTo(4, 1);
    expect(cut.to).toBeCloseTo(6.2, 1);
    expect(Math.abs(cut.to - 6.2)).toBeLessThan(0.01);
    expect(stripCut(STRIP, (d) => ({ x: 60, z: -d }), 16)).toBeNull();
    expect(stripDepth(STRIP, AXIS, 1, 16)).toBeCloseTo(2.2, 1);
    expect(stripDepth(STRIP, AXIS, -1, 16)).toBe(0);
  });

  it("set a car along the kerb at the strip's outer edge, not in its middle", () => {
    const cut = stripCut(STRIP, across, 16)!;
    const d = bayDepth("parallel", "hatchback", cut)!;
    // Its side 0.25 m off the kerb at 6.2 m, its other side inside the strip.
    expect(d + VEHICLE_SIZE.hatchback.width / 2).toBeCloseTo(6.2 - 0.25, 1);
    expect(d - VEHICLE_SIZE.hatchback.width / 2).toBeGreaterThan(cut.from);
    // A strip too shallow for the gap holds it in its middle; one shallower than the car holds none.
    expect(bayDepth("parallel", "delivery", { from: 4, to: 6.1 })).toBeCloseTo(5.05, 2);
    expect(bayDepth("parallel", "delivery", { from: 4, to: 5.5 })).toBeNull();
    expect(bayDepth("perpendicular", "sedan", cut)).toBeNull();
  });

  it("turn cars across a strip mapped so, or a deep one without the tag", () => {
    expect(bayLayout("perpendicular", 2)).toBe("perpendicular");
    expect(bayLayout("diagonal", 2)).toBe("diagonal");
    expect(bayLayout("parallel", 8)).toBe("parallel");
    expect(bayLayout(undefined, 4.4)).toBe("parallel");
    expect(bayLayout(undefined, 5)).toBe("perpendicular");
    expect(bayReach("perpendicular", "sedan")).toBe(VEHICLE_SIZE.sedan.length);
    expect(bayReach("diagonal", "sedan")).toBeGreaterThan(VEHICLE_SIZE.sedan.width);
    expect(bayReach("diagonal", "sedan")).toBeLessThan(VEHICLE_SIZE.sedan.length);
  });

  it("face the traffic's way along the kerb, the kerb across it, and between the two on a diagonal", () => {
    const t = { tx: 1, tz: 0 };
    expect(bayYaw("parallel", t, 1, false)).toBeCloseTo(Math.PI / 2, 3);
    expect(bayYaw("parallel", t, -1, true)).toBeCloseTo(-Math.PI / 2, 3);
    // Side 1 lies towards −z: nose to the kerb faces −z (yaw π).
    expect(Math.abs(bayYaw("perpendicular", t, 1, false))).toBeCloseTo(Math.PI, 3);
    expect(bayYaw("perpendicular", t, -1, false)).toBeCloseTo(0, 3);
    expect(bayYaw("diagonal", t, -1, false)).toBeCloseTo(Math.PI / 4, 3);
  });
});
