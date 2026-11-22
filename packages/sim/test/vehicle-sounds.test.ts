import { describe, expect, it } from "vitest";
import { World } from "miniplex";
import { vehicleSpec } from "@seki/core";
import type { Entity } from "../src/world/components";
import type { SimContext } from "../src/world/context";
import { SENSOR_RANGE, rearGap } from "../src/world/vehicle/rear-gap";
import { newCar } from "../src/world/vehicle/state";
import { collideSolids } from "../src/world/vehicle/world-car";

/*
 * What the car gives its sounds besides its engine (the user's request of 22.11): how fast its body
 * slides along a wall it touches (the scrape and the sparks) and the gap behind its rear bumper (its
 * parking sensor's beeps in reverse).
 */

const still = { position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 };
const box = (x0: number, z0: number, x1: number, z1: number) => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 3, z: z1 } });
const withWall = (x0: number, z0: number, x1: number, z1: number) => {
  const world = new World<Entity>();
  world.add({ ...still, id: 5, solid: box(x0, z0, x1, z1) });
  return { world, ctx: { world } as unknown as SimContext };
};

describe("a car's contact with the world for its sounds (22.11)", () => {
  it("slides along a wall it touches at the speed along it, none off it or head-on", () => {
    const half = vehicleSpec("sedan").half;
    // A wall along the car's right side (+x), the car pressed into it a few centimetres, going forwards (+z).
    const { ctx } = withWall(half.x - 0.05, -10, half.x + 1, 10);
    const car = newCar("sedan", 0, 0, 0, 0);
    car.vel = { x: 1, y: 0, z: 12 };
    collideSolids(ctx, car);
    expect(car.scrape).toBeGreaterThan(11);
    expect(car.scrape).toBeLessThan(13);
    // Off the wall: nothing.
    const free = newCar("sedan", -5, 0, 0, 0);
    free.vel = { x: 0, y: 0, z: 12 };
    collideSolids(ctx, free);
    expect(free.scrape).toBe(0);
    // Head-on into a wall across its nose: a hit, no slide along it.
    const front = withWall(-3, half.z - 0.05, 3, half.z + 1);
    const head = newCar("sedan", 0, 0, 0, 0);
    head.vel = { x: 0, y: 0, z: 5 };
    collideSolids(front.ctx, head);
    expect(head.scrape).toBeLessThan(0.5);
  });

  it("reads the gap behind its rear bumper to a post, none past the sensor's range", () => {
    const half = vehicleSpec("sedan").half;
    // A post 0.8 m behind the bumper (the car faces +z, its back at -half.z).
    const { world } = withWall(-0.2, -half.z - 0.8 - 0.3, 0.2, -half.z - 0.8);
    const car = newCar("sedan", 0, 0, 0, 0);
    expect(rearGap(world, car)).toBeCloseTo(0.8, 1);
    const far = withWall(-0.2, -half.z - SENSOR_RANGE - 1, 0.2, -half.z - SENSOR_RANGE - 0.5);
    expect(rearGap(far.world, car)).toBeNull();
    // A post off its middle, behind a corner: the corner's sensor finds it.
    const corner = withWall(0.4, -half.z - 0.5 - 0.3, 0.8, -half.z - 0.5);
    expect(rearGap(corner.world, car)).toBeCloseTo(0.5, 1);
  });
});
