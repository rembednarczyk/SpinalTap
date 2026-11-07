// @ts-expect-error The engine is typed for the browser; the tests read the files off disk.
import { readFileSync } from "node:fs";
import { vi } from "vitest";

const read = readFileSync as (u: URL) => Uint8Array;

/** A file of the game's character models (packages/app/public/models). */
export const modelFileOf = (url: string): URL => new URL(`../../app/public/models/${url}`, import.meta.url);

export const readModelFile = (url: string): Uint8Array => read(modelFileOf(url));

const manifest = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as Record<string, unknown>;

const entriesOf = (v: unknown): { url: string }[] =>
  Array.isArray(v) ? (v as { url: string }[]) : typeof v === "object" && v !== null && "url" in v ? [v as { url: string }] : Object.values(v as object).flatMap(entriesOf);

/** Every file the game's manifest names, once: the role models, the cast and the pools (ADR-0076). */
export const GAME_MODEL_FILES: readonly string[] = [...new Set(Object.values(manifest).flatMap(entriesOf).map((e) => e.url))].sort();

/** The game's own model files, served from disk to `fetch`. */
export const serveModels = (): void => {
  vi.stubGlobal("fetch", (url: string) => {
    const b = readModelFile(url);
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });
};
