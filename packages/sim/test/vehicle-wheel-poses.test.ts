import type { DriveInput } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type CarState, newCar } from "../src/world/vehicle/state";
import { driveCar } from "../src/world/vehicle/step";
import type { CarGround } from "../src/world/vehicle/suspension";
import { carWheels } from "../src/world/vehicle/world-car";

/*
 * The car's wheels as drawn (ADR-0097 §3): each wheel's rolled distance follows the ground the car
 * covers, the front ones steer and the rear ones do not, and standing, the springs rest at their sag.
 */

const flat: CarGround = { heightAt: () => 0 };
const DT = 1 / 60;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });
const run = (car: CarState, input: DriveInput, seconds: number): void => {
  for (let t = 0; t < seconds; t += DT) driveCar(car, input, flat, DT);
};

describe("the wheels as drawn (ADR-0097 §3)", () => {
  it("rolls each wheel as far as the car goes, the front steering and the rear straight, the springs at rest standing", () => {
    const car = newCar("sedan", 0, 0, 0, 0);
    run(car, pedal({ handbrake: true, brake: 1 }), 2);
    const rest = carWheels(car);
    for (const w of rest) expect(Math.abs(w.lift)).toBeLessThan(0.03);
    const from = { ...car.pos };
    const rolled0 = rest.map((w) => w.rolled);
    run(car, pedal({ throttle: 0.4 }), 4);
    const gone = Math.hypot(car.pos.x - from.x, car.pos.z - from.z);
    expect(gone).toBeGreaterThan(5);
    carWheels(car).forEach((w, i) => expect(w.rolled - rolled0[i]!).toBeCloseTo(gone, -0.3));
    run(car, pedal({ throttle: 0.2, steer: 1 }), 0.5);
    const turned = carWheels(car);
    expect(turned[0]!.steer).toBeGreaterThan(0.05);
    expect(turned[1]!.steer).toBeGreaterThan(0.05);
    expect(turned[2]!.steer).toBe(0);
    expect(turned[3]!.steer).toBe(0);
  });
});
