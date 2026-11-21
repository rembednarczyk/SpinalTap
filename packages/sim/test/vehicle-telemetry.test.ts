import { vehicleSpec } from "@seki/core";
import { describe, expect, it } from "vitest";
import { newCar } from "../src/world/vehicle/state";
import { driveCar } from "../src/world/vehicle/step";
import type { CarGround } from "../src/world/vehicle/suspension";
import { carTelemetry } from "../src/world/vehicle/telemetry";

/** The car's telemetry (ADR-0097 §3): standing, its wheels touch the ground under their mounts and carry its weight, gripping. */
describe("the car's telemetry (ADR-0097 §3)", () => {
  it("rays down from each mount to the ground, the loads its weight, no slide standing", () => {
    const flat: CarGround = { heightAt: () => 0 };
    const car = newCar("sedan", 0, 0, 0, 0);
    for (let t = 0; t < 2; t += 1 / 60) driveCar(car, { throttle: 0, brake: 1, steer: 0, handbrake: true }, flat, 1 / 60);
    const wheels = carTelemetry(car);
    expect(wheels).toHaveLength(4);
    for (const w of wheels) {
      expect(w.contact).not.toBeNull();
      expect(w.contact!.y).toBeCloseTo(0, 1);
      expect(Math.hypot(w.contact!.x - w.mount.x, w.contact!.z - w.mount.z)).toBeLessThan(0.1);
      expect(w.mount.y).toBeGreaterThan(w.contact!.y);
      expect(w.slip).toBeLessThan(0.1);
    }
    const up = wheels.reduce((s, w) => s + w.force.y, 0);
    expect(up / (vehicleSpec("sedan").mass * 9.81)).toBeCloseTo(1, 1);
  });
});
