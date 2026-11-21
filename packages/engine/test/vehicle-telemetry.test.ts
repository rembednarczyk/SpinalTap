import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { TelemetryWheel } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { NEWTONS_PER_M, VehicleTelemetry, telemetryLines } from "../src/renderer/vehicle-telemetry";

/** The driven car's telemetry (ADR-0097 §3, `?telemetry=1`): a ray and a force line per wheel, green gripping to red sliding. */
const wheel = (slip: number): TelemetryWheel => ({ mount: { x: 0, y: 0.6, z: 0 }, contact: { x: 0, y: 0, z: 0 }, force: { x: 0, y: 4000, z: 2000 }, slip });

describe("the car's telemetry lines (ADR-0097 §3)", () => {
  it("draws each wheel's ray and its force, coloured by its slide", () => {
    const { lines, colors } = telemetryLines([wheel(0), wheel(1)]);
    expect(lines).toHaveLength(4);
    expect(lines[1]![1]!.y).toBeCloseTo(4000 / NEWTONS_PER_M, 9);
    expect(lines[1]![1]!.z).toBeCloseTo(2000 / NEWTONS_PER_M, 9);
    expect(colors[1]![0]!.g).toBeGreaterThan(colors[1]![0]!.r);
    expect(colors[3]![0]!.r).toBeGreaterThan(colors[3]![0]!.g);
  });

  it("shows while given wheels and hides on null", () => {
    const t = new VehicleTelemetry(new Scene(new NullEngine()));
    expect(t.drawn).toBe(false);
    t.update([wheel(0), wheel(0), wheel(0.5), wheel(1)]);
    expect(t.drawn).toBe(true);
    t.update([wheel(0.2), wheel(0), wheel(0.5), wheel(1)]);
    expect(t.drawn).toBe(true);
    t.update(null);
    expect(t.drawn).toBe(false);
  });
});
