// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { KOI_DETAIL } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { facing, mergeCityProps, parseCityProps, transformProp, triangleCount } from "../src/renderer/city-props";
import { bakeRoomDetail } from "../src/renderer/mapcity/room-detail-models";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * The rooms' detail of `room-detail-props.glb` (ADR-0098, `tools/city_blender.py`): every shape of
 * `ROOM_DETAIL_SHAPES` a model of the file, light enough for a room's furniture and its file small.
 */
/** The files, one a district (`FILE` of each room's module in `tools/blender/rooms/`). */
const FILES = ["room-detail-props.glb", "room-detail-doki-props.glb", "room-detail-stare-props.glb", "room-detail-w3-props.glb", "room-detail-metro-props.glb", "room-detail-alchemia-props.glb", "room-detail-galeria-props.glb", "room-detail-kits-props.glb", "room-detail-myjnia-props.glb", "room-detail-sceny-props.glb", "room-detail-krakowskie-props.glb", "room-detail-brama-props.glb", "room-detail-t1-props.glb", "room-detail-t2-props.glb", "room-detail-rynek-props.glb", "room-detail-grodzka-props.glb", "room-detail-deptak-props.glb", "room-detail-w3-out-props.glb"] as const;
const read = (name: string): ArrayBuffer =>
  ((b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)(
    (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url)),
  );
const files = FILES.map(read);
const props = files.map(parseCityProps).reduce((a, b) => mergeCityProps(a, b));

describe("room-detail-props.glb (ADR-0098)", () => {
  it("has a model for every shape of the rooms' detail, by its key", () => {
    for (const s of ROOM_DETAIL_SHAPES) expect(props.models.get(s.key), s.key).toBeDefined();
    for (const s of ROOM_DETAIL_SHAPES) if (s.lod) expect(props.models.get(s.lod), s.lod).toBeDefined();
  });

  it("bakes a shape's phone model on low quality (the gallery's goods in a few boxes), its own on the others", () => {
    const shape = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === "rd-gl-food");
    const p = { prop: "room-detail" as const, x: 0, y: 0, z: 0, yaw: 0, shape, scale: 1 };
    const verts = (quality: "low" | "high") => {
      const sink = new MeshSink();
      bakeRoomDetail(sink, props, p, quality);
      return sink.vertexCount;
    };
    expect(verts("low")).toBe(props.models.get("rd-gl-food-lod")!.positions.length / 3);
    expect(verts("high")).toBe(props.models.get("rd-gl-food")!.positions.length / 3);
    expect(verts("low") * 4).toBeLessThan(verts("high"));
  });

  it("is light: at most 16 thousand triangles a model, each file under 768 KiB", () => {
    for (const s of ROOM_DETAIL_SHAPES) expect(triangleCount(props.models.get(s.key)!), s.key).toBeLessThanOrEqual(16000);
    for (const [i, f] of files.entries()) expect(f.byteLength, FILES[i]).toBeLessThan(768 * 1024);
  });

  it("stands Neon Koi's counter, shelf and jukebox in their solids' boxes (10 × 1.1 × 0.8, 10 × 2.4 × 0.6, 0.8 × 1.6 × 0.8 m)", () => {
    const size = (key: string) => props.models.get(key)!.size;
    expect(size("rd-koi-counter").x).toBeCloseTo(10, 0);
    expect(size("rd-koi-counter").y).toBeCloseTo(1.1, 2);
    expect(size("rd-koi-shelf").y).toBeCloseTo(2.4, 2);
    expect(size("rd-koi-jukebox").y).toBeLessThanOrEqual(1.6);
    expect(KOI_DETAIL.every((p) => p.prop === "room-detail")).toBe(true);
  });

  it("keeps a model's x the world's at yaw 0, not mirrored (the clinic chair's raised back at its head, the model's -x)", () => {
    const chair = props.models.get("rd-clinic-chair")!;
    const { positions } = transformProp(chair, facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }));
    let top = 0;
    for (let i = 3; i < positions.length; i += 3) if ((positions[i + 1] ?? 0) > (positions[top + 1] ?? 0)) top = i;
    expect(positions[top]).toBeLessThan(-0.3);
  });
});
