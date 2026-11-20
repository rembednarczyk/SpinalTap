// @ts-expect-error The engine is typed for the browser; the test reads the packed files off disk.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DETAIL_FILES, DETAIL_GLSL, DETAIL_LAYERS, ROOF_DETAIL, WALL_DETAIL } from "../src/npr/detail-layers";
import { FACADE_GLSL, GROUND_GLSL } from "../src/npr/toon-city";
import { DETAIL_STEP, roofMeta, wallMeta } from "../src/renderer/mapcity/facade-frame";
import { type StyleInput, facadeStyle } from "../src/renderer/mapcity/facade-style";

/*
 * The detail layers of the city's surfaces (ADR-0092): the engine's table matches the files the tool
 * packed, a wall's or roof's surface reaches the shader in uv2.x, and the surfaces follow Lublin:
 * the map's brick and stone, the post-war blocks in concrete, the factories in brick or sheet metal.
 */

const textures = (name: string): URL => new URL(`../../app/public/textures/${name}`, import.meta.url);
const read = readFileSync as (url: URL, enc: "utf8") => string;
const exists = existsSync as (url: URL) => boolean;

/** What the facade shader reads back from uv2.x, in float32 as the GPU holds it. */
const decode = (x: number): { mat: number; storey: number; bay: number } => {
  const v = Math.fround(x);
  const mat = Math.floor((v + 0.0005) / DETAIL_STEP);
  return { mat, storey: (Math.floor(v + 0.0005) - DETAIL_STEP * mat) / 10, bay: Math.floor((v - Math.floor(v)) * 1000 + 0.5) / 100 };
};

const style = (over: Partial<StyleInput>, look: number) => facadeStyle({ use: "residential", levels: 4, height: 14, roof: 3, look, area: 400, width: 14, ...over });
const looks = Array.from({ length: 200 }, (_, i) => (i * 2654435761) >>> 0);

describe("detail layers of the city's surfaces (ADR-0092)", () => {
  it("matches the files the tool packed: file, channel and tile of every layer", () => {
    const packed = JSON.parse(read(textures("layers.json"), "utf8")) as Record<string, { file: string; channel: string; metres: number }>;
    expect(Object.keys(packed).sort()).toEqual(Object.keys(DETAIL_LAYERS).sort());
    for (const [asset, l] of Object.entries(DETAIL_LAYERS)) {
      const p = packed[asset]!;
      expect(p.file, asset).toBe(`textures/${DETAIL_FILES[l.texture]}`);
      expect(p.channel, asset).toBe("rgba"[l.channel]);
      expect(p.metres, asset).toBeCloseTo(l.metres, 2);
    }
    for (const f of Object.values(DETAIL_FILES)) expect(exists(textures(f)), f).toBe(true);
    // Every surface code has its branch in the shader's choosers.
    expect(DETAIL_GLSL.match(/if \(code </g)).toHaveLength(Object.keys(WALL_DETAIL).length + Object.keys(ROOF_DETAIL).length);
  });

  it("names no variable with a word GLSL ES 3.0 keeps for itself (the game compiles its shaders as WebGL 2)", () => {
    const reserved = /\b(?:float|vec[234]|bool|int)\s+(flat|smooth|centroid|sample|patch|layout|invariant|buffer|shared|filter|input|output|active|common|partition|superp|resource)\b/g;
    expect([...`${DETAIL_GLSL}${FACADE_GLSL}${GROUND_GLSL}`.matchAll(reserved)].map((m) => m[1])).toEqual([]);
    expect([..."float flat = 1.0;".matchAll(reserved)].map((m) => m[1])).toEqual(["flat"]);
  });

  it("carries the surface in uv2.x over the storey and bay, which read back unchanged", () => {
    for (const detail of Object.values(WALL_DETAIL)) {
      const [x] = wallMeta(3.6, 2.87, 1, 0.4, detail);
      expect(decode(x)).toEqual({ mat: detail, storey: 3.6, bay: 2.87 });
      // A blind wall keeps its surface too.
      expect(decode(wallMeta(3.6, 0, 1, 0.4, detail)[0])).toEqual({ mat: detail, storey: 0, bay: 0 });
    }
    for (const detail of Object.values(ROOF_DETAIL)) expect(decode(roofMeta(0.3, detail)[0]).mat).toBe(detail);
    // The tallest storey a facade has (7.5 m) stays under one step.
    expect(75).toBeLessThan(DETAIL_STEP);
  });

  it("lays the map's brick and stone, concrete on the blocks and garages, brick or metal on the factories", () => {
    for (const look of looks.slice(0, 20)) {
      expect(style({ material: "brick" }, look).wallDetail).toBe("brick");
      expect(style({ material: "stone" }, look).wallDetail).toBe("stone");
      expect(style({ use: "garage", levels: 1 }, look).wallDetail).toBe("concrete");
    }
    const blocks = looks.map((l) => style({ levels: 10, height: 30 }, l)).filter((s) => s.window === 6);
    expect(blocks.length).toBeGreaterThan(50);
    expect(blocks.every((s) => s.wallDetail === "concrete")).toBe(true);
    const halls = looks.map((l) => style({ use: "industrial", levels: 2, height: 9 }, l));
    const brick = halls.filter((s) => s.wallDetail === "brick" || s.wallDetail === "clinker");
    expect(halls.some((s) => s.wallDetail === "clinker")).toBe(true);
    expect(brick.length / halls.length).toBeGreaterThan(0.4);
    expect(halls.some((s) => s.wallDetail === "metal")).toBe(true);
    // Factory brick is brick red, not a grey plaster with a brick grain.
    for (const s of brick) expect(parseInt(s.plaster.slice(1, 3), 16)).toBeGreaterThan(parseInt(s.plaster.slice(5, 7), 16) + 40);
    expect(looks.map((l) => style({}, l)).filter((s) => s.window === 1).every((s) => s.wallDetail === "plaster")).toBe(true);
  });

  it("gives a flat roof bitumen and a pitched one the surface of its colour, the same each time", () => {
    for (const look of looks.slice(0, 40)) {
      const flat = style({ roof: 0 }, look);
      expect(flat.roofDetail).toBe("bitumen");
      const pitched = style({ use: "historic" }, look);
      expect(pitched.roofDetail).not.toBe("bitumen");
      expect(style({ use: "historic" }, look)).toEqual(pitched);
    }
    const kinds = new Set(looks.map((l) => style({ use: "historic" }, l).roofDetail));
    expect([...kinds].sort()).toEqual(["copper", "metal", "tile"]);
  });
});
