// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import type { CarWheelPose } from "@seki/core";
import { describe, expect, it } from "vitest";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { kitUvs, mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { vehicleTemplates } from "../src/renderer/vehicle-models";
import { type WheelPart, poseWheels, wheelParts } from "../src/renderer/vehicle-wheels";

/*
 * A close-up's wheels turning (ADR-0097 §3): the bake keeps each wheel a range of vertices of its
 * own; the engine finds its axle from them and turns it by the car's wheel poses before placing the body.
 */

/** A test wheel: `n` points round an axle at (x, 0.3, z), radius 0.3 across x, normals outward. */
const ring = (x: number, z: number, n = 8): number[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return [x, 0.3 + 0.3 * Math.sin(a), z + 0.3 * Math.cos(a)];
  }).flat();

const template = () => {
  // A body point, then the four wheels front left, front right, rear left, rear right (front +z, left -x).
  const positions = Float32Array.from([0, 1, 0, ...ring(-0.8, 1.3), ...ring(0.8, 1.3), ...ring(-0.8, -1.3), ...ring(0.8, -1.3)]);
  const normals = new Float32Array(positions.length).fill(0);
  const ranges = [1, 9, 17, 25].map((f) => [f, 8] as const);
  return { positions, normals, wheels: wheelParts(positions, ranges) };
};
const still: CarWheelPose = { rolled: 0, steer: 0, lift: 0 };
const vertex = (p: Float32Array, v: number) => ({ x: p[v * 3]!, y: p[v * 3 + 1]!, z: p[v * 3 + 2]! });

describe("a close-up's wheels (ADR-0097 §3)", () => {
  it("finds each wheel's axle, radius and place among the simulation's four from its vertices", () => {
    const t = template();
    expect(t.wheels.map((w) => w.index)).toEqual([0, 1, 2, 3]);
    const fl = t.wheels[0] as WheelPart;
    expect(fl.axle.x).toBeCloseTo(-0.8, 6);
    expect(fl.axle.y).toBeCloseTo(0.3, 6);
    expect(fl.axle.z).toBeCloseTo(1.3, 6);
    expect(fl.ry).toBeCloseTo(0.3, 6);
  });

  it("rolls a wheel's top forward, steers the front's nose to the left, lifts it on its spring, and leaves the body alone", () => {
    const t = template();
    const out = { positions: new Float32Array(0), normals: new Float32Array(0) };
    // Vertex 1 + 2 is the front left wheel's top (a quarter round from its front).
    const top = 1 + 2;
    const front = 1;
    const rolled = poseWheels(t, t.wheels, [{ rolled: 0.3 * 0.5, steer: 0, lift: 0 }, still, still, still], out);
    expect(vertex(rolled.positions, top).z).toBeGreaterThan(1.3 + 0.1);
    expect(vertex(rolled.positions, 0)).toEqual({ x: 0, y: 1, z: 0 });
    const steered = poseWheels(t, t.wheels, [{ rolled: 0, steer: 0.3, lift: 0 }, still, still, still], out);
    expect(vertex(steered.positions, front).x).toBeLessThan(-0.8 - 0.05);
    const lifted = poseWheels(t, t.wheels, [still, still, { rolled: 0, steer: 0, lift: 0.04 }, still], out);
    expect(vertex(lifted.positions, 17).y).toBeCloseTo(vertex(t.positions, 17).y + 0.04, 6);
    // The other wheels where they were.
    expect(vertex(lifted.positions, 1)).toEqual(vertex(t.positions, 1));
  });

  it("draws a car with no poses (the street's traffic) as it is", () => {
    const t = template();
    const out = { positions: new Float32Array(0), normals: new Float32Array(0) };
    expect(poseWheels(t, t.wheels, undefined, out).positions).toBe(t.positions);
  });

  it("has the sports car's close-up in the file with its four wheels, about 0.31 m in radius, at its corners", () => {
    const file = (name: string): ArrayBuffer => {
      const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const kit = parseCityKit(file("city-kit.glb"));
    const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("vehicle-props.glb")));
    const high = vehicleTemplates(kit, "hatchback", 0, { props: { data: props, uvs: kitUvs(props, kit) }, variant: { key: "veh-cyber", weight: 1 } })?.high;
    const wheels = high?.wheels ?? [];
    expect(wheels.map((w) => w.index).sort()).toEqual([0, 1, 2, 3]);
    for (const w of wheels) {
      expect(w.ry).toBeGreaterThan(0.28);
      expect(w.ry).toBeLessThan(0.34);
      // On the ground: its bottom within a centimetre of the body's lowest point.
      expect(w.axle.y - w.ry).toBeLessThan(0.01);
      expect(Math.abs(w.axle.x)).toBeGreaterThan(0.6);
      expect(Math.abs(w.axle.z)).toBeGreaterThan(1);
    }
    // The wheels last in the mesh, after the body.
    expect(Math.min(...wheels.map((w) => w.first))).toBeGreaterThan(high!.vertexCount / 2);
  });
});
