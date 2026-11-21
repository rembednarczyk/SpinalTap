import { describe, expect, it } from "vitest";
import type { Entity } from "../src";
import type { SimContext } from "../src/world/context";
import { v3 } from "../src/world/vehicle/frame";
import { newCar } from "../src/world/vehicle/state";
import { collideTraffic } from "../src/world/vehicle/world-car";

/** The driven car against the street's vehicles (ADR-0097 §2.7), on a world of one stopped car. */
const stopped = { id: 7, position: { x: 0, y: 0, z: 0 }, yaw: 0, vehicle: { v: 0, half: { l: 2.2, w: 0.9 } } } as unknown as Entity;
const ctx = { world: { with: () => [stopped] } } as unknown as SimContext;

describe("the car against the traffic (ADR-0097)", () => {
  it("stops its bonnet at a stopped car's boot, not its middle (the body's circles, not the centre)", () => {
    // Nose to tail: her centre 4 m behind its, her bonnet 1.75 m ahead of her centre, into its boot.
    const car = newCar("sedan", 0, 0, -4, 0);
    car.vel = v3(0, 0, 5);
    const hit = collideTraffic(ctx, car, 99);
    expect(hit.other).toBe(7);
    expect(hit.speed).toBeCloseTo(5, 5);
    expect(car.vel.z).toBeLessThan(0);
    expect(car.pos.z).toBeLessThan(-4);
  });

  it("leaves a car clear of it be", () => {
    const car = newCar("sedan", 0, 0, -6, 0);
    car.vel = v3(0, 0, 5);
    expect(collideTraffic(ctx, car, 99).other).toBeNull();
    expect(car.pos.z).toBe(-6);
  });
});
