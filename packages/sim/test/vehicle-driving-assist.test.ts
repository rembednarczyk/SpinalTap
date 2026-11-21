import { type DriveInput, DRIVING_ASSISTS, type DrivingAssist, vehicleSpec } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation } from "../src";
import { type CarState, newCar } from "../src/world/vehicle/state";
import { driveCar, kmh } from "../src/world/vehicle/step";
import { assists, steerAngles } from "../src/world/vehicle/tyre";
import type { CarGround } from "../src/world/vehicle/suspension";

/*
 * The player's driving assists (ADR-0097 §4): `full` keeps the steering to the tyres' grip at speed
 * with ABS and traction control; `abs` keeps ABS only and the rack's own lock; `off` none of them.
 */

const flat: CarGround = { heightAt: () => 0 };
const DT = 1 / 60;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });
const at = (assist: DrivingAssist, target: number): CarState => {
  const car = newCar("sedan", 0, 0, 0, 0);
  car.assist = assist;
  for (let t = 0; t < 2; t += DT) driveCar(car, pedal({ handbrake: true, brake: 1 }), flat, DT);
  for (let t = 0; t < 20 && kmh(car) < target; t += DT) driveCar(car, pedal({ throttle: 1 }), flat, DT);
  return car;
};
/** Steps braking hard; how many of them had ABS working. */
const absSteps = (car: CarState): number => {
  let n = 0;
  for (let t = 0; t < 3 && kmh(car) > 5; t += DT) {
    driveCar(car, pedal({ brake: 1 }), flat, DT);
    if (assists(car).abs) n++;
  }
  return n;
};
/** Steps launching at full throttle; how many of them had traction control working. */
const tcSteps = (assist: DrivingAssist): number => {
  const car = at(assist, 0);
  let n = 0;
  for (let t = 0; t < 3; t += DT) {
    driveCar(car, pedal({ throttle: 1 }), flat, DT);
    if (assists(car).tc) n++;
  }
  return n;
};

describe("the driving assists (ADR-0097 §4)", () => {
  it("brakes with ABS on full and abs only, never off", () => {
    expect(absSteps(at("full", 90))).toBeGreaterThan(0);
    expect(absSteps(at("abs", 90))).toBeGreaterThan(0);
    expect(absSteps(at("off", 90))).toBe(0);
  });

  it("eases a spinning wheel with traction control on full only", () => {
    expect(tcSteps("full")).toBeGreaterThan(0);
    expect(tcSteps("abs")).toBe(0);
    expect(tcSteps("off")).toBe(0);
  });

  it("steers at speed as far as the grip allows on full, the rack's whole lock otherwise", () => {
    const full = at("full", 100);
    const raw = at("off", 100);
    full.controls.steer = raw.controls.steer = 1;
    const spec = vehicleSpec("sedan");
    expect(steerAngles(raw, spec)[0]!).toBeGreaterThan(steerAngles(full, spec)[0]! * 1.3);
  });

  it("takes the setting by command into the session, and the car she drives takes it from there", () => {
    const sim = Simulation.create({ seed: 1, crowd: "off", traffic: "off" });
    expect(sim.session.drivingAssist).toBe("full");
    for (const assist of DRIVING_ASSISTS) {
      sim.enqueue({ type: "set-driving-assist", assist });
      sim.step();
      expect(sim.session.drivingAssist).toBe(assist);
    }
    sim.enqueue({ type: "set-driving-assist", assist: "nope" as DrivingAssist });
    sim.step();
    expect(sim.session.drivingAssist).toBe("off");
  });
});
