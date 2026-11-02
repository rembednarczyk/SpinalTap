// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { VEHICLE_MODELS, VEHICLE_SIZE, type VehicleModel } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { kitUvs, mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { PAINTS, type VehicleTemplate, vehicleTemplates } from "../src/renderer/vehicle-models";
import { TROLLEY_LIVERY, VEHICLE_VARIANTS, pickVariant } from "../src/renderer/vehicle-variants";
import { VehicleViews } from "../src/renderer/vehicle-views";

/**
 * The street's vehicles of ADR-0058 stage 4: `vehicle-props.glb` (CC-BY cars of the user's second
 * pack, CC0 Kenney and Quaternius), the looks the renderer picks for the sim's bodies, and their
 * near, phone and far versions fitted to those bodies (collision and size stay the sim's).
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kit = parseCityKit(file("city-kit.glb"));
const vehicleBytes = file("vehicle-props.glb");
const vehicles = parseCityProps(vehicleBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), vehicles);
const look = { data: props, uvs: kitUvs(props, kit) };
const has = (k: string): boolean => kit.models.has(k) || props.models.has(k);

const extent = (t: VehicleTemplate) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, t.positions[i + k]!);
      max[k] = Math.max(max[k]!, t.positions[i + k]!);
    }
  }
  return { min, max };
};

describe("vehicle-props.glb (ADR-0058 stage 4)", () => {
  it("has every look of every body with its phone and far versions, each fitted to its body", () => {
    for (const model of VEHICLE_MODELS) {
      const size = VEHICLE_SIZE[model];
      for (const v of VEHICLE_VARIANTS[model]) {
        expect(has(v.key), v.key).toBe(true);
        for (const k of [`${v.key}-lite`, `${v.key}-far`, ...(v.key.startsWith("veh-") ? [v.key] : [])]) {
          const m = vehicles.models.get(k)!;
          expect(m, k).toBeDefined();
          // Across and along exactly the body's; never above it.
          expect(m.size.x, k).toBeCloseTo(size.width, 2);
          expect(m.size.z, k).toBeCloseTo(size.length, 2);
          expect(m.size.y, k).toBeLessThanOrEqual(size.height + 1e-3);
          expect(m.size.y, k).toBeGreaterThan(size.height * 0.6);
        }
        if (v.key.startsWith("veh-")) expect(vehicles.models.get(v.key)!.styles, v.key).toEqual([`veh-${model}`]);
      }
    }
  });

  it("is light: near up to 1000 triangles, the phone's up to 350, far ones under 200, a file under 640 KiB, on the props' palette", () => {
    expect(vehicleBytes.byteLength).toBeLessThan(640 * 1024);
    expect(vehicles.swatches).toEqual(props.swatches);
    for (const m of vehicles.models.values()) {
      const cap = m.key.endsWith("-far") ? 200 : m.key.endsWith("-lite") ? 350 : 1000;
      expect(triangleCount(m), m.key).toBeLessThanOrEqual(cap);
      expect(m.key).toMatch(/^(veh|car)-[a-z-]+$/);
      for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
    }
    const json = new TextDecoder().decode(new Uint8Array(vehicleBytes, 20, new DataView(vehicleBytes, 12, 4).getUint32(0, true)));
    for (const id of ["sketchfab-cyberpunk-car", "sketchfab-dirty-car"]) expect(json).toContain(`"credit":"${id}"`);
  });

  it("names in `sources.json` only the looks the file has, each under its pack", () => {
    const sources = (JSON.parse((readFileSync as (url: URL, enc: string) => string)(new URL("../../../tools/assets/sources.json", import.meta.url), "utf8")) as {
      sources: { id: string; used?: string[] }[];
    }).sources;
    const used = sources.flatMap((s) => (s.used ?? []).filter((k) => k.startsWith("veh-")).map((k) => ({ id: s.id, k })));
    expect(used.map((u) => u.k).sort()).toEqual([...vehicles.models.keys()].filter((k) => k.startsWith("veh-") && !/-(lite|far)$/.test(k)).sort());
    expect(used.find((u) => u.k === "veh-cyber")!.id).toBe("sketchfab-cyberpunk-car");
    expect(used.find((u) => u.k === "veh-trolleybus")!.id).toBe("quaternius-public-transport");
  });
});

describe("vehicle looks (ADR-0058 stage 4)", () => {
  it("picks a body's look from its seed, the same every time, every look in turn", () => {
    for (const model of VEHICLE_MODELS) {
      const seen = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const v = pickVariant(model, i * 7919, has)!;
        expect(v, model).not.toBeNull();
        expect(pickVariant(model, i * 7919, has)).toBe(v);
        seen.add(v.key);
      }
      expect([...seen].sort(), model).toEqual(VEHICLE_VARIANTS[model].map((v) => v.key).sort());
    }
  });

  it("keeps the kit's cars and the procedural trolleybus before the file has loaded", () => {
    const kitOnly = (k: string) => kit.models.has(k);
    for (let i = 0; i < 100; i++) expect(pickVariant("sedan", i, kitOnly)!.key).toBe("car-sedan");
    expect(pickVariant("trolleybus", 3, kitOnly)).toBeNull();
    const pair = vehicleTemplates(kit, "trolleybus", 0, { props: null, variant: null })!;
    expect(extent(pair.near).max[1]).toBeGreaterThan(5.8);
  });

  it("draws every look within its body: wheels on the ground, the far one lighter, the phone's lighter still", () => {
    for (const model of VEHICLE_MODELS) {
      const size = VEHICLE_SIZE[model];
      for (const variant of VEHICLE_VARIANTS[model]) {
        const pair = vehicleTemplates(kit, model, 2, { props: look, variant })!;
        const lite = vehicleTemplates(kit, model, 2, { props: look, variant, lite: true })!;
        for (const [name, t] of [["near", pair.near], ["far", pair.far], ["lite", lite.near]] as const) {
          const { min, max } = extent(t);
          const at = `${variant.key} ${name}`;
          // The trolleybus's neon strips stand 3 cm off its sides, as they always have.
          expect(max[0]! - min[0]!, at).toBeLessThanOrEqual(size.width + (model === "trolleybus" ? 0.07 : 0.01));
          expect(max[2]! - min[2]!, at).toBeGreaterThan(size.length * 0.98);
          expect(max[2]! - min[2]!, at).toBeLessThanOrEqual(size.length + 0.05);
          expect(min[1]!, at).toBeGreaterThan(-0.01);
          expect(min[1]!, at).toBeLessThan(0.05);
          // The trolleybus's booms reach up to the wires; anything else stays in its body.
          if (model === "trolleybus" && name !== "far") expect(max[1]!, at).toBeGreaterThan(5.8);
          else expect(max[1]!, at).toBeLessThanOrEqual(size.height + 1e-3);
        }
        expect(pair.far.indices.length, variant.key).toBeLessThan(pair.near.indices.length / 3);
        expect(lite.near.indices.length, variant.key).toBeLessThan(pair.near.indices.length);
      }
    }
  });

  it("paints a car with its paint and the trolleybus with Lublin's livery", () => {
    const colours = (t: VehicleTemplate) => new Set(Array.from({ length: t.vertexCount }, (_, v) => [0, 1, 2].map((k) => Math.round(t.colors[v * 4 + k]! * 255)).join(",")));
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
    const dirty = vehicleTemplates(kit, "sedan", 1, { props: look, variant: { key: "veh-dirty", weight: 1 } })!;
    expect([...colours(dirty.near)]).toEqual([hex(PAINTS[1])]);
    const bus = colours(vehicleTemplates(kit, "trolleybus", 0, { props: look, variant: VEHICLE_VARIANTS.trolleybus[0] })!.near);
    for (const c of Object.values(TROLLEY_LIVERY)) expect(bus.has(hex(c)), c).toBe(true);
    // The garbage trucks are amber whatever their seed.
    expect(VEHICLE_VARIANTS.delivery.find((v) => v.key === "veh-garbage")!.paint).toBe(4);
  });
});

describe("vehicle views with the vehicles' file (ADR-0058 stage 4)", () => {
  const verts = (scene: Scene, name: string) => scene.getMeshByName(name)?.getTotalVertices() ?? 0;
  const at = (x: number, z: number) => ({ position: { x, y: 0, z }, yaw: 0, pitch: 0, speed: 0 });

  it("takes the looks once the props have loaded, the phone's versions on low, still in one mesh", () => {
    const counts: Record<string, number> = {};
    for (const quality of ["high", "low"] as const) {
      const scene = new Scene(new NullEngine());
      const city = new CityKit(scene, new ToonMaterials(scene), null, kit, { labels: false });
      const views = new VehicleViews({ scene, kit: () => city, glow: null, eye: () => ({ x: 0, z: 0 }), quality });
      VEHICLE_MODELS.forEach((model: VehicleModel, i) => views.spawn(i + 1, { kind: "vehicle", model, tint: 40 + i, parked: true }, at(i * 15, 10)));
      views.update();
      const before = verts(scene, "parked");
      city.setProps(props);
      views.update();
      expect(views.stats).toMatchObject({ parked: VEHICLE_MODELS.length, meshes: 1 });
      counts[`${quality}:before`] = before;
      counts[quality] = verts(scene, "parked");
    }
    expect(counts.high).not.toBe(counts["high:before"]);
    expect(counts.low).toBeLessThan(counts.high!);
  });
});
