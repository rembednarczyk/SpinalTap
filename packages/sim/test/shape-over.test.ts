import { describe, expect, it } from "vitest";
import { type Pad, type Ramp, shapeHeight } from "../src/content/lublin/shape";

/**
 * A ramp laid over the pads (ADR-0074 stage 2, the stairs from T1 down to T2): a terrace's blend
 * reaching over it leaves its grade as it is, where a ramp under the pads gives way to the blend.
 */
describe("a ramp laid over the pads", () => {
  // A terrace at y 0 up to z 10 blending 8 m north, and a ramp from it down to -3 at z 26.
  const pad: Pad = { rect: { minX: 0, maxX: 20, minZ: 0, maxZ: 10 }, y: 0, blend: 8 };
  const ramp: Ramp = { a: { x: 10, z: 10 }, b: { x: 10, z: 26 }, ya: 0, yb: -3, width: 6, blend: 2, square: true };

  it("keeps its grade through the terrace's blend", () => {
    for (const z of [12, 14, 16, 18, 22]) {
      const want = (-3 * (z - 10)) / 16;
      expect(shapeHeight(10, z, -5, [pad], [{ ...ramp, over: true }]), `z ${z}`).toBeCloseTo(want, 6);
    }
  });

  it("under the pads, as the other ramps are, gives way to the blend", () => {
    expect(shapeHeight(10, 12, -5, [pad], [ramp])).toBeGreaterThan(-0.2);
    expect(shapeHeight(10, 12, -5, [pad], [ramp])).not.toBeCloseTo(-0.375, 2);
    // Off the ramp both leave the terrace's blend alone.
    expect(shapeHeight(30, 12, -5, [pad], [{ ...ramp, over: true }])).toBe(shapeHeight(30, 12, -5, [pad], [ramp]));
  });
});
