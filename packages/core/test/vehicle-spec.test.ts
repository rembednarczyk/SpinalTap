import { describe, expect, it } from "vitest";
import { CYBER_SPEC, VEHICLE_MODELS, VEHICLE_SIZE, engineTorque, isDrivable, magic, vehicleSpec } from "../src";

/** The drivable car's data (ADR-0097 §1): magnitudes a real light sports coupe has. */
describe("the sports car's spec (ADR-0097)", () => {
  const s = CYBER_SPEC;
  const g = 9.81;

  it("springs at 1.3-2 Hz under a quarter of the car, dampers at a fifth to a half of critical", () => {
    for (const k of s.suspension.spring) {
      const corner = s.mass / 4;
      const hz = Math.sqrt(k / corner) / (2 * Math.PI);
      expect(hz).toBeGreaterThan(1.3);
      expect(hz).toBeLessThan(2);
      const critical = 2 * Math.sqrt(k * corner);
      expect(s.suspension.bump / critical).toBeGreaterThan(0.2);
      expect(s.suspension.rebound / critical).toBeLessThan(0.5);
    }
    // The static sag leaves travel both ways.
    const sag = (s.mass * g) / 4 / s.suspension.spring[0];
    expect(sag).toBeGreaterThan(0.04);
    expect(sag).toBeLessThan(s.suspension.travel);
  });

  it("peaks the magic formula's lateral force at 6-10° of slip, about D, and longitudinal at 8-15% of slip", () => {
    let best = { x: 0, f: 0 };
    for (let deg = 0; deg <= 30; deg += 0.25) {
      const f = magic(s.tyre.lateral, (deg * Math.PI) / 180);
      if (f > best.f) best = { x: deg, f };
    }
    expect(best.x).toBeGreaterThanOrEqual(6);
    expect(best.x).toBeLessThanOrEqual(10);
    expect(best.f).toBeCloseTo(s.tyre.lateral.d, 2);
    let lon = { x: 0, f: 0 };
    for (let k = 0; k <= 0.5; k += 0.005) {
      const f = magic(s.tyre.longitudinal, k);
      if (f > lon.f) lon = { x: k, f };
    }
    expect(lon.x).toBeGreaterThan(0.08);
    expect(lon.x).toBeLessThan(0.15);
    // Odd: the force turns with the slip.
    expect(magic(s.tyre.lateral, -0.1)).toBeCloseTo(-magic(s.tyre.lateral, 0.1), 12);
  });

  it("reads the torque curve linearly between its points and flat past its ends", () => {
    expect(engineTorque(s, 500)).toBe(200);
    expect(engineTorque(s, 3750)).toBeCloseTo(385, 6);
    expect(engineTorque(s, 9000)).toBe(340);
    // Some 280 kW at the peak of power.
    const kw = Math.max(...Array.from({ length: 70 }, (_, i) => (engineTorque(s, 1000 + i * 100) * (1000 + i * 100) * Math.PI) / 30 / 1000));
    expect(kw).toBeGreaterThan(250);
    expect(kw).toBeLessThan(320);
  });

  it("gears for some 260-300 km/h at the limiter in top, and pulls hard in first", () => {
    const top = s.gearbox.ratios[s.gearbox.ratios.length - 1]!;
    const v = ((s.engine.limiter / (top * s.gearbox.final)) * 2 * Math.PI * s.wheelRadius) / 60;
    expect(v * 3.6).toBeGreaterThan(260);
    expect(v * 3.6).toBeLessThan(320);
    const pull = (400 * s.gearbox.ratios[0]! * s.gearbox.final * s.gearbox.efficiency) / s.wheelRadius / (s.mass * g);
    expect(pull).toBeGreaterThan(1);
  });

  it("sizes every street body but the trolleybus as a drivable sports car", () => {
    for (const m of VEHICLE_MODELS) {
      expect(isDrivable(m)).toBe(m !== "trolleybus");
      const v = vehicleSpec(m);
      expect(v.half.z * 2).toBeCloseTo(VEHICLE_SIZE[m].length, 6);
      expect(v.wheelbase).toBeLessThan(VEHICLE_SIZE[m].length);
      expect(v.track).toBeLessThan(VEHICLE_SIZE[m].width);
    }
  });
});
