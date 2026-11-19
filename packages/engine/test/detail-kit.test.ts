// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KIT_DETAIL, KIT_DETAIL_GLSL, KIT_GRID, LAYERS_BY_NUMBER, globalLayer, kitDetailCodes } from "../src/npr/detail-kit";
import { DETAIL_LAYERS } from "../src/npr/detail-layers";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";

/*
 * The city kit's detail layers (ADR-0092 stage 2): each surface swatch of the kit's palette gets its
 * layer's code, read back by the shader from the swatch's palette cell; glass, neon and paint none.
 */

const b = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
const kit = parseCityKit(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
const names = kit.swatches.map((s) => s.name);

/** The shader's decode: the palette cell of a UV, then its code. */
const codeAt = (codes: Uint8Array, [u, v]: readonly [number, number]): number => {
  const [cx, cy] = [Math.floor(u * KIT_GRID), Math.floor(v * 3 * KIT_GRID)];
  return codes[(cy * KIT_GRID + cx) * 4]!;
};

describe("the city kit's detail layers (ADR-0092 stage 2)", () => {
  it("numbers the layers by file and channel, as the shader reads them", () => {
    expect(LAYERS_BY_NUMBER.map(globalLayer)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(globalLayer("grey_plaster_02")).toBe(0);
    expect(globalLayer("asphalt_02")).toBe(4);
    expect(globalLayer("granite_tile")).toBe(11);
    expect([...KIT_DETAIL_GLSL.matchAll(/\b(?:float|vec[234]|bool|int)\s+(flat|smooth|centroid|sample|patch|layout|invariant|buffer|shared|filter|input|output|active)\b/g)]).toEqual([]);
    expect(KIT_DETAIL_GLSL.match(/if \(code < \d+\.5000\)/g)).toHaveLength(Object.keys(DETAIL_LAYERS).length);
  });

  it("gives every mapped swatch of the kit its layer, found from its palette cell; glass, neon and paint none", () => {
    expect(kit.grid).toBe(KIT_GRID);
    for (const name of Object.keys(KIT_DETAIL)) expect(names, name).toContain(name);
    const codes = kitDetailCodes(names);
    for (const name of names) {
      const want = KIT_DETAIL[name];
      expect(codeAt(codes, swatchUv(kit, name)), name).toBe(want ? globalLayer(want) + 1 : 0);
    }
    for (const name of ["glass-dark", "shop-warm", "neon-cyan", "paint", "door", "win-warm"]) expect(codeAt(codes, swatchUv(kit, name)), name).toBe(0);
    expect(codeAt(codes, swatchUv(kit, "brick"))).toBe(globalLayer("medieval_red_brick") + 1);
  });
});
