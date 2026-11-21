import { EMPTY_INPUT, type DriveInput, vehicleSpec } from "@seki/core";
import { describe, expect, it } from "vitest";
import { attitude, length } from "../src/world/vehicle/frame";
import { type CarState, forwardSpeed, newCar } from "../src/world/vehicle/state";
import { driveCar, kmh } from "../src/world/vehicle/step";
import type { CarGround } from "../src/world/vehicle/suspension";

/** The car's physics on test floors (ADR-0097 §5), stepped at 60 Hz without a browser. */
const flat: CarGround = { heightAt: () => 0 };
/** A slope rising 10% towards +z. */
const slope: CarGround = { heightAt: (_x, z) => 0.1 * z };
const DT = 1 / 60;
const pedal = (over: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...over });
const run = (car: CarState, input: DriveInput | null, seconds: number, g: CarGround = flat, until?: (c: CarState) => boolean): number => {
  let t = 0;
  for (; t < seconds; t += DT) {
    driveCar(car, input, g, DT);
    if (until?.(car)) break;
  }
  return t;
};
const settled = (g: CarGround = flat, yaw = 0): CarState => {
  const car = newCar("sedan", 0, g.heightAt(0, 0), 0, yaw);
  run(car, pedal({ handbrake: true, brake: 1 }), 2, g);
  return car;
};

describe("the car on flat ground (ADR-0097 stage 2)", () => {
  it("settles on its springs and stands still, level", () => {
    const car = settled();
    const a = attitude(car.q);
    expect(length(car.vel)).toBeLessThan(0.02);
    expect(Math.abs(a.pitch)).toBeLessThan(0.01);
    expect(Math.abs(a.roll)).toBeLessThan(0.002);
    // Each wheel takes some quarter of the weight, the rear more (the mass sits behind the middle).
    const loads = car.wheels.map((w) => w.load);
    const weight = vehicleSpec("sedan").mass * 9.81;
    expect(loads.reduce((s, l) => s + l, 0)).toBeCloseTo(weight, -2);
    expect(loads[2]!).toBeGreaterThan(loads[0]!);
  });

  it("stands on a 10% slope with the handbrake, and rolls back off it without", () => {
    const car = settled(slope);
    const at = { ...car.pos };
    run(car, pedal({ handbrake: true }), 4, slope);
    expect(Math.hypot(car.pos.x - at.x, car.pos.z - at.z)).toBeLessThan(0.05);
    run(car, null, 3, slope);
    expect(car.pos.z).toBeLessThan(at.z - 1);
  });

  it("goes from 0 to 100 km/h in 4-7 s and tops out at 230-310 km/h", () => {
    const car = settled();
    const t = run(car, pedal({ throttle: 1 }), 20, flat, (c) => kmh(c) >= 100);
    expect(t).toBeGreaterThan(4);
    expect(t).toBeLessThan(7);
    run(car, pedal({ throttle: 1 }), 90);
    expect(kmh(car)).toBeGreaterThan(230);
    expect(kmh(car)).toBeLessThan(310);
    expect(car.gear).toBeGreaterThanOrEqual(5);
  });

  it("stops from 100 km/h in 33-45 m, straight", () => {
    const car = settled();
    run(car, pedal({ throttle: 1 }), 20, flat, (c) => kmh(c) >= 100);
    const from = { ...car.pos };
    run(car, pedal({ brake: 1 }), 10, flat, (c) => forwardSpeed(c) < 0.1);
    const d = Math.hypot(car.pos.x - from.x, car.pos.z - from.z);
    expect(d).toBeGreaterThan(33);
    expect(d).toBeLessThan(45);
    expect(Math.abs(car.pos.x - from.x)).toBeLessThan(0.5);
  });

  it("dives the nose braking, lifts it on throttle; turning left rolls to the right side, and the heading falls", () => {
    const car = settled();
    run(car, pedal({ throttle: 1 }), 0.6);
    expect(attitude(car.q).pitch).toBeLessThan(-0.002);
    run(car, pedal({ throttle: 1 }), 4);
    run(car, pedal({ brake: 1 }), 0.4);
    expect(attitude(car.q).pitch).toBeGreaterThan(0.004);
    const turn = settled();
    run(turn, pedal({ throttle: 0.5 }), 3);
    const yaw0 = attitude(turn.q).yaw;
    run(turn, pedal({ throttle: 0.3, steer: 0.5 }), 1);
    expect(attitude(turn.q).yaw).toBeLessThan(yaw0 - 0.2);
    expect(attitude(turn.q).roll).toBeGreaterThan(0.005);
  });

  it("pulls 0.85-1.15 g in a steady circle at the grip's limit", () => {
    const car = settled();
    const samples: number[] = [];
    let last = { ...car.vel };
    // Hold some 70 km/h and steer into a circle; the centripetal acceleration from the path (the
    // velocity's turn each half second), once the circle is steady.
    for (let t = 0, k = 0; t < 24; t += DT, k++) {
      const v = forwardSpeed(car);
      driveCar(car, pedal({ throttle: v < 19.5 ? 0.7 : 0.25, steer: t > 4 ? 0.6 : 0 }), flat, DT);
      if (k % 30 === 29) {
        if (t > 12) samples.push(Math.hypot(car.vel.x - last.x, car.vel.z - last.z) / 0.5 / 9.81);
        last = { ...car.vel };
      }
    }
    const mean = samples.reduce((s, a) => s + a, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.85);
    expect(mean).toBeLessThan(1.15);
  });

  it("keeps its gear with the wheels in the air on full throttle (a kerb's jump): the box reads the road speed", () => {
    const car = settled();
    run(car, pedal({ throttle: 1 }), 1.2);
    const gear = car.gear;
    // Off a kerb: half a metre over the ground, the driven wheels spin free under the throttle.
    car.pos = { ...car.pos, y: car.pos.y + 0.6 };
    for (let k = 0; k < 18; k++) {
      driveCar(car, pedal({ throttle: 1 }), flat, DT);
      expect(car.gear, `step ${k}`).toBe(gear);
    }
  });

  it("loses speed coasting only to drag and rolling: never gains it", () => {
    const car = settled();
    run(car, pedal({ throttle: 1 }), 20, flat, (c) => kmh(c) >= 80);
    // The speed over the ground each second: the springs' pitching moves the heading's projection a hair either way.
    let v = Math.hypot(car.vel.x, car.vel.z);
    for (let k = 0; k < 10; k++) {
      run(car, pedal({}), 1);
      const now = Math.hypot(car.vel.x, car.vel.z);
      expect(now).toBeLessThan(v);
      v = now;
    }
    expect(v).toBeGreaterThan(5);
  });

  it("is the same twice, bit for bit, and reverses with the brake held from a stop", () => {
    const drive = (c: CarState) => {
      run(c, pedal({ throttle: 1, steer: 0.3 }), 3);
      run(c, pedal({ brake: 1, steer: -0.4 }), 2);
    };
    const a = settled();
    const b = settled();
    drive(a);
    drive(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const r = settled();
    run(r, pedal({ brake: 1 }), 3);
    expect(r.gear).toBe(-1);
    expect(forwardSpeed(r)).toBeLessThan(-1);
    // The keyboard's frame drives it too: forward is throttle.
    const k = settled();
    run(k, null, 0);
    for (let i = 0; i < 120; i++) driveCar(k, { ...EMPTY_INPUT, moveZ: 1 }, flat, DT);
    expect(forwardSpeed(k)).toBeGreaterThan(5);
  });
});
