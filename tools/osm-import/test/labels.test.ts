import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { chunkFootWays, chunkServiceWays, chunkStreets } from "../src/labels.ts";

const rect = { minX: 0, minZ: 0, maxX: 100, maxZ: 100 };
const street = (x0: number, x1: number): Line => ({ id: "w1", osmId: 1, tags: { highway: "residential", name: "Lubartowska" }, line: [{ x: x0, z: 50 }, { x: x1, z: 50 }] });

describe("chunk streets", () => {
  it("drop a short way wholly inside the chunk as noise", () => {
    expect(chunkStreets([street(40, 43)], rect)).toEqual([]);
  });

  it("keep a short piece the chunk's edge cut off a longer way, so the street has no hole at the seam (G-021)", () => {
    expect(chunkStreets([street(96, 140)], rect).map((s) => s.line)).toEqual([[96, 50, 100, 50]]);
  });

  it("drop a piece cut at the edge under half a metre, where the roads join over the gap anyway", () => {
    expect(chunkStreets([street(99.7, 140)], rect)).toEqual([]);
  });
});

describe("chunk service ways (G-140)", () => {
  const way = (tags: Record<string, string>): Line => ({ id: "w2", osmId: 2, tags: { highway: "service", ...tags }, line: [{ x: 40, z: 50 }, { x: 43, z: 50 }] });

  it("keep an unnamed driveway's axis, a short stub too, with its carriageway's width, out of the streets", () => {
    expect(chunkServiceWays([way({ service: "driveway" })], rect)).toEqual([{ line: [40, 50, 43, 50], width: 4 }]);
    expect(chunkServiceWays([way({ width: "3" })], rect)).toEqual([{ line: [40, 50, 43, 50], width: 3 }]);
    expect(chunkStreets([way({ service: "driveway" })], rect)).toEqual([]);
  });

  it("leave out a car park's aisle, a named one (among the streets), an area and one underground", () => {
    for (const tags of [{ service: "parking_aisle" } as Record<string, string>, { name: "Plac Jana Kochanowskiego" }, { area: "yes" }, { layer: "-1" }]) expect(chunkServiceWays([way(tags)], rect)).toEqual([]);
  });
});

describe("chunk footways (G-143)", () => {
  const way = (tags: Record<string, string>): Line => ({ id: "w3", osmId: 3, tags: { highway: "footway", ...tags }, line: [{ x: 40, z: 50 }, { x: 52, z: 50 }] });

  it("keep a footway's or a path's axis mapped on its own, named or not, with its width", () => {
    expect(chunkFootWays([way({})], rect)).toEqual([{ line: [40, 50, 52, 50], width: 2.5 }]);
    expect(chunkFootWays([way({ highway: "path", name: "Aleja" })], rect)).toEqual([{ line: [40, 50, 52, 50], width: 2 }]);
    expect(chunkFootWays([way({ width: "1.5" })], rect)).toEqual([{ line: [40, 50, 52, 50], width: 1.5 }]);
  });

  it("leave out a sidewalk along a kerb (a footway or a path, G-156), a crossing, an area, a footbridge, a tunnel and a cycleway", () => {
    for (const tags of [{ footway: "sidewalk" }, { highway: "path", path: "sidewalk" }, { footway: "crossing" }, { highway: "path", path: "crossing" }, { area: "yes" }, { bridge: "yes", layer: "1" }, { tunnel: "yes" }, { layer: "-1" }, { highway: "cycleway" }] as Record<string, string>[])
      expect(chunkFootWays([way(tags)], rect)).toEqual([]);
  });
});
