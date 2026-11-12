import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, loadGltfPlugin } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import type { CharacterModelsDeps } from "../src/renderer/character-models";
import { loadToonModel } from "../src/renderer/model-loader";
import { readModelFile } from "./game-models";

/** A single red triangle as an embedded glTF 2.0 document. */
export const triangleGltf = (material = "red"): string => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const bytes = new Uint8Array(positions.byteLength + normals.byteLength);
  bytes.set(new Uint8Array(positions.buffer), 0);
  bytes.set(new Uint8Array(normals.buffer), positions.byteLength);
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "triangle" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ name: material, pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }],
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${btoa(String.fromCharCode(...bytes))}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
    ],
  };
  return `data:model/gltf+json;base64,${btoa(JSON.stringify(gltf))}`;
};

describe("loadToonModel", () => {
  it("imports glTF and swaps the PBR material for a toon material with the same base colour", async () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const model = await loadToonModel(scene, materials, triangleGltf(), { scale: 2 });
    const mesh = model.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(mesh.material?.name).toContain("imp:importedCharacter:#FF0000");
    expect(mesh.renderOutline).toBe(true);
    expect(scene.meshes).toContain(mesh);
    expect(model.root.scaling.x).toBeCloseTo(2);
    model.dispose();
    expect(scene.meshes).not.toContain(mesh);
  });

  it("shares one toon material between meshes with the same source colour", async () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const a = await loadToonModel(scene, materials, triangleGltf());
    const b = await loadToonModel(scene, materials, triangleGltf(), { outline: false });
    const ma = a.meshes.find((m) => m.getTotalVertices() > 0)!.material;
    const mb = b.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(mb.material).toBe(ma);
    expect(mb.renderOutline).toBeFalsy();
  });
});

describe("ModelLibrary", () => {
  it("loads a file once and hands out independent instances", async () => {
    const { ModelLibrary, pickAnimation, toonSourceOf } = await import("../src/renderer/model-library");
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const library = new ModelLibrary(scene, materials);
    const spec = { url: triangleGltf(), scale: 1.5 };
    const [a, b] = await Promise.all([library.instantiate(spec, "a"), library.instantiate(spec, "b")]);
    expect(a.root).not.toBe(b.root);
    expect(a.root.scaling.x).toBeCloseTo(1.5);
    const ma = a.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(ma.material?.name).toContain("#FF0000");
    // Imported characters are inked by the line-art pass; the hull is opt-in.
    expect(ma.renderOutline).toBeFalsy();
    // A pooled instance gets its bind pose back.
    const node = a.root.getChildren()[0] as unknown as { rotation: { x: number }; position: { y: number } };
    node.rotation.x = 1.2;
    node.position.y = 3;
    a.resetPose();
    expect(node.rotation.x).toBe(0);
    expect(node.position.y).toBe(0);
    expect(a.prefix).toBe("a-");
    a.dispose();
    expect(b.root.isDisposed()).toBe(false);
    expect(pickAnimation([], spec, 3)).toBeNull();
    // Every instance remembers what its toon material came from, so a garment tint can redo it.
    const tops = await library.instantiate({ url: triangleGltf("F00_001_01_Tops_01_CLOTH") }, "t");
    const source = toonSourceOf(tops.meshes.find((m) => m.getTotalVertices() > 0)!);
    expect(source?.preset).toBe("importedCharacter");
    expect(source?.source.garment).toBe("torso");
    expect(toonSourceOf(b.meshes.find((m) => m.getTotalVertices() > 0)!)?.source.garment).toBeNull();
  });
});

