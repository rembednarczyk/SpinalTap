import { describe, expect, it } from "vitest";
import { add, angleDelta, clamp, directionFromAngles, distance, distanceXZ, lerp, lerpAngle, normalize, scale, sub, vec3 } from "../src";

describe("vec3", () => {
  it("does basic arithmetic", () => {
    expect(add(vec3(1, 2, 3), vec3(1, 1, 1))).toEqual(vec3(2, 3, 4));
    expect(sub(vec3(1, 2, 3), vec3(1, 1, 1))).toEqual(vec3(0, 1, 2));
    expect(scale(vec3(1, 2, 3), 2)).toEqual(vec3(2, 4, 6));
    expect(distance(vec3(), vec3(3, 4, 0))).toBe(5);
    expect(distanceXZ(vec3(0, 9, 0), vec3(3, 0, 4))).toBe(5);
    expect(lerp(vec3(), vec3(10, 0, 0), 0.5).x).toBe(5);
    expect(normalize(vec3())).toEqual(vec3());
    expect(clamp(5, 0, 1)).toBe(1);
  });

  it("builds direction vectors from angles", () => {
    const fwd = directionFromAngles(0, 0);
    expect(fwd.z).toBeCloseTo(1);
    const right = directionFromAngles(Math.PI / 2, 0);
    expect(right.x).toBeCloseTo(1);
    expect(directionFromAngles(0, Math.PI / 2).y).toBeCloseTo(-1);
  });

  it("wraps angle differences", () => {
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2);
    expect(lerpAngle(0, Math.PI, 0.5)).toBeCloseTo(Math.PI / 2);
  });
});
