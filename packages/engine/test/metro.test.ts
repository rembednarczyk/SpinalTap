import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CAR, CAR_BAYS, LAYERS, RIDERS, TRAIN_SPEED, carSway, parallaxOffset, planCar, planLayer, ridersFor } from "../src/renderer/metro-plan";
import { CAR_ORIGIN, MetroRide, type RideCast } from "../src/renderer/metro-ride";

/** Vertex positions of a sink as points. */
const points = (positions: readonly number[]) => Array.from({ length: positions.length / 3 }, (_, i) => ({ x: positions[i * 3]!, y: positions[i * 3 + 1]!, z: positions[i * 3 + 2]! }));

describe("metro car plan (ADR-0036)", () => {
  it("stays inside the car's shell and has lit strips, screens and the LED lines", () => {
    const sink = planCar();
    for (const p of points(sink.positions)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(CAR.width / 2 + 0.05);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(CAR.length / 2 + 0.08);
      expect(p.y).toBeGreaterThanOrEqual(-0.11);
      expect(p.y).toBeLessThanOrEqual(CAR.height + 0.09);
    }
    // Vertex alpha 0 marks self-lit surfaces (the ceiling strips, the ads, the LED lines).
    const lit = sink.colors.filter((_, i) => i % 4 === 3).filter((a) => a === 0).length;
    expect(lit).toBeGreaterThan(200);
  });

  it("covers the whole length of a side with bays in order", () => {
    for (let i = 1; i < CAR_BAYS.length; i++) expect(CAR_BAYS[i]!.z0).toBeCloseTo(CAR_BAYS[i - 1]!.z1);
    expect(CAR_BAYS[0]!.z0).toBe(-CAR.length / 2);
    expect(CAR_BAYS.at(-1)!.z1).toBe(CAR.length / 2);
    expect(CAR_BAYS.filter((b) => b.kind === "door")).toHaveLength(2);
  });
});

describe("parallax", () => {
  it("moves every layer back at the train's speed, wrapped and centred on the car", () => {
    const { period } = LAYERS.mid;
    expect(parallaxOffset(0, TRAIN_SPEED, period)).toBe(period / 2);
    expect(parallaxOffset(1, TRAIN_SPEED, period) - parallaxOffset(0, TRAIN_SPEED, period)).toBeCloseTo(-TRAIN_SPEED);
    for (let t = 0; t < 60; t += 0.37) {
      const o = parallaxOffset(t, TRAIN_SPEED, period);
      expect(o).toBeGreaterThan(-period / 2 - 1e-9);
      expect(o).toBeLessThanOrEqual(period / 2);
    }
  });

  it("makes far layers crawl: the same speed sweeps a smaller angle further away", () => {
    const angle = (d: number) => Math.atan(TRAIN_SPEED / d);
    expect(angle(LAYERS.near.distance)).toBeGreaterThan(angle(LAYERS.mid.distance) * 2);
    expect(angle(LAYERS.mid.distance)).toBeGreaterThan(angle(LAYERS.far.distance) * 2);
  });

  it("builds three identical copies per layer, so the wrap is seamless, on both sides of the track", () => {
    for (const kind of ["near", "mid", "far"] as const) {
      const pts = points(planLayer(kind).positions);
      const { period, distance } = LAYERS[kind];
      expect(pts.some((p) => p.x < -distance + 1)).toBe(true);
      expect(pts.some((p) => p.x > distance - 1)).toBe(true);
      // Coverage: the copies span at least ±period around the car whatever the offset.
      expect(Math.min(...pts.map((p) => p.z))).toBeLessThan(-period);
      expect(Math.max(...pts.map((p) => p.z))).toBeGreaterThan(period);
      const third = pts.length / 3;
      expect(Number.isInteger(third)).toBe(true);
      expect(pts[third]!.z - pts[0]!.z).toBeCloseTo(period);
    }
  });
});

describe("car sway and riders", () => {
  it("sways a few millimetres and a fraction of a degree, nothing with reduced motion", () => {
    for (let t = 0; t < 20; t += 0.1) {
      const s = carSway(t);
      expect(Math.abs(s.dx)).toBeLessThan(0.02);
      expect(Math.abs(s.dy)).toBeLessThan(0.012);
      expect(Math.abs(s.roll)).toBeLessThan(0.01);
    }
    expect(carSway(3, true)).toEqual({ dx: 0, dy: 0, roll: 0 });
  });

  it("puts two to four riders in the car, the same ones for the same trip", () => {
    const counts = new Set<number>();
    for (const [a, b] of [["shinsekai", "kanal"], ["kanal", "targ"], ["targ", "doki"], ["doki", "shinsekai"], ["kanal", "doki"]] as const) {
      const r = ridersFor(a, b);
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.length).toBeLessThanOrEqual(4);
      expect(ridersFor(a, b)).toEqual(r);
      counts.add(r.length);
    }
    expect(counts.size).toBeGreaterThan(1);
    for (const r of RIDERS) expect(Math.abs(r.at.x)).toBeLessThan(CAR.width / 2);
  });
});

describe("MetroRide", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 256);
    const camera = new CameraRig(scene, materials, () => false);
    const spawned = new Map<number, string>();
    const cast: RideCast = {
      spawn: (id, view) => spawned.set(id, view.kind === "heroine" ? "heroine" : view.preset),
      setAppearance: () => undefined,
      despawn: (id) => spawned.delete(id),
    };
    return { scene, materials, camera, spawned, ride: new MetroRide({ scene, materials, shadow, camera, cast }) };
  };

  it("shows the car with riders and lights on departure and takes it all away on arrival", () => {
    const { materials, camera, spawned, ride } = setup();
    const lights = materials.lightCount;
    ride.set({ from: "shinsekai", to: "targ", seconds: 6 });
    expect(ride.active).toBe(true);
    expect(ride.meshCount).toBe(4);
    expect(spawned.size).toBe(ride.riderCount);
    expect([...spawned.keys()].every((id) => id < 0)).toBe(true);
    expect(materials.lightCount).toBe(lights + 2);
    ride.update(1 / 60);
    camera.update(null, 1 / 60);
    expect(camera.camera.position.z).toBeLessThan(CAR_ORIGIN.z + 1);
    ride.set(null);
    expect(ride.active).toBe(false);
    expect(spawned.size).toBe(0);
    expect(materials.lightCount).toBe(lights);
  });

  it("builds the car once and reuses it on the next ride", () => {
    const { scene, ride } = setup();
    ride.set({ from: "kanal", to: "doki", seconds: 5 });
    ride.set(null);
    const meshes = scene.meshes.length;
    ride.set({ from: "doki", to: "kanal", seconds: 5 });
    expect(scene.meshes.length).toBe(meshes);
    expect(scene.getMeshByName("metro-car")?.isEnabled()).toBe(true);
    ride.set(null);
    expect(scene.getMeshByName("metro-car")?.isEnabled()).toBe(false);
  });
});
