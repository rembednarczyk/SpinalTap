import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { modelBytesOf } from "../src/renderer/model-bytes";
import { ModelLibrary } from "../src/renderer/model-library";
import { PreviewStage } from "../src/renderer/preview-stage";
import { readModelFile } from "./game-models";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as unknown as HTMLCanvasElement;
const SEKI = { url: "seki.vrm" };

/** Serves the game's files from disk and counts the requests; the first `fail` of them fail. */
const serve = (fail = 0) => {
  const fetched: string[] = [];
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    if (fetched.length <= fail) return Promise.reject(new Error(`${url}: offline`));
    const b = readModelFile(url);
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });
  return { times: (url: string) => fetched.filter((u) => u === url).length };
};

/** The game's scene and the menu's preview on one engine, as in the app (ADR-0015). */
const session = () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const game = new ModelLibrary(scene, new ToonMaterials(scene), modelBytesOf(engine));
  const preview = new PreviewStage(engine, canvas);
  return {
    engine,
    game,
    preview,
    dressPreview: () => {
      preview.setModels({ heroine: SEKI });
      preview.warm();
    },
    previewDressed: () => vi.waitFor(() => expect(preview.state.dressed).toBe(true), { timeout: 20_000 }),
    dispose: () => {
      preview.dispose();
      engine.dispose();
    },
  };
};

/** One download of Seki's 7 MB file for the game and the menu's preview (G-808). */
describe("model bytes shared by the game and the preview", () => {
  it("fetches seki.vrm once when the preview and the game load her at the same time", async () => {
    const net = serve();
    const s = session();
    s.dressPreview();
    await s.game.preload(SEKI);
    await s.previewDressed();
    expect(net.times("seki.vrm")).toBe(1);
    expect(modelBytesOf(s.engine).held).toBe(0);
    s.dispose();
  }, 30_000);

  it("fetches seki.vrm once when the game starts first and the preview is set up while she downloads", async () => {
    const net = serve();
    const s = session();
    const game = s.game.preload(SEKI);
    s.dressPreview();
    await game;
    await s.previewDressed();
    expect(net.times("seki.vrm")).toBe(1);
    expect(modelBytesOf(s.engine).held).toBe(0);
    s.dispose();
  }, 30_000);

  it("fetches seki.vrm once when the game asks after the preview has dressed her", async () => {
    const net = serve();
    const s = session();
    s.dressPreview();
    await s.previewDressed();
    await s.game.preload(SEKI);
    expect(s.game.isLoaded("seki.vrm")).toBe(true);
    expect(net.times("seki.vrm")).toBe(1);
    expect(modelBytesOf(s.engine).held).toBe(0);
    s.dispose();
  }, 30_000);

  it("keeps no bytes once both have read them: a released file downloads again (ADR-0076 4b)", async () => {
    const net = serve();
    const s = session();
    s.dressPreview();
    await s.previewDressed();
    await s.game.preload(SEKI);
    expect(s.game.release("seki.vrm")).toBe(true);
    await s.game.preload(SEKI);
    expect(net.times("seki.vrm")).toBe(2);
    expect(modelBytesOf(s.engine).held).toBe(0);
    s.dispose();
  }, 30_000);

  it("fetches again after a failed download, once for both (G-807)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const net = serve(1);
    const s = session();
    s.dressPreview();
    await expect(s.game.preload(SEKI)).rejects.toThrow("offline");
    await vi.waitFor(() => expect(s.preview.state.waiting).toBe(false));
    await s.game.preload(SEKI);
    s.preview.setViewport({ x: 0, y: 0, width: 400, height: 600 });
    await s.previewDressed();
    expect(net.times("seki.vrm")).toBe(2);
    expect(modelBytesOf(s.engine).held).toBe(0);
    s.dispose();
  }, 30_000);

  it("keeps a file nobody shares only while it is on its way", async () => {
    const net = serve();
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const a = new ModelLibrary(scene, new ToonMaterials(scene), modelBytesOf(engine));
    const b = new ModelLibrary(scene, new ToonMaterials(scene), modelBytesOf(engine));
    await Promise.all([a.preload({ url: "kaito.vrm" }), b.preload({ url: "kaito.vrm" })]);
    expect(net.times("kaito.vrm")).toBe(1);
    expect(modelBytesOf(engine).held).toBe(0);
    engine.dispose();
  }, 30_000);
});
