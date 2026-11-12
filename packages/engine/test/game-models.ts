// @ts-expect-error The engine is typed for the browser; the tests read the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { vi } from "vitest";
import { Scene } from "../src/babylon";

const read = readFileSync as (u: URL) => Uint8Array;

/** A file of the game's character models (packages/app/public/models). */
export const modelFileOf = (url: string): URL => new URL(`../../app/public/models/${url}`, import.meta.url);

export const readModelFile = (url: string): Uint8Array => read(modelFileOf(url));

const manifest = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as Record<string, unknown>;

const entriesOf = (v: unknown): { url: string }[] =>
  Array.isArray(v) ? (v as { url: string }[]) : typeof v === "object" && v !== null && "url" in v ? [v as { url: string }] : Object.values(v as object).flatMap(entriesOf);

/** Every file the game's manifest names, once: the role models, the cast and the pools (ADR-0076). */
export const GAME_MODEL_FILES: readonly string[] = [...new Set(Object.values(manifest).flatMap(entriesOf).map((e) => e.url))].sort();

const engines: NullEngine[] = [];

/**
 * A scene on a null engine for loading model files, freed by `disposeModelScenes`: Babylon keeps
 * every engine in `EngineStore`, and with its scenes the files' vertex data, so a test file
 * that loads the game's files over and over grew to 1.4 GB of heap and spent its time in the
 * garbage collector (G-620).
 */
export const modelScene = (): Scene => {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
};

export const disposeModelScenes = (): void => {
  for (const engine of engines.splice(0)) engine.dispose();
};

/** The game's own model files, served from disk to `fetch`. */
export const serveModels = (): void => {
  vi.stubGlobal("fetch", (url: string) => {
    const b = readModelFile(url);
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });
};

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
export const basePixelsOf = (url: string): Map<string, number> => {
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
export const gpuMiB = (pixels: number): number => (pixels * 4 * 4) / 3 / 2 ** 20;

/**
 * GPU MiB a loaded file keeps (ADR-0076 §4): its base textures, once each, without the hidden
 * "EyeExtra" layer's, which the loader frees (`model-textures.test.ts` measures the same per file).
 */
export const fileGpuMiB = (url: string): number => {
  const pixels = basePixelsOf(url);
  return [...pixels].filter(([name]) => !/eyeextra/i.test(name)).reduce((sum, [, p]) => sum + gpuMiB(p), 0);
};
