import { describe, expect, it } from "vitest";
import { CarChase } from "../src/camera/car-chase";

/** The chase camera behind the car (ADR-0097, after PodRcr's chase view), stepped at 60 Hz. */
const DT = 1 / 60;

describe("the camera behind the car", () => {
  it("settles behind and over a car driving straight, looking ahead of it", () => {
    const chase = new CarChase();
    let shot = chase.update({ x: 0, y: 0, z: 0 }, 0, 0, DT);
    for (let i = 1; i <= 180; i++) shot = chase.update({ x: 0, y: 0, z: i * 0.2 }, 0, 0, DT);
    const car = 180 * 0.2;
    expect(Math.abs(shot.eye.x)).toBeLessThan(0.01);
    expect(car - shot.eye.z).toBeGreaterThan(4.5);
    expect(car - shot.eye.z).toBeLessThan(6.5);
    expect(shot.eye.y).toBeGreaterThan(1.6);
    expect(shot.target.z).toBeGreaterThan(car + 4);
    // 12 m/s widens the view a little and brings the camera in by as much.
    expect(shot.widen).toBeGreaterThan(0.03);
  });

  it("stands on the road just driven in a turn, not on the car's axis into the corner's wall", () => {
    const chase = new CarChase();
    // North 30 m, then sharp right (east) 4 m: the axis behind the car points back west into the corner.
    const path: [number, number][] = [];
    for (let z = 0; z <= 30; z += 0.2) path.push([0, z]);
    for (let x = 0.2; x <= 4; x += 0.2) path.push([x, 30]);
    let shot = chase.update({ x: 0, y: 0, z: 0 }, 0, 0, DT);
    for (const [x, z] of path) shot = chase.update({ x, y: 0, z }, x > 0 ? Math.PI / 2 : 0, 0, DT);
    // Most of the way behind lies down the road it came along (x = 0), south of the corner.
    for (let i = 0; i < 120; i++) shot = chase.update({ x: 4, y: 0, z: 30 }, Math.PI / 2, 0, DT);
    expect(shot.eye.x).toBeLessThan(1);
    expect(shot.eye.z).toBeLessThan(29);
  });

  it("swings round the car when she looks aside", () => {
    const chase = new CarChase();
    let shot = chase.update({ x: 0, y: 0, z: 0 }, 0, 0, DT);
    for (let i = 0; i < 120; i++) shot = chase.update({ x: 0, y: 0, z: 0 }, 0, Math.PI / 2, DT);
    // Looking to her right (+x), the camera stands on her left (-x).
    expect(shot.eye.x).toBeLessThan(-4);
    expect(shot.target.x).toBeGreaterThan(3);
  });
});
