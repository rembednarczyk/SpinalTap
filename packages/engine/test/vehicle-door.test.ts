// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { kitUvs, mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { vehicleTemplates } from "../src/renderer/vehicle-models";
import { DOOR_OUT, doorPart, poseDoor } from "../src/renderer/vehicle-door";

/*
 * The driver's door opening upward (scissor doors, user's request of 21.11): the bake keeps it a range
 * of vertices; the engine swings its rear up about a hinge at the top of its front edge.
 */
const vertex = (p: Float32Array, v: number) => ({ x: p[v * 3]!, y: p[v * 3 + 1]!, z: p[v * 3 + 2]! });

/** A body point, then a door panel on the left (x -0.9) from z -0.4 to 0.5, sill 0.2 to roof 1.0. */
const template = () => {
  const positions = Float32Array.from([0, 1, 0, -0.9, 0.2, 0.5, -0.9, 1, 0.5, -0.9, 1, -0.4, -0.9, 0.2, -0.4]);
  const normals = Float32Array.from([0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0]);
  return { positions, normals, door: doorPart(positions, [1, 4]) };
};

describe("a close-up's driver's door (scissor door, 21.11)", () => {
  it("hinges at the top of its front edge, on its own side", () => {
    const t = template();
    expect(t.door.side).toBe(-1);
    expect(t.door.hinge.z).toBeCloseTo(0.47, 6);
    expect(t.door.hinge.y).toBeCloseTo(0.2 + 0.7 * 0.8, 6);
  });

  it("swings its rear up and a little out, keeps the hinge, leaves the body, and is drawn as it is shut", () => {
    const t = template();
    const out = { positions: new Float32Array(0), normals: new Float32Array(0) };
    expect(poseDoor(t, t.door, 0, out)).toBe(t);
    expect(poseDoor(t, t.door, undefined, out)).toBe(t);
    const open = poseDoor(t, t.door, 1, out).positions;
    // The rear's bottom corner (vertex 4) rises well over the roof's height and comes forward.
    expect(vertex(open, 4).y).toBeGreaterThan(1.2);
    expect(vertex(open, 4).z).toBeGreaterThan(-0.4);
    // The front's top stays near the hinge; out by DOOR_OUT on its side.
    expect(vertex(open, 2).x).toBeCloseTo(-0.9 - DOOR_OUT, 6);
    expect(vertex(open, 0)).toEqual({ x: 0, y: 1, z: 0 });
    // Half open lies between.
    const half = poseDoor(t, t.door, 0.5, { positions: new Float32Array(0), normals: new Float32Array(0) }).positions;
    expect(vertex(half, 4).y).toBeGreaterThan(0.2);
    expect(vertex(half, 4).y).toBeLessThan(vertex(open, 4).y);
  });

  it("has the sports car's close-up in the file with its door on the driver's side between the wheels", () => {
    const file = (name: string): ArrayBuffer => {
      const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const kit = parseCityKit(file("city-kit.glb"));
    const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("vehicle-props.glb")));
    const high = vehicleTemplates(kit, "hatchback", 0, { props: { data: props, uvs: kitUvs(props, kit) }, variant: { key: "veh-cyber", weight: 1 } })?.high;
    const door = high?.door;
    expect(door).toBeDefined();
    // The driver's side is the front left wheel's (the simulation's wheel 0).
    const frontLeft = high!.wheels!.find((w) => w.index === 0)!;
    expect(Math.sign(frontLeft.axle.x)).toBe(door!.side);
    expect(door!.count).toBeGreaterThan(100);
    // Its hinge behind the front axle, over the sill.
    expect(door!.hinge.z).toBeLessThan(frontLeft.axle.z);
    expect(door!.hinge.y).toBeGreaterThan(0.5);
    // Last in the mesh, after the wheels.
    expect(door!.first).toBeGreaterThan(Math.max(...high!.wheels!.map((w) => w.first)));
  });
});
