// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { BOB, DRONE_KINDS, DRONE_LAYER, DRONE_SIZE, type Drone, droneFleet, dronePose, loopLength } from "../src/renderer/drones/drone-flight";
import { type DroneLane, LEG, STEP } from "../src/renderer/drones/drone-lanes";
import { boxDrone, droneTemplates } from "../src/renderer/drones/drone-models";
import { DRONE_LOD, DroneViews } from "../src/renderer/drones/drone-views";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const droneBytes = file("drone-props.glb");
const drones = parseCityProps(droneBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), drones);

/** A straight lane along +x from (0, 0), 200 m, its level 30 m. */
const LANE: DroneLane = { points: Array.from({ length: 51 }, (_, i) => ({ x: i * STEP, z: 0 })), levels: Array.from({ length: 51 }, () => 30), length: 200, seed: 7 };

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

describe("drone-props.glb (ADR-0058 stage 7)", () => {
  it("has the three kinds, CC-BY with its credit, light and small", () => {
    expect([...drones.models.keys()]).toEqual(["drone-patrol", "drone-delivery", "drone-ad"]);
    for (const m of drones.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(1000);
    expect(droneBytes.byteLength).toBeLessThan(200 * 1024);
    expect(drones.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(droneBytes, 20, new DataView(droneBytes, 12, 4).getUint32(0, true)));
    expect(json.match(/"credit":"sketchfab-cyberpunk-drone"/g)).toHaveLength(3);
    const sources = (JSON.parse((readFileSync as (url: URL, enc: string) => string)(new URL("../../../tools/assets/sources.json", import.meta.url), "utf8")) as { sources: { id: string; used?: string[] }[] }).sources;
    const used = sources.flatMap((s) => (s.used ?? []).filter((k) => k.startsWith("drone-")).map((k) => `${s.id}:${k}`));
    expect(used.sort()).toEqual([...drones.models.keys()].map((k) => `sketchfab-cyberpunk-drone:${k}`).sort());
  });

  it("each kind fits its box, foot on the ground, front +z, near from the file and far as boxes", () => {
    const withFile = droneTemplates(kitData, props);
    const without = droneTemplates(kitData, null);
    for (const kind of DRONE_KINDS) {
      const size = DRONE_SIZE[kind];
      for (const t of [withFile[kind].near, withFile[kind].far, without[kind].near]) {
        const { min, max } = extent(t.positions);
        expect(max[0]! - min[0]!, kind).toBeLessThanOrEqual(size.width + 1e-3);
        expect(max[1]!, kind).toBeLessThanOrEqual(size.height + 1e-3);
        expect(min[1]!, kind).toBeGreaterThanOrEqual(-1e-3);
        expect(max[2]! - min[2]!, kind).toBeLessThanOrEqual(size.length + 1e-3);
        for (const i of t.indices) expect(i).toBeLessThan(t.vertexCount);
      }
      expect(withFile[kind].near.vertexCount, kind).toBeGreaterThan(withFile[kind].far.vertexCount * 5);
      expect(without[kind].near).toEqual(boxDrone(kitData, kind));
    }
  });
});

describe("drone flight (ADR-0058 stage 7)", () => {
  const drone = (kind: Drone["kind"]): Drone => ({ kind, lane: LANE, phase: 0, bob: 0 });

  it("loops its lane without a jump, heading the way it flies, at its kind's height", () => {
    for (const kind of DRONE_KINDS) {
      const d = drone(kind);
      let prev = dronePose(d, 0);
      const dt = 0.05;
      for (let t = dt; t < 120; t += dt) {
        const p = dronePose(d, t);
        const moved = Math.hypot(p.x - prev.x, p.z - prev.z);
        expect(moved, `${kind} at ${t}`).toBeLessThan(1.2);
        expect(Math.abs(p.y - prev.y), `${kind} at ${t}`).toBeLessThan(0.5);
        if (moved > 1e-3) {
          // Its front (+z of the model turned by the yaw) points where it went.
          const dot = (Math.sin(p.yaw) * (p.x - prev.x) + Math.cos(p.yaw) * (p.z - prev.z)) / moved;
          expect(dot, `${kind} at ${t}`).toBeGreaterThan(0.9);
        }
        // Over the lane: never further from its axis than the leg, never past its ends by more.
        expect(Math.abs(p.z)).toBeLessThanOrEqual(LEG + 1e-6);
        expect(p.x).toBeGreaterThanOrEqual(-LEG - 1e-6);
        expect(p.x).toBeLessThanOrEqual(LANE.length + LEG + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(30 + DRONE_LAYER[kind].above);
        expect(p.y).toBeLessThanOrEqual(30 + DRONE_LAYER[kind].above + 2 * BOB + 1e-6);
        prev = p;
      }
    }
    // Out on the right-hand side (south of an eastbound axis, -z in Babylon's left-handed frame), back on the other.
    const out = dronePose(drone("delivery"), 5);
    const back = dronePose(drone("delivery"), (LANE.length + Math.PI * LEG + 50) / 10);
    expect(out.z).toBeCloseTo(-LEG, 6);
    expect(back.z).toBeCloseTo(LEG, 6);
    // The legs lie wider apart than the widest drone; the kinds' layers, bobbing included, never overlap.
    expect(2 * LEG).toBeGreaterThan(Math.max(...DRONE_KINDS.map((k) => DRONE_SIZE[k].width)));
    const layers = DRONE_KINDS.map((k) => [DRONE_LAYER[k].above, DRONE_LAYER[k].above + DRONE_SIZE[k].height + 2 * BOB] as const).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < layers.length; i++) expect(layers[i]![0]).toBeGreaterThan(layers[i - 1]![1]);
    expect(loopLength(LANE)).toBeCloseTo(2 * 200 + 2 * Math.PI * LEG, 6);
  });

  it("puts one drone per stretch of lane on high, fewer on medium, none on a phone", () => {
    const lanes = [LANE, { ...LANE, seed: 99 }];
    const high = droneFleet(lanes, "high");
    expect(high.length).toBeGreaterThanOrEqual(2);
    expect(droneFleet(lanes, "medium").length).toBeLessThanOrEqual(high.length);
    expect(droneFleet(lanes, "low")).toEqual([]);
    expect(droneFleet(lanes, "high")).toEqual(high);
  });
});

describe("drone views (ADR-0058 stage 7)", () => {
  const setup = (quality: "high" | "low", lanes: readonly DroneLane[] = [LANE]) => {
    const scene = new Scene(new NullEngine());
    const kit = new CityKit(scene, new ToonMaterials(scene), null, kitData, { labels: false });
    const eye = { x: 100, y: 2, z: 30 };
    let version = 1;
    const world = { axes: [], roads: [], buildings: [], groundAt: () => 0 };
    // Fixed lanes in place of the planner: the views draw what the plan gives.
    const views = new DroneViews({ scene, kit: () => kit, props: () => props, source: () => ({ version, world: () => world }), glow: null, eye: () => eye, quality, plan: () => lanes });
    return { scene, views, eye, bump: () => version++ };
  };

  it("draws the drones in one mesh, plans once the map holds still, and draws nothing on a phone", () => {
    const { scene, views, eye } = setup("high");
    views.update(0.016, false);
    // The first frame only sees the map; the plan waits for it to hold still.
    expect(views.stats.drones).toBe(0);
    views.update(0.016, false);
    expect(views.stats.lanes).toBe(1);
    expect(views.stats.drones).toBeGreaterThan(0);
    views.update(0.016, false);
    expect(views.stats.meshes).toBe(1);
    expect(views.stats.near + views.stats.far).toBe(views.stats.drones);
    expect(scene.meshes.filter((m) => m.name === "drones")).toHaveLength(1);
    // Far away, none is drawn and the mesh goes off.
    eye.x = 5000;
    views.update(0.016, false);
    expect(views.stats).toMatchObject({ near: 0, far: 0, meshes: 0 });
    const low = setup("low");
    for (let i = 0; i < 3; i++) low.views.update(0.016, false);
    expect(low.views.stats).toMatchObject({ drones: 0, meshes: 0 });
    expect(low.scene.meshes.filter((m) => m.name === "drones")).toHaveLength(0);
    expect(DRONE_LOD.low.nearSlots).toBe(0);
  });

  it("holds still in the reference still and moves otherwise", () => {
    const { views } = setup("high");
    views.update(0.016, false);
    views.update(0.016, false);
    const before = views.poses();
    views.update(1, true);
    expect(views.poses()).toEqual(before);
    views.update(1, false);
    expect(views.poses()).not.toEqual(before);
  });
});
