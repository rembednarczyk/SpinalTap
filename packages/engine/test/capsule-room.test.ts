// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { CAPSULE_CEILING, CAPSULE_DOOR, CAPSULE_FURNITURE, CAPSULE_HALF_DEPTH, CAPSULE_HALF_WIDTH, CAPSULE_INTERIOR_ROOM, CAPSULE_ORIGIN } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ToonPointLights, pointLightAt } from "../src/npr/toon-point-lights";
import { MAX_POINT_LIGHTS, TOON_FRAGMENT } from "../src/npr/toon-shader";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { CAPSULE_MODEL, capsuleGeometry } from "../src/renderer/rooms/capsule-geometry";
import { CAPSULE_DRAW, CAPSULE_LAMP_KEY, CapsuleRoomView } from "../src/renderer/rooms/capsule-room-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const roomBytes = file("room-props.glb");
const room = parseCityProps(roomBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), room);

const extent = (positions: readonly number[] | Float32Array) => {
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

describe("room-props.glb (ADR-0063 stage 3)", () => {
  it("holds the capsule room, CC-BY with its credit, within an interior's budget and small", () => {
    expect([...room.models.keys()]).toEqual([CAPSULE_MODEL]);
    const m = room.models.get(CAPSULE_MODEL)!;
    expect(triangleCount(m)).toBeLessThanOrEqual(8000);
    expect(roomBytes.byteLength).toBeLessThan(400 * 1024);
    expect(room.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(roomBytes, 20, new DataView(roomBytes, 12, 4).getUint32(0, true)));
    expect(json.match(/"credit":"sketchfab-futuristic-compact-room"/g)).toHaveLength(1);
  });

  it("fits inside the room's walls, from its floor to under its ceiling", () => {
    const m = room.models.get(CAPSULE_MODEL)!;
    expect(m.size.x).toBeLessThanOrEqual(2 * CAPSULE_HALF_WIDTH);
    expect(m.size.z).toBeLessThanOrEqual(2 * CAPSULE_HALF_DEPTH);
    expect(m.size.y).toBeLessThanOrEqual(CAPSULE_CEILING);
    const { min, max } = extent(m.positions);
    expect(min[1]).toBeGreaterThanOrEqual(-1e-3);
    expect(max[0]! - min[0]!).toBeCloseTo(m.size.x, 2);
    expect((max[0]! + min[0]!) / 2).toBeCloseTo(0, 2);
    expect((max[2]! + min[2]!) / 2).toBeCloseTo(0, 2);
  });
});

describe("the capsule room's geometry (ADR-0063 stage 3)", () => {
  it("stands the model in the room, door side to the south, inside the shell; boxes in its place without the file", () => {
    const withFile = capsuleGeometry(kitData, props);
    const without = capsuleGeometry(kitData, null);
    expect(withFile.model).toBe(true);
    expect(without.model).toBe(false);
    for (const g of [withFile, without]) for (const i of g.sink.indices) expect(i).toBeLessThan(g.sink.vertexCount);
    // The shell: the room's cut in the tenement, from under its floor up to the cut storey.
    const shell = extent(without.sink.positions);
    expect(shell.min[0]).toBeLessThan(CAPSULE_INTERIOR_ROOM.minX);
    expect(shell.max[2]).toBeGreaterThan(CAPSULE_INTERIOR_ROOM.maxZ);
    // The model alone (after the shell's boxes): inside the room, its floor on the room's floor.
    const m = props.models.get(CAPSULE_MODEL)!;
    const model = extent(withFile.sink.positions.slice(withFile.sink.positions.length - m.positions.length));
    expect(model.min[0]).toBeGreaterThanOrEqual(CAPSULE_INTERIOR_ROOM.minX - 1e-3);
    expect(model.max[0]).toBeLessThanOrEqual(CAPSULE_INTERIOR_ROOM.maxX + 1e-3);
    expect(model.min[2]).toBeGreaterThanOrEqual(CAPSULE_INTERIOR_ROOM.minZ - 1e-3);
    expect(model.max[2]).toBeLessThanOrEqual(CAPSULE_INTERIOR_ROOM.maxZ + 1e-3);
    expect(model.min[1]).toBeCloseTo(CAPSULE_ORIGIN.y, 2);
    expect(model.max[1]).toBeLessThan(CAPSULE_INTERIOR_ROOM.top);
    // The kitchen run (the model's west wall) is on the west side, the bed alcove at the back (north).
    expect(CAPSULE_FURNITURE[0]!.center.x).toBeLessThan(CAPSULE_ORIGIN.x);
    expect(CAPSULE_FURNITURE[1]!.center.z).toBeGreaterThan(CAPSULE_ORIGIN.z);
    expect(CAPSULE_DOOR.at.z).toBeLessThan(CAPSULE_INTERIOR_ROOM.minZ);
  });
});

describe("the capsule room's view (ADR-0063 stage 3)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { x: CAPSULE_ORIGIN.x, y: CAPSULE_ORIGIN.y + 1.6, z: CAPSULE_ORIGIN.z };
    const box = { city: true, props: props as typeof props | null };
    const view = new CapsuleRoomView({ scene, materials, kit: () => kit, props: () => box.props, city: () => box.city, eye: () => eye });
    return { scene, materials, view, eye, box };
  };

  it("draws one mesh with its lamp near the room, none far from it or without the map city", () => {
    const { scene, materials, view, eye, box } = setup();
    const lights = materials.lightCount;
    view.update();
    expect(view.stats).toMatchObject({ meshes: 1, model: true });
    expect(view.stats.triangles).toBeGreaterThan(triangleCount(props.models.get(CAPSULE_MODEL)!));
    expect(scene.meshes.filter((m) => m.name === "capsule-room")).toHaveLength(1);
    expect(materials.lightCount).toBe(lights + 1);
    eye.z -= CAPSULE_DRAW + 1;
    view.update();
    expect(view.stats.meshes).toBe(1);
    eye.z -= 10;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(materials.lightCount).toBe(lights);
    eye.z = CAPSULE_ORIGIN.z;
    view.update();
    expect(view.stats.meshes).toBe(1);
    box.city = false;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(scene.meshes.filter((m) => m.name === "capsule-room")).toHaveLength(1);
  });

  it("builds boxes before the props file and the model once it loads", () => {
    const { view, box } = setup();
    box.props = null;
    view.update();
    expect(view.stats.model).toBe(false);
    box.props = props;
    view.update();
    expect(view.stats.model).toBe(true);
  });

  // G-263: the toon shader's point lights have no occlusion, so the lamp lit the street through
  // the facade (some 2.3 m of paving in front of it) and switched on in one step at 45 m.
  it("lights only the room inside its walls, not the street, the facade or the walls' outer faces (G-263)", () => {
    const { materials, view } = setup();
    view.update();
    const lamp = materials.light(CAPSULE_LAMP_KEY)!;
    expect(lamp).toBeDefined();
    const r = CAPSULE_INTERIOR_ROOM;
    const y = CAPSULE_ORIGIN.y;
    // Inside: the floor, the walls' inner faces, the bed alcove.
    for (const p of [
      { x: CAPSULE_ORIGIN.x, y, z: CAPSULE_ORIGIN.z },
      { x: r.minX, y: y + 1.2, z: CAPSULE_ORIGIN.z },
      { x: CAPSULE_ORIGIN.x, y: y + 1.2, z: r.minZ },
      { x: CAPSULE_ORIGIN.x + 1, y: y + 0.6, z: r.maxZ - 0.3 },
    ])
      expect(pointLightAt(lamp, p), JSON.stringify(p)).toBeGreaterThan(0);
    // Outside, in reach of the light's sphere: every point a street mesh, the facade or a
    // neighbour's wall could have, on a 10 cm grid around the room and from the paving up.
    let probed = 0;
    for (let x = r.minX - 3; x <= r.maxX + 3; x += 0.1)
      for (let z = r.minZ - 3; z <= r.maxZ + 3; z += 0.1) {
        // The walls are 0.2 m thick or more: their inner faces may stay lit, their bodies and outer faces not.
        if (x > r.minX - 0.1 && x < r.maxX + 0.1 && z > r.minZ - 0.1 && z < r.maxZ + 0.1) continue;
        for (const h of [-0.2, 0, 0.5, 1.5, 2.5]) {
          const p = { x, y: y + h, z };
          if (Math.hypot(p.x - lamp.position.x, p.y - lamp.position.y, p.z - lamp.position.z) < lamp.range) probed++;
          expect(pointLightAt(lamp, p), JSON.stringify(p)).toBe(0);
        }
      }
    expect(probed).toBeGreaterThan(1000);
    // The paving of Jezuicka 2.3 m in front of the facade, where the lamp's patch reached.
    expect(pointLightAt(lamp, { x: CAPSULE_DOOR.at.x, y: CAPSULE_DOOR.at.y, z: CAPSULE_DOOR.at.z - 2.3 })).toBe(0);
  });

  it("fades the lamp in with the distance before the room's draw distance, no step (G-263)", () => {
    const { materials, view, eye } = setup();
    const levels: number[] = [];
    for (let d = 30; d <= CAPSULE_DRAW + 8; d += 0.25) {
      eye.z = CAPSULE_ORIGIN.z - d;
      view.update();
      levels.push(materials.light(CAPSULE_LAMP_KEY)?.intensity ?? 0);
    }
    const full = levels[0]!;
    expect(full).toBeGreaterThan(1);
    for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i]! - levels[i - 1]!), `step ${i}`).toBeLessThanOrEqual(0.03 * full);
    // Going out the room stays drawn a few metres more; the lamp is dark before it goes.
    expect(view.stats.meshes).toBe(0);
    for (let d = CAPSULE_DRAW + 8; d >= 30; d -= 0.25) {
      eye.z = CAPSULE_ORIGIN.z - d;
      view.update();
      const now = materials.light(CAPSULE_LAMP_KEY)?.intensity ?? 0;
      if (d >= CAPSULE_DRAW) expect(now).toBe(0);
      if (now > 0) expect(view.stats.meshes).toBe(1);
    }
    expect(materials.light(CAPSULE_LAMP_KEY)?.intensity).toBe(full);
  });

  it("binds the lamp's walls into the toon shader's slot, the other lights unclipped (G-263)", () => {
    const { materials, view } = setup();
    view.update();
    const lamp = materials.light(CAPSULE_LAMP_KEY)!;
    const slots = new ToonPointLights();
    slots.add("street", { position: { x: 0, y: 5, z: 0 }, color: "#ffffff", range: 14, intensity: 0.85 });
    slots.add(CAPSULE_LAMP_KEY, lamp);
    const arrays = new Map<string, number[]>();
    slots.apply({ setArray4: (k: string, v: number[]) => arrays.set(k, v), setFloat: () => undefined } as unknown as Parameters<ToonPointLights["apply"]>[0]);
    const clip = arrays.get("pointClip")!;
    expect(clip).toHaveLength(MAX_POINT_LIGHTS * 4);
    expect(clip[0]).toBeLessThan(-1e6);
    expect(clip[2]).toBeGreaterThan(1e6);
    expect(clip.slice(4, 8)).toEqual([lamp.clip!.minX, lamp.clip!.minZ, lamp.clip!.maxX, lamp.clip!.maxZ]);
    expect(TOON_FRAGMENT).toMatch(/uniform vec4 pointClip\[/);
    expect(TOON_FRAGMENT).toMatch(/att \*= step\(clip\.x, vWorldPos\.x\)/);
  });
});
