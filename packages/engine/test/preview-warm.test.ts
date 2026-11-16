import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewStage } from "../src/renderer/preview-stage";
import { readModelFile, serveModels } from "./game-models";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The game's file from disk, as `serveModels` answers it. */
const serveFile = (url: string) => {
  const b = readModelFile(url);
  return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
};

const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as unknown as HTMLCanvasElement;

/**
 * The menu's preview dresses Seki before the menu first opens (the user's decision of 13.11: her
 * model loads with the first loading, in every view), and never shows the stand-in rig meanwhile.
 */
describe("the character menu's preview", () => {
  it("dresses Seki once warmed, before the menu opens, with no stand-in drawn while she loads", async () => {
    serveModels();
    const preview = new PreviewStage(new NullEngine(), canvas);
    preview.setModels({ heroine: { url: "seki.vrm" } });
    preview.warm();
    expect(preview.state.waiting).toBe(true);
    expect(preview.state.dressed).toBe(false);
    await vi.waitFor(() => expect(preview.state.dressed).toBe(true), { timeout: 20_000 });
    expect(preview.state.waiting).toBe(false);
    preview.dispose();
  }, 30_000);

  it("shows the procedural heroine when her model fails to load", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const preview = new PreviewStage(new NullEngine(), canvas);
    preview.setModels({ heroine: { url: "missing.vrm" } });
    preview.warm();
    await vi.waitFor(() => expect(preview.state.waiting).toBe(false));
    expect(preview.state.dressed).toBe(false);
    preview.dispose();
  });

  it("dresses Seki when the menu opens after her first download failed (G-807)", async () => {
    let failing = true;
    vi.stubGlobal("fetch", (url: string) => {
      if (!failing) return serveFile(url);
      failing = false;
      return Promise.reject(new Error("offline"));
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const preview = new PreviewStage(new NullEngine(), canvas);
    preview.setModels({ heroine: { url: "seki.vrm" } });
    preview.warm();
    await vi.waitFor(() => expect(preview.state.waiting).toBe(false));
    expect(preview.state.dressed).toBe(false);
    preview.setViewport({ x: 0, y: 0, width: 400, height: 600 });
    await vi.waitFor(() => expect(preview.state.dressed).toBe(true), { timeout: 20_000 });
    preview.dispose();
  }, 30_000);

  it("has nothing to wait for without a model manifest", () => {
    const preview = new PreviewStage(new NullEngine(), canvas);
    preview.setModels({});
    preview.warm();
    expect(preview.state.waiting).toBe(false);
    preview.dispose();
  });
});
