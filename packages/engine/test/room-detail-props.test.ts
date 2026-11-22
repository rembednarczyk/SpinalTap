// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { KOI_DETAIL } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { parseCityProps, triangleCount } from "../src/renderer/city-props";

/**
 * The rooms' detail of `room-detail-props.glb` (ADR-0098, `tools/city_blender.py`): every shape of
 * `ROOM_DETAIL_SHAPES` a model of the file, light enough for a room's furniture and its file small.
 */
const bytes = ((b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)(
  (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/room-detail-props.glb", import.meta.url)),
);
const props = parseCityProps(bytes);

describe("room-detail-props.glb (ADR-0098)", () => {
  it("has a model for every shape of the rooms' detail, by its key", () => {
    for (const s of ROOM_DETAIL_SHAPES) expect(props.models.get(s.key), s.key).toBeDefined();
  });

  it("is light: at most 16 thousand triangles a model, a file under 768 KiB", () => {
    for (const s of ROOM_DETAIL_SHAPES) expect(triangleCount(props.models.get(s.key)!), s.key).toBeLessThanOrEqual(16000);
    expect(bytes.byteLength).toBeLessThan(768 * 1024);
  });

  it("stands Neon Koi's counter, shelf and jukebox in their solids' boxes (10 × 1.1 × 0.8, 10 × 2.4 × 0.6, 0.8 × 1.6 × 0.8 m)", () => {
    const size = (key: string) => props.models.get(key)!.size;
    expect(size("rd-koi-counter").x).toBeCloseTo(10, 0);
    expect(size("rd-koi-counter").y).toBeCloseTo(1.1, 2);
    expect(size("rd-koi-shelf").y).toBeCloseTo(2.4, 2);
    expect(size("rd-koi-jukebox").y).toBeLessThanOrEqual(1.6);
    expect(KOI_DETAIL.every((p) => p.prop === "room-detail")).toBe(true);
  });
});
