// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { CLUTTER, CLUTTER_SHAPES, SITE_CLUTTER_FROM } from "@seki/core";
import { describe, expect, it } from "vitest";
import { parseCityProps } from "../src/renderer/city-props";
import { MeshSink } from "../src/renderer/mesh-sink";
import { bakeClutter } from "../src/renderer/mapcity/clutter-models";
import type { WorldProp } from "../src/renderer/mapcity/prop-batch";

/** The odds and ends of ADR-0096 baked at their place, by quality: what the phones keep. */
const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/extra-props.glb", import.meta.url));
const props = parseCityProps(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
const piece = (shape: number): WorldProp => ({ prop: "clutter", x: 0, y: 0, z: 0, yaw: 0, shape, scale: 1, variant: shape });
const baked = (shape: number, quality: "low" | "medium" | "high", file = true): number => {
  const sink = new MeshSink();
  bakeClutter(sink, file ? props : null, piece(shape), quality);
  return sink.vertexCount;
};

describe("clutter at its place (ADR-0096)", () => {
  it("bakes every shape's model from the file, nothing before it loads", () => {
    for (let s = 0; s < CLUTTER_SHAPES.length; s++) {
      expect(baked(s, "high"), CLUTTER_SHAPES[s]!.key).toBeGreaterThan(0);
      expect(baked(s, "high", false)).toBe(0);
    }
  });

  it("keeps on the phones the cash machines and the building sites' cones and barriers, solids on the pavement, and drops the bags and boxes", () => {
    expect(baked(CLUTTER.atmWall, "low")).toBeGreaterThan(0);
    for (let s = SITE_CLUTTER_FROM; s < CLUTTER_SHAPES.length; s++) expect(baked(s, "low"), CLUTTER_SHAPES[s]!.key).toBeGreaterThan(0);
    for (const s of [...CLUTTER.bags, ...CLUTTER.boxes, CLUTTER.bin, CLUTTER.barrel]) expect(baked(s, "low")).toBe(0);
  });
});
