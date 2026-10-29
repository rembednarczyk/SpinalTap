import { describe, expect, it } from "vitest";
import { OrbitCamera } from "../src/lublin-preview/orbit-camera";

describe("map preview camera (ADR-0044)", () => {
  it("looks from a position at a target and gives the position back", () => {
    const cam = new OrbitCamera({ position: { x: 10, y: 20, z: -30 }, target: { x: 40, y: 2, z: 15 } });
    const p = cam.position;
    expect(p.x).toBeCloseTo(10, 9);
    expect(p.y).toBeCloseTo(20, 9);
    expect(p.z).toBeCloseTo(-30, 9);
  });

  it("slides the target forward along the view and keeps the pitch in range", () => {
    const cam = new OrbitCamera({ position: { x: 0, y: 10, z: -10 }, target: { x: 0, y: 0, z: 0 } });
    cam.move(5, 0);
    expect(cam.target.z).toBeCloseTo(5, 9);
    expect(cam.target.x).toBeCloseTo(0, 9);
    cam.move(0, 3);
    expect(cam.target.x).toBeCloseTo(3, 9);
    cam.rotate(0, 10);
    expect(cam.pitch).toBeLessThanOrEqual(1.55);
    cam.zoom(1e6);
    expect(cam.distance).toBe(900);
  });
});
