import type { DriveInput } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type CarState, newCar } from "../src/world/vehicle/state";
import { driveCar, kmh, revs } from "../src/world/vehicle/step";
import { assists } from "../src/world/vehicle/tyre";
import type { CarGround } from "../src/world/vehicle/suspension";

/*
 * The HUD's lamps and tachometer (ADR-0097 §3): the car tells which assist eased a wheel in its
 * last substep, and its revs from idle to the limiter.
 */

const flat: CarGround = { heightAt: () => 0 };
const DT = 1 / 60;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });

/** Steps of `seconds` with `input`; how many of them had each assist lit. */
const lamps = (car: CarState, input: DriveInput, seconds: number, until?: (c: CarState) => boolean) => {
  const seen = { abs: 0, tc: 0, steps: 0 };
  for (let t = 0; t < seconds; t += DT) {
    driveCar(car, input, flat, DT);
    const a = assists(car);
    seen.abs += a.abs ? 1 : 0;
    seen.tc += a.tc ? 1 : 0;
    seen.steps++;
    if (until?.(car)) break;
  }
  return seen;
};

const settled = (): CarState => {
  const car = newCar("sedan", 0, 0, 0, 0);
  lamps(car, pedal({ handbrake: true, brake: 1 }), 2);
  return car;
};

describe("the assists' lamps and the revs (ADR-0097 §3)", () => {
  it("lights TC launching at full throttle, ABS braking hard from speed, neither cruising", () => {
    const car = settled();
    expect(revs(car)).toBe(0);
    const launch = lamps(car, pedal({ throttle: 1 }), 20, (c) => kmh(c) >= 100);
    expect(launch.tc).toBeGreaterThan(0);
    expect(launch.abs).toBe(0);
    expect(revs(car)).toBeGreaterThan(0.3);
    const cruise = lamps(car, pedal({ throttle: 0.3 }), 2);
    expect(cruise).toMatchObject({ abs: 0, tc: 0 });
    const stop = lamps(car, pedal({ brake: 1 }), 10, (c) => kmh(c) < 1);
    expect(stop.abs).toBeGreaterThan(0);
    expect(stop.tc).toBe(0);
  });

  it("keeps the revs between idle and the limiter", () => {
    const car = settled();
    for (let i = 0; i < 600; i++) {
      driveCar(car, pedal({ throttle: 1 }), flat, DT);
      expect(revs(car)).toBeGreaterThanOrEqual(0);
      expect(revs(car)).toBeLessThanOrEqual(1);
    }
  });
});
