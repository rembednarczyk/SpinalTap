import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary, toonSourceOf } from "../src/renderer/model-library";
import { GAME_MODEL_FILES, basePixelsOf, gpuMiB, serveModels } from "./game-models";

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
