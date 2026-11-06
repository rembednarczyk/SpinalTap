import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { METRO_PLATFORMS, groundY } from "@seki/sim";
import { Scene, ShaderMaterial } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planCar } from "../src/renderer/metro-plan";
import { planPlatform } from "../src/renderer/metro/platform-plan";
import { departures, planPlatformSigns } from "../src/renderer/metro/platform-signs";
import { PLATFORM_DRAW, PlatformViews, platformRoofOver } from "../src/renderer/metro/platform-view";

/** ADR-0071 (ADR-0063's budget of an interior): up to 8 thousand triangles a platform, the train with it. */
const BUDGET = 8000;

const PLATFORMS = METRO_PLATFORMS.map((e) => [`${e.station} ${e.label}`, e] as const);

const points = (sink: MeshSink) => Array.from({ length: sink.vertexCount }, (_, i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]! }));

describe("the metro's platforms as geometry (ADR-0071 stage 4)", () => {
  it.each(PLATFORMS)("%s: one sink under the budget, the train of two cars of the ride in it", (_name, e) => {
    const sink = new MeshSink();
    planPlatform(sink, e);
    const car = planCar().indices.length / 3;
    expect(sink.indices.length / 3).toBeLessThanOrEqual(BUDGET);
    expect(sink.indices.length / 3).toBeGreaterThan(2 * car);
    expect(sink.colors.length / 4).toBe(sink.vertexCount);
    expect(sink.normals.length).toBe(sink.positions.length);
  });

  it.each(PLATFORMS)("%s: stays inside its vaults under the street, and nothing of it shows over the street", (_name, e) => {
    const sink = new MeshSink();
    planPlatform(sink, e);
    const boxes = [...e.platform.vaults.map((v) => v.bounds), e.cut.bounds];
    for (const q of points(sink)) {
      const inside = boxes.some((b) => q.x >= b.minX - 0.05 && q.x <= b.maxX + 0.05 && q.z >= b.minZ - 0.05 && q.z <= b.maxZ + 0.05);
      expect(inside, `${q.x.toFixed(2)},${q.z.toFixed(2)}`).toBe(true);
      expect(q.y, `${q.x.toFixed(2)},${q.z.toFixed(2)}`).toBeLessThan(groundY(q.x, q.z) - 0.02);
    }
  });

  it("puts the station's name on the back wall and each way's end on the departures' board", () => {
    expect(departures("shinsekai").map((d) => d.to)).toEqual(["Nabrzeże Bystrzycy"]);
    expect(departures("kanal").map((d) => d.to)).toEqual(["Plac Litewski", "Nabrzeże Bystrzycy"]);
    expect(departures("doki").map((d) => d.to)).toEqual(["Plac Litewski"]);
    for (const e of METRO_PLATFORMS) {
      const sink = new MeshSink();
      const lines = planPlatformSigns(sink, e);
      expect(lines).toBe(2 + 2 * departures(e.station).length);
      expect(sink.indices.length / 3).toBeGreaterThan(40);
      expect(sink.indices.length / 3).toBeLessThan(600);
    }
  });

  it("keeps the rain out over the platforms, not over the street beside them", () => {
    const e = METRO_PLATFORMS[0]!;
    const v = e.platform.vaults[1]!.bounds;
    const x = (v.minX + v.maxX) / 2;
    const z = (v.minZ + v.maxZ) / 2;
    expect(platformRoofOver(x, e.platform.floor + 2, z)).toBe(true);
    expect(platformRoofOver(x, e.street + 1, z)).toBe(false);
    expect(platformRoofOver(v.maxX + 5, e.platform.floor + 2, v.maxZ + 5)).toBe(false);
  });
});

describe("PlatformViews (ADR-0071 stage 4)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 256);
    const eye = { x: 0, y: 0, z: 0 };
    const signs = new ShaderMaterial("signs", scene, { vertexSource: "void main(){}", fragmentSource: "void main(){}" }, {});
    const views = new PlatformViews({ scene, materials, shadow, signs: () => signs, eye: () => eye });
    return { views, eye, scene, materials };
  };

  it("lights its lamps only with the eye under the street, each clipped to its room", () => {
    const { views, eye, materials } = setup();
    const e = METRO_PLATFORMS[2]!;
    const keys = e.platform.lamps.map((_, k) => `metro-platform-2-${k}`);
    Object.assign(eye, { ...e.door, y: e.street + 1.6 });
    views.update();
    expect(views.stats.meshes).toBe(2);
    expect(keys.map((k) => materials.light(k))).toEqual(keys.map(() => undefined));
    Object.assign(eye, { ...e.platform.arrival, y: e.platform.floor + 1.6 });
    views.update();
    for (const [k, key] of keys.entries()) {
      const lamp = materials.light(key)!;
      const clip = lamp.clip!;
      const p = e.platform.lamps[k]!;
      expect(p.x >= clip.minX && p.x <= clip.maxX && p.z >= clip.minZ && p.z <= clip.maxZ).toBe(true);
      expect(p.y).toBeLessThan(e.street - 3);
    }
    Object.assign(eye, { x: 274, y: 1.6, z: -81 });
    views.update();
    expect(keys.map((k) => materials.light(k))).toEqual(keys.map(() => undefined));
  });

  it("draws nothing away from the platforms, and only the near one's two meshes beside it", () => {
    const { views, eye } = setup();
    views.update();
    expect(views.stats).toEqual({ meshes: 0, triangles: 0 });
    const e = METRO_PLATFORMS[1]!;
    Object.assign(eye, { ...e.platform.arrival, y: e.platform.floor + 1.6 });
    views.update();
    expect(views.stats.meshes).toBe(2);
    expect(views.stats.triangles).toBeLessThanOrEqual(BUDGET + 600);
    // The street scene of npr-perf on the deptak, well west of it: off again, built and kept.
    Object.assign(eye, { x: 274, y: 1.6, z: -81 });
    views.update();
    expect(views.stats.meshes).toBe(0);
    expect(views.stats.triangles).toBeGreaterThan(0);
  });

  it("goes on at the pavilion's opening, so its doorway never shows the earth's nothing", () => {
    const { views, eye } = setup();
    const e = METRO_PLATFORMS[0]!;
    Object.assign(eye, { ...e.door, y: e.street + 1.6 });
    views.update();
    expect(views.stats.meshes).toBe(2);
    const far = { x: e.door.x + (PLATFORM_DRAW + 30), z: e.door.z };
    Object.assign(eye, { ...far, y: e.street + 1.6 });
    views.update();
    expect(views.stats.meshes).toBe(0);
  });
});
