// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { VEHICLE_MODELS, VEHICLE_SIZE } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { PAINTS, paintOf, vehicleTemplates } from "../src/renderer/vehicle-models";
import { VEHICLE_LOD, VehicleViews } from "../src/renderer/vehicle-views";

const file = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
const data = parseCityKit(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);

const extent = (positions: Float32Array) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, positions[i + k]!);
      max[k] = Math.max(max[k]!, positions[i + k]!);
    }
  }
  return { min, max };
};

describe("vehicle models (ADR-0050)", () => {
  it("every model has a near and a far version at its real size, wheels on the ground", () => {
    for (const model of VEHICLE_MODELS) {
      const pair = vehicleTemplates(data, model, 0)!;
      expect(pair, model).not.toBeNull();
      const size = VEHICLE_SIZE[model];
      const { min, max } = extent(pair.near.positions);
      expect(max[2]! - min[2]!, model).toBeGreaterThan(size.length * 0.9);
      expect(max[2]! - min[2]!, model).toBeLessThan(size.length * 1.1);
      expect(max[0]! - min[0]!, model).toBeLessThan(size.width * 1.15);
      expect(min[1]!, model).toBeGreaterThan(-0.05);
      expect(pair.far.vertexCount, model).toBeLessThan(pair.near.vertexCount);
      for (const i of pair.near.indices) expect(i).toBeLessThan(pair.near.vertexCount);
    }
    // The trolleybus's booms reach up to the wires.
    expect(extent(vehicleTemplates(data, "trolleybus", 0)!.near.positions).max[1]).toBeGreaterThan(5.8);
  });

  it("a car's paint comes from its tint; the trolleybus keeps its livery", () => {
    const paints = new Set(Array.from({ length: 200 }, (_, i) => paintOf("sedan", i * 7919)));
    expect(paints.size).toBe(PAINTS.length);
    expect(paintOf("trolleybus", 12345)).toBe(0);
  });
});

describe("vehicle views (ADR-0050)", () => {
  const setup = (quality: "high" | "low" = "high") => {
    const scene = new Scene(new NullEngine());
    const kit = new CityKit(scene, new ToonMaterials(scene), null, data, { labels: false });
    const eye = { x: 0, z: 0 };
    const views = new VehicleViews({ scene, kit: () => kit, glow: null, eye: () => eye, quality });
    return { scene, views, eye };
  };
  const at = (x: number, z: number, yaw = 0) => ({ position: { x, y: 0, z }, yaw, pitch: 0, speed: 10 });

  it("draws every driving vehicle in one mesh: near ones in detail, far ones as boxes, the farthest not at all", () => {
    const { views, eye } = setup();
    const lod = VEHICLE_LOD.high;
    views.spawn(1, { kind: "vehicle", model: "sedan", tint: 3 }, at(10, 0));
    views.spawn(2, { kind: "vehicle", model: "trolleybus", tint: 0 }, at(0, lod.near + 20));
    views.spawn(3, { kind: "vehicle", model: "van", tint: 9 }, at(lod.draw + 30, 0));
    views.update();
    expect(views.stats).toMatchObject({ driving: 3, near: 1, far: 1, meshes: 1 });
    // Driving away: the near one turns far, the far one is folded away.
    views.move(1, at(lod.near + 10, 0));
    views.move(2, at(0, lod.draw + 10));
    views.update();
    expect(views.stats).toMatchObject({ near: 0, far: 1 });
    eye.x = lod.draw + 30;
    views.update();
    expect(views.stats.near).toBe(1);
    views.despawn(3);
    views.update();
    expect(views.stats.driving).toBe(2);
    views.clear();
    views.update();
    expect(views.stats).toMatchObject({ driving: 0, meshes: 0 });
  });

  it("draws the parked cars of the city in one mesh of their own, within the draw distance", () => {
    const { views, eye } = setup("low");
    for (let i = 0; i < 6; i++) views.spawn(100 + i, { kind: "vehicle", model: "hatchback", tint: i, parked: true }, at(20 + i * 2.7, 30, Math.PI / 2));
    views.update();
    expect(views.stats).toMatchObject({ parked: 6, meshes: 1 });
    eye.x = 2000;
    views.update();
    expect(views.stats.meshes).toBe(0);
    expect(views.has(100)).toBe(true);
    views.despawn(100);
    expect(views.has(100)).toBe(false);
  });

  it("waits for the kit before it draws anything", () => {
    const scene = new Scene(new NullEngine());
    const views = new VehicleViews({ scene, kit: () => null, glow: null, eye: () => ({ x: 0, z: 0 }), quality: "medium" });
    views.spawn(1, { kind: "vehicle", model: "taxi", tint: 1 }, at(0, 0));
    views.update();
    expect(views.stats).toMatchObject({ driving: 1, near: 0, meshes: 0 });
  });
});
