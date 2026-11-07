// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Color3, Scene, VertexBuffer } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary, toonSourceOf } from "../src/renderer/model-library";

const read = readFileSync as (u: URL) => Uint8Array;
const fileOf = (url: string) => new URL(`../../app/public/models/${url}`, import.meta.url);
const manifest = JSON.parse(new TextDecoder().decode(read(fileOf("manifest.json")))) as Record<string, { url: string }>;

/** The game's own VRM files, served from disk. */
const serveModels = () =>
  vi.stubGlobal("fetch", (url: string) => {
    const b = read(fileOf(url));
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });

/** Relative luminance of a "#rrggbb" colour. */
const luminance = (hex: string): number => {
  const c = Color3.FromHexString(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * G-474: Kaito drew as a black figure. `kaito.vrm` (Sakurada Fumiriya) carries a COLOR_0 vertex
 * colour of zeros on every primitive; MToon ignores vertex colours, but Babylon's ShaderMaterial
 * compiles VERTEXCOLOR for any mesh with the buffer, and the toon shader multiplies the albedo by it.
 */
describe("the cast's models keep their own colours (G-474)", () => {
  for (const [role, spec] of Object.entries(manifest)) {
    it(`${role} (${spec.url}): textured, not black, no vertex colour over the albedo`, async () => {
      serveModels();
      const scene = new Scene(new NullEngine());
      const library = new ModelLibrary(scene, new ToonMaterials(scene));
      const model = await library.instantiate(spec, role);
      const drawn = model.meshes.filter((m) => m.getTotalVertices() > 0);
      expect(drawn.length).toBeGreaterThan(0);
      for (const mesh of drawn) {
        const source = toonSourceOf(mesh)?.source;
        expect(source, mesh.name).toBeDefined();
        // Every VRoid layer is painted by its base texture; the factor only tints it.
        expect(source!.texture, `${mesh.name}: base texture`).not.toBeNull();
        expect(luminance(source!.base), `${mesh.name}: base colour ${source!.base}`).toBeGreaterThan(0.05);
        expect(mesh.isVerticesDataPresent(VertexBuffer.ColorKind), `${mesh.name}: vertex colour`).toBe(false);
      }
      model.dispose();
    });
  }
});
