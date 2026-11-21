import type { DriveInput } from "@seki/core";
import { describe, expect, it } from "vitest";
import { DAMAGE_ENERGY, WEAKEST, enginePower, takeHit, wrecked } from "../src/world/vehicle/damage";
import { type CarState, newCar } from "../src/world/vehicle/state";
import { driveCar, kmh } from "../src/world/vehicle/step";
import type { CarGround } from "../src/world/vehicle/suspension";

/*
 * A car's damage (ADR-0097 §5): the hits' energy adds up to a wreck; past 0.4 the engine weakens,
 * a wreck's is dead.
 */

const flat: CarGround = { heightAt: () => 0 };
const DT = 1 / 60;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });
const settled = (damage: number): CarState => {
  const car = newCar("sedan", 0, 0, 0, 0);
  car.damage = damage;
  for (let t = 0; t < 2; t += DT) driveCar(car, pedal({ handbrake: true, brake: 1 }), flat, DT);
  return car;
};
const after = (car: CarState, seconds: number): number => {
  for (let t = 0; t < seconds; t += DT) driveCar(car, pedal({ throttle: 1 }), flat, DT);
  return kmh(car);
};

describe("a car's damage (ADR-0097 §5)", () => {
  it("adds up the hits' energy to a wreck, and says so once", () => {
    const car = newCar("sedan", 0, 0, 0, 0);
    // Three crashes at 50 km/h into a wall (130 kJ each for 1.35 t) do not quite wreck it; a fourth does.
    const crash = 0.5 * 1350 * (50 / 3.6) ** 2;
    expect([takeHit(car, crash), takeHit(car, crash), takeHit(car, crash)]).toEqual([false, false, false]);
    expect(car.damage).toBeCloseTo((3 * crash) / DAMAGE_ENERGY, 9);
    expect(wrecked(car)).toBe(false);
    expect(takeHit(car, crash)).toBe(true);
    expect(car.damage).toBe(1);
    expect(takeHit(car, crash)).toBe(false);
  });

  it("weakens the engine past 0.4 and kills a wreck's", () => {
    expect(enginePower(0)).toBe(1);
    expect(enginePower(0.4)).toBe(1);
    expect(enginePower(0.7)).toBeLessThan(1);
    expect(enginePower(0.999)).toBeCloseTo(WEAKEST, 2);
    expect(enginePower(1)).toBe(0);
    const whole = after(settled(0), 4);
    const battered = after(settled(0.9), 4);
    const wreck = after(settled(1), 4);
    expect(battered).toBeLessThan(whole * 0.8);
    expect(battered).toBeGreaterThan(10);
    expect(wreck).toBeLessThan(1);
  });
});
