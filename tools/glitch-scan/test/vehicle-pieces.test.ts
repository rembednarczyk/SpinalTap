import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE } from "../../../packages/core/src";
import type { VehicleTemplate } from "../../../packages/engine/src/renderer/vehicle-models";
import { vehicleFaults } from "./vehicle-pieces";

/**
 * The glitch scan's checks of the vehicles' looks (ADR-0058 stage 4) on boxes of their own: each
 * check finds the look that misses its body, and nothing in a look that fills it.
 */

/** A box from (x0, y0, z0) to (x1, y1, z1) as a template's corners (triangles do not matter here). */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): VehicleTemplate => {
  const positions = new Float32Array([x0, y0, z0, x1, y1, z1]);
  return { positions, normals: new Float32Array(6), uvs: new Float32Array(4), colors: new Float32Array(8), indices: new Uint32Array(0), vertexCount: 2 };
};
const { width: w, length: l, height: h } = VEHICLE_SIZE.sedan;

describe("vehicle checks of the glitch scan (ADR-0058 stage 4)", () => {
  it("passes a look that fills its body", () => {
    expect(vehicleFaults("sedan", "near", box(-w / 2, 0, -l / 2, w / 2, h, l / 2))).toEqual({});
  });

  it("finds a look out of its body: wider, longer or taller", () => {
    expect(vehicleFaults("sedan", "near", box(-w / 2 - 0.1, 0, -l / 2, w / 2, h, l / 2))).toHaveProperty("vehicle-off-body");
    expect(vehicleFaults("sedan", "far", box(-w / 2, 0, -l / 2, w / 2, h, l / 2 + 0.3))).toHaveProperty("vehicle-off-body");
    expect(vehicleFaults("sedan", "lite", box(-w / 2, 0, -l / 2, w / 2, h + 0.2, l / 2))).toHaveProperty("vehicle-off-body");
    // The trolleybus's booms reach up to the wires near; its far version has none.
    const t = VEHICLE_SIZE.trolleybus;
    expect(vehicleFaults("trolleybus", "near", box(-t.width / 2, 0, -t.length / 2, t.width / 2, 6.05, t.length / 2))).toEqual({});
    expect(vehicleFaults("trolleybus", "far", box(-t.width / 2, 0, -t.length / 2, t.width / 2, 6.05, t.length / 2))).toHaveProperty("vehicle-off-body");
  });

  it("finds a look short of its body, and one off the road", () => {
    expect(vehicleFaults("sedan", "near", box(-w / 2, 0, -l / 2 + 0.4, w / 2, h, l / 2))).toHaveProperty("vehicle-short-of-body");
    expect(vehicleFaults("sedan", "near", box(-w / 3, 0, -l / 2, w / 3, h, l / 2))).toHaveProperty("vehicle-short-of-body");
    expect(vehicleFaults("sedan", "near", box(-w / 2, 0.2, -l / 2, w / 2, h, l / 2))).toHaveProperty("vehicle-floating");
    expect(vehicleFaults("sedan", "near", box(-w / 2, -0.1, -l / 2, w / 2, h, l / 2))).toHaveProperty("vehicle-floating");
  });
});