describe("ModelLibrary after a failed fetch (G-562)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the file again on the next ask instead of keeping the failure", async () => {
    const { ModelLibrary } = await import("../src/renderer/model-library");
    const asked: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      if (asked.length === 1) return Promise.reject(new Error("offline"));
      const b = readModelFile(url);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
    });
    const scene = new Scene(new NullEngine());
    const library = new ModelLibrary(scene, new ToonMaterials(scene));
    await expect(library.preload({ url: "kurosawa.vrm" })).rejects.toThrow("offline");
    expect(library.isLoaded("kurosawa.vrm")).toBe(false);
    const model = await library.instantiate({ url: "kurosawa.vrm" }, "k");
    expect(asked).toEqual(["kurosawa.vrm", "kurosawa.vrm"]);
    expect(library.isLoaded("kurosawa.vrm")).toBe(true);
    expect(model.meshes.length).toBeGreaterThan(0);
  });
});

describe("ModelLibrary with a fetch that never ends (G-561)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts the download after the time limit, fails the file like a failed fetch and fetches it again next time", async () => {
    // The glTF plugin arrives by a dynamic import, in real time: in before the clock is faked.
    await loadGltfPlugin();
    vi.useFakeTimers();
    const { MODEL_FETCH_TIMEOUT_MS, ModelLibrary } = await import("../src/renderer/model-library");
    const { CharacterModels } = await import("../src/renderer/character-models");
    const signals: AbortSignal[] = [];
    // Never answers, as a stalled connection; rejects on abort like the browser's fetch.
    vi.stubGlobal("fetch", (_url: string, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal;
      if (signal) signals.push(signal);
      return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason as Error)));
    });
    // No file gets past the fetch, so the scene and the materials are never touched.
    const library = new ModelLibrary({} as Scene, {} as ToonMaterials);
    const models = new CharacterModels({ library } as CharacterModelsDeps);
    models.setManifest({ civilian: { url: "civilian.vrm", lends: true } });
    // Outcomes are recorded, not awaited: a load that never settles fails the test instead of hanging it.
    const settled = new Map<string, string>();
    const watch = (key: string, p: Promise<unknown>) =>
      void p.then(
        () => settled.set(key, "loaded"),
        (e: unknown) => settled.set(key, e instanceof Error ? e.message : "failed"),
      );
    watch("preload", library.preload({ url: "kurosawa.vrm" }));
    watch("cloth", library.clothOf({ url: "civilian.vrm" }));
    watch("prefetch", models.prefetch());
    await vi.advanceTimersByTimeAsync(MODEL_FETCH_TIMEOUT_MS - 1);
    expect(settled.size).toBe(0);
    expect(signals.some((s) => s.aborted)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled.get("preload")).toMatch(/kurosawa\.vrm did not download/);
    expect(settled.get("cloth")).toMatch(/civilian\.vrm did not download/);
    // The background fetch of the donors moves on: a character waiting for the cloth keeps its stand-in.
    expect(settled.get("prefetch")).toBe("loaded");
    expect(signals.length).toBe(2);
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(library.isLoaded("kurosawa.vrm")).toBe(false);
    watch("again", library.preload({ url: "kurosawa.vrm" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(signals.length).toBe(3);
    await vi.advanceTimersByTimeAsync(MODEL_FETCH_TIMEOUT_MS);
  });
});

describe("ModelLibrary with an error status (G-634)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails the file with its URL and status instead of parsing the error page, and asks again next time", async () => {
    await loadGltfPlugin();
    const { ModelLibrary } = await import("../src/renderer/model-library");
    const asked: string[] = [];
    // The body is what a server sends with a 404: text, not a GLB.
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      const page = new TextEncoder().encode("<html>Not found</html>");
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", arrayBuffer: () => Promise.resolve(page.buffer) });
    });
    // The parser would need the scene: a file that is refused before it never touches it.
    const library = new ModelLibrary({} as Scene, {} as ToonMaterials);
    await expect(library.preload({ url: "missing.vrm" })).rejects.toThrow(/missing\.vrm.*404/);
    expect(library.isLoaded("missing.vrm")).toBe(false);
    await expect(library.preload({ url: "missing.vrm" })).rejects.toThrow(/404/);
    expect(asked).toEqual(["missing.vrm", "missing.vrm"]);
  });
});
