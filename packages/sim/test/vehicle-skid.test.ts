import type { DriveInput } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type CarState, newCar } from "../src/world/vehicle/state";
import { driveCar, kmh } from "../src/world/vehicle/step";
import { skid } from "../src/world/vehicle/tyre";
import type { CarGround } from "../src/world/vehicle/suspension";

/*
 * The tyres' slide for their squeal (ADR-0097 §3): an ordinary bend on the steering's assists stays
 * under the squeal's start (0.35, `SQUEAL_FROM` in the engine's audio), a handbrake turn and a launch
 * on full throttle go over it.
 */

const flat: CarGround = { heightAt: () => 0 };
const DT = 1 / 60;
const SQUEAL_FROM = 0.35;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });
const most = (car: CarState, input: DriveInput, seconds: number): number => {
  let top = 0;
  for (let t = 0; t < seconds; t += DT) {
    driveCar(car, input, flat, DT);
    top = Math.max(top, skid(car));
  }
  return top;
};
const at = (target: number): CarState => {
  const car = newCar("sedan", 0, 0, 0, 0);
  most(car, pedal({ handbrake: true, brake: 1 }), 2);
  for (let t = 0; t < 20 && kmh(car) < target; t += DT) driveCar(car, pedal({ throttle: 1 }), flat, DT);
  return car;
};

describe("the tyres' slide (ADR-0097 §3)", () => {
  it("stays under the squeal cruising and in an ordinary bend", () => {
    const car = at(50);
    expect(most(car, pedal({ throttle: 0.3 }), 2)).toBeLessThan(SQUEAL_FROM);
    expect(most(car, pedal({ throttle: 0.3, steer: 0.5 }), 3)).toBeLessThan(SQUEAL_FROM);
  });

  it("goes over it in a handbrake turn", () => {
    const car = at(60);
    expect(most(car, pedal({ steer: 1, handbrake: true }), 1.5)).toBeGreaterThan(0.8);
  });
});
