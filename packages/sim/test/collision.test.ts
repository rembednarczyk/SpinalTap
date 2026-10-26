import { describe, expect, it } from "vitest";
import { aabbFromCenter, rayAabb, resolveCircleAabb } from "../src";

const box = aabbFromCenter({ x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 });

describe("collision", () => {
  it("leaves a non-overlapping circle alone", () => {
    expect(resolveCircleAabb(3, 0, 0.5, box)).toEqual({ x: 3, z: 0 });
  });

  it("pushes an overlapping circle out of the nearest edge", () => {
    const r = resolveCircleAabb(1.2, 0, 0.5, box);
    expect(r.x).toBeCloseTo(1.5);
    expect(r.z).toBeCloseTo(0);
  });

  it("ejects a circle whose centre is inside the box", () => {
    const r = resolveCircleAabb(0.9, 0.1, 0.5, box);
    expect(r.x).toBeCloseTo(1.5);
  });

  it("intersects rays with boxes", () => {
    expect(rayAabb({ x: -5, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeCloseTo(4);
    expect(rayAabb({ x: -5, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull();
    expect(rayAabb({ x: -5, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 3)).toBeNull();
    expect(rayAabb({ x: -5, y: 1, z: 0 }, { x: -1, y: 0, z: 0 }, box, 100)).toBeNull();
  });
});
