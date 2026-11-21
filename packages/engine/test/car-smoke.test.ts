import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { CarSmoke, MAX_CARS, PER_CAR, PUFF_LIFE, smokeOf, writePuffs } from "../src/renderer/car-smoke";

/*
 * Smoke from under a damaged car's bonnet (ADR-0097 §5): none on a whole car or one damaged under
 * half; past it puffs rise from the bonnet, grow and fade, paler at first and darker towards a wreck;
 * one mesh of thin instances, off while no car smokes.
 */

const car = (damage: number, x = 0, yaw = 0): Transform => ({ position: { x, y: 0, z: 0 }, yaw, pitch: 0, speed: 0, damage });
const buffers = () => ({ m: new Float32Array(16 * PER_CAR * MAX_CARS), c: new Float32Array(4 * PER_CAR * MAX_CARS) });

describe("a damaged car's smoke (ADR-0097 §5)", () => {
  it("smokes past half its damage only, thicker towards a wreck", () => {
    expect(smokeOf(0)).toBe(0);
    expect(smokeOf(0.5)).toBe(0);
    expect(smokeOf(0.75)).toBeCloseTo(0.5, 9);
    expect(smokeOf(1)).toBe(1);
    const { m, c } = buffers();
    expect(writePuffs([car(0.3)], 1, m, c)).toBe(0);
    expect(writePuffs([car(0.8), car(1, 10)], 1, m, c)).toBe(2 * PER_CAR);
  });

  it("puts the puffs over the bonnet, rising and growing as they age, paler on a lightly damaged car", () => {
    const { m, c } = buffers();
    // At time 0 puff i is i/PER_CAR into its life: the first just born, the last nearly gone.
    writePuffs([car(1)], 0, m, c);
    const young = { y: m[13]!, size: m[0]!, z: m[14]! };
    const old = { y: m[(PER_CAR - 1) * 16 + 13]!, size: m[(PER_CAR - 1) * 16]! };
    // Over the bonnet: ahead of the car's middle (heading +z), above its roof line.
    expect(young.z).toBeGreaterThan(1);
    expect(young.y).toBeGreaterThan(0.9);
    expect(old.y).toBeGreaterThan(young.y);
    expect(old.size).toBeGreaterThan(young.size);
    const wreckGrey = c[0]!;
    writePuffs([car(0.6)], 0, m, c);
    expect(c[0]!).toBeGreaterThan(wreckGrey);
    // A puff's life loops: the same picture a life later.
    const a = Float32Array.from(m.subarray(0, 16 * PER_CAR));
    writePuffs([car(0.6)], PUFF_LIFE, m, c);
    for (let i = 0; i < a.length; i++) expect(m[i]!).toBeCloseTo(a[i]!, 4);
  });

  it("draws one mesh while a car smokes and none otherwise", () => {
    const smoke = new CarSmoke(new Scene(new NullEngine()));
    smoke.update(1 / 60, [car(0.2)]);
    expect(smoke.drawn).toBe(false);
    smoke.update(1 / 60, [car(0.9)]);
    expect(smoke.drawn).toBe(true);
    smoke.update(1 / 60, []);
    expect(smoke.drawn).toBe(false);
  });
});
