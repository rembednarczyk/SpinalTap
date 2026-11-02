// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { DOOR_MODELS, type DoorModel, doorVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { MeshSink } from "../src/renderer/mesh-sink";
import { bakeDoor, doorModel } from "../src/renderer/mapcity/door-models";
import { DOOR_FRAME, LEAF_TOP, leafHeight } from "../src/renderer/mapcity/prop-door";
import type { WorldProp } from "../src/renderer/mapcity/prop-batch";

/**
 * The doors on the facades (ADR-0058 stage 9): the leaves of `door-props.glb` (CC-BY, E7 of the second
 * pack) and the doors the renderer bakes from a piece, with its file and without (phones, before it loads).
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const doorBytes = file("door-props.glb");
const doors = parseCityProps(doorBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), doors);

/** A door piece at the origin facing +z (yaw 0), its variant for `model`, `width` x `height`. */
const piece = (model: DoorModel, width: number, height: number): WorldProp => ({ prop: "door", x: 0, y: 0, z: 0, yaw: 0, shape: DOOR_MODELS.indexOf(model), scale: 1, variant: doorVariant({ model, width, height }) });

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x0: Math.min(...at(0)), x1: Math.max(...at(0)), y0: Math.min(...at(1)), y1: Math.max(...at(1)), z0: Math.min(...at(2)), z1: Math.max(...at(2)) };
};

describe("door-props.glb (ADR-0058 stage 9)", () => {
  it("has a leaf for every door model, CC-BY with its credit, light and small", () => {
    expect([...doors.models.keys()]).toEqual(["dr-steel", "dr-steel-double", "dr-shop", "dr-tall", "dr-code", "dr-shutter"]);
    for (const m of DOOR_MODELS) expect(doorModel(props, m), m).not.toBeNull();
    for (const m of doors.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(1500);
    expect(doorBytes.byteLength).toBeLessThan(160 * 1024);
    expect(doors.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(doorBytes, 20, new DataView(doorBytes, 12, 4).getUint32(0, true)));
    for (const id of ["sketchfab-cyberpunk-doors-and-windows", "sketchfab-psx-garage-doors", "sketchfab-cyberpunk-scifi-door-3"]) expect(json).toContain(`"credit":"${id}"`);
  });

  it("names in `sources.json` only leaves the file has, each under its pack", () => {
    const sources = (JSON.parse((readFileSync as (url: URL, enc: string) => string)(new URL("../../../tools/assets/sources.json", import.meta.url), "utf8")) as {
      sources: { id: string; used?: string[] }[];
    }).sources;
    const used = sources.flatMap((s) => (s.used ?? []).filter((k) => k.startsWith("dr-")).map((k) => ({ id: s.id, k })));
    expect(used.map((u) => u.k).sort()).toEqual([...doors.models.keys()].sort());
    expect(used.find((u) => u.k === "dr-code")!.id).toBe("sketchfab-cyberpunk-scifi-door-3");
  });
});

describe("a door baked at its place (ADR-0058 stage 9)", () => {
  for (const withFile of [true, false]) {
    it(`stands in its opening, its back on the wall, with${withFile ? "" : "out"} the file`, () => {
      for (const model of DOOR_MODELS) {
        for (const [w, h] of [
          [1.2, 2.3],
          [2.6, 3.2],
        ] as const) {
          const sink = new MeshSink();
          bakeDoor(sink, withFile ? props : null, piece(model, w, h));
          const b = bounds(sink);
          // Within its width and height, out from the wall by its surround's depth, never into the wall.
          expect(b.x0, model).toBeGreaterThanOrEqual(-w / 2 - 1e-3);
          expect(b.x1, model).toBeLessThanOrEqual(w / 2 + 1e-3);
          expect(b.y0, model).toBeGreaterThanOrEqual(-1e-3);
          expect(b.y1, model).toBeCloseTo(h, 2);
          expect(b.z0, model).toBeGreaterThanOrEqual(-1e-3);
          expect(b.z1, model).toBeLessThanOrEqual(DOOR_FRAME.depth + 0.07);
        }
      }
    });
  }

  it("a door taller than its leaf gets a fanlight over it; the leaf of a roller shutter fills it", () => {
    const at = (s: MeshSink, y: number) => s.positions.some((v, i) => i % 3 === 1 && Math.abs(v - y) < 0.01);
    const tall = new MeshSink();
    bakeDoor(tall, props, piece("tall", 1.4, 3.2));
    expect(leafHeight({ model: "tall", width: 1.4, height: 3.2 })).toBe(LEAF_TOP);
    expect(at(tall, LEAF_TOP + 0.06)).toBe(true);
    expect(leafHeight({ model: "shutter", width: 2.4, height: 3.2 })).toBeCloseTo(3.2 - DOOR_FRAME.lintel, 6);
  });

  it("the leaf of the file takes the procedural leaf's place: the same surround, fewer of its boxes", () => {
    const a = new MeshSink();
    const b = new MeshSink();
    bakeDoor(a, props, piece("steel", 1.2, 2.3));
    bakeDoor(b, null, piece("steel", 1.2, 2.3));
    expect(a.vertexCount).toBeGreaterThan(b.vertexCount);
    expect(bounds(a)).toEqual(bounds(b));
  });
});
