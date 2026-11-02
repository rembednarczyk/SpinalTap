// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { CAPSULE_CEILING, CAPSULE_DOOR, CAPSULE_FURNITURE, CAPSULE_HALF_DEPTH, CAPSULE_HALF_WIDTH, CAPSULE_INTERIOR_ROOM, CAPSULE_ORIGIN } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { CAPSULE_MODEL, capsuleGeometry } from "../src/renderer/rooms/capsule-geometry";
import { CAPSULE_DRAW, CapsuleRoomView } from "../src/renderer/rooms/capsule-room-view";

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
});
