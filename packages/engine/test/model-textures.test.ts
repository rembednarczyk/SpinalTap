import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary, toonSourceOf } from "../src/renderer/model-library";
import { GAME_MODEL_FILES, readModelFile, serveModels } from "./game-models";

interface Gltf {
  readonly materials: { readonly name: string; readonly pbrMetallicRoughness?: { readonly baseColorTexture?: { readonly index: number } } }[];
  readonly textures: { readonly source: number }[];
  readonly images: { readonly bufferView: number }[];
  readonly bufferViews: { readonly byteOffset?: number }[];
}

/**
 * Pixels of each material's base texture, read from the PNG headers in the file: the null engine
 * reports no real sizes. Babylon names a glTF base texture "<material> (Base Color)".
 */
const basePixelsOf = (url: string): Map<string, number> => {
  const b = readModelFile(url);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const length = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + length))) as Gltf;
  const bin = 20 + length + 8;
  const out = new Map<string, number>();
  for (const m of gltf.materials) {
    const tex = m.pbrMetallicRoughness?.baseColorTexture;
    if (!tex) continue;
    const image = gltf.images[gltf.textures[tex.index]!.source]!;
    const at = bin + (gltf.bufferViews[image.bufferView]!.byteOffset ?? 0);
    // PNG: the IHDR chunk's width and height follow the 8-byte signature and the chunk header.
    out.set(`${m.name} (Base Color)`, view.getUint32(at + 16) * view.getUint32(at + 20));
  }
  return out;
};

/** GPU bytes of an RGBA8 texture with its mip chain. */
const gpuMiB = (pixels: number): number => (pixels * 4 * 4) / 3 / 2 ** 20;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * ADR-0076 §4: what a loaded model keeps in memory. VRoid materials are KHR_materials_unlit, so
 * Babylon decodes their base textures only (no normal maps, matcaps or emission); the loader then
 * lets go of every texture no toon material reads, such as the hidden "EyeExtra" layer's.
 */
describe("the cast's models keep only the textures the toon shader reads (ADR-0076)", () => {
  for (const url of GAME_MODEL_FILES) {
    it(`${url}: every kept texture paints a drawn mesh`, async () => {
      serveModels();
      const scene = new Scene(new NullEngine());
      const library = new ModelLibrary(scene, new ToonMaterials(scene));
      const model = await library.instantiate({ url }, "m");
      const kept = await library.texturesOf({ url });
      const painting = new Set<unknown>(model.meshes.map((m) => toonSourceOf(m)?.source.texture).filter((t) => t));
      const pixels = basePixelsOf(url);
      const mib = kept.reduce((sum, t) => sum + gpuMiB(pixels.get(t.name) ?? 0), 0);
      console.info(`[textures] ${url}: ${kept.length} textures, ${mib.toFixed(1)} MiB (RGBA8 + mips)`);
      for (const t of kept) {
        expect(painting.has(t), `${t.name}: read by no toon material`).toBe(true);
        expect(pixels.has(t.name), `${t.name}: a base colour texture`).toBe(true);
      }
      expect(kept.some((t) => /eyeextra/i.test(t.name))).toBe(false);
      // Base colour only: 41.7-47.0 MiB a file after the release, 44.3-49.7 before (ADR-0076 §4).
      expect(mib).toBeLessThan(50);
      model.dispose();
    });
  }
});
