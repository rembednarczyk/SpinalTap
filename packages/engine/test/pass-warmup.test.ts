import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import "@babylonjs/core/Meshes/instancedMesh";
import { afterAll, describe, expect, it } from "vitest";
import { type AbstractMesh, FreeCamera, type GeometryBufferRenderer, MeshBuilder, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { type WarmPass, geometryBufferPass, passesReady, scenePassesReady, warmTargets } from "../src/renderer/pass-warmup";

/**
 * The passes `scene.isReady` leaves out compile behind the loading screen (ADR-0057; measured
 * 14.11: the line art's skinned programs linked in the game, one frame of 0.5 to 12 s).
 */

const engine = new NullEngine();
afterAll(() => engine.dispose());

const sceneWithMeshes = () => {
  const scene = new Scene(engine);
  new FreeCamera("cam", new Vector3(0, 2, -10), scene);
  const material = new StandardMaterial("m", scene);
  const make = (name: string) => {
    const m = MeshBuilder.CreateBox(name, { size: 1 }, scene);
    m.material = material;
    return m;
  };
  return { scene, material, make };
};

describe("warmTargets", () => {
  it("keeps hidden and disabled meshes, leaves out what never draws", () => {
    const { scene, make } = sceneWithMeshes();
    const shown = make("shown");
    const hidden = make("hidden");
    hidden.isVisible = false;
    const disabled = make("disabled");
    disabled.setEnabled(false);
    const bare = MeshBuilder.CreateBox("bare", { size: 1 }, scene);
    const gone = make("gone");
    gone.dispose();
    const instance = shown.createInstance("copy");
    const names = warmTargets([shown, hidden, disabled, bare, gone, instance] as AbstractMesh[]).map((m) => m.name);
    expect(names).toEqual(["shown", "hidden", "disabled"]);
    scene.dispose();
  });
});

describe("passesReady", () => {
  it("asks every sub-mesh of every pass, a not-ready one too, and is true once all are", () => {
    const { scene, make } = sceneWithMeshes();
    const meshes = [make("a"), make("b"), make("c")];
    const asked: string[] = [];
    const slow = new Set(["a"]);
    const pass: WarmPass = {
      wants: (m) => m.name !== "c",
      ready: (sm) => {
        const name = sm.getMesh().name;
        asked.push(name);
        return !slow.has(name);
      },
    };
    expect(passesReady(meshes, [pass], true)).toBe(false);
    // Not stopping at the first one: both compiles start in the same frame.
    expect(asked).toEqual(["a", "b"]);
    slow.clear();
    expect(passesReady(meshes, [pass], true)).toBe(true);
    scene.dispose();
  });

  it("asks for the instanced effect where the mesh draws instances", () => {
    const { scene, make } = sceneWithMeshes();
    const single = make("single");
    const many = make("many");
    many.createInstance("many-1");
    const seen: [string, boolean][] = [];
    const pass: WarmPass = { wants: () => true, ready: (sm, inst) => (seen.push([sm.getMesh().name, inst]), true) };
    passesReady([single, many], [pass], true);
    passesReady([many], [pass], false);
    expect(seen).toEqual([
      ["single", false],
      ["many", true],
      ["many", false],
    ]);
    scene.dispose();
  });
});

/**
 * The geometry buffer as the pass sees it (the null engine draws no multi render target): which
 * render pass was current at each ask, and which sub-meshes it was asked for.
 */
const fakeBuffer = (transparent = true) => {
  const asked: { mesh: string; pass: number; instanced: boolean }[] = [];
  let compiled = 0;
  const gbuffer = {
    renderTransparentMeshes: transparent,
    getGBuffer: () => ({ renderPassId: 42 }),
    isReady: (sm: AbstractMesh["subMeshes"][number], instanced: boolean) => {
      asked.push({ mesh: sm.getMesh().name, pass: engine.currentRenderPassId, instanced });
      // Ready from the third ask on: the compile runs between two frames.
      return ++compiled > 2;
    },
  } as unknown as GeometryBufferRenderer;
  return { gbuffer, asked };
};

describe("the line art's geometry buffer", () => {
  it("asks for a disabled mesh and a model file's own meshes under the buffer's pass, then restores the main one", () => {
    const { scene, make } = sceneWithMeshes();
    const { gbuffer, asked } = fakeBuffer();
    const body = make("body-in-fpp");
    body.setEnabled(false);
    const file = make("file-template");
    scene.removeMesh(file);
    const before = engine.currentRenderPassId;
    const ready = scenePassesReady(scene, gbuffer, () => [file]);
    expect(ready()).toBe(false);
    expect(ready()).toBe(true);
    expect(asked.slice(0, 2)).toEqual([
      { mesh: "body-in-fpp", pass: 42, instanced: false },
      { mesh: "file-template", pass: 42, instanced: false },
    ]);
    expect(engine.currentRenderPassId).toBe(before);
    scene.dispose();
  });

  it("leaves out a material without depth write and, when the buffer skips them, the transparent ones", () => {
    const { scene, make } = sceneWithMeshes();
    const glass = make("glass");
    const see = new StandardMaterial("see", scene);
    see.alpha = 0.5;
    glass.material = see;
    const decal = make("decal");
    const flat = new StandardMaterial("flat", scene);
    flat.disableDepthWrite = true;
    decal.material = flat;
    const skipping = fakeBuffer(false);
    const pass = geometryBufferPass(scene, skipping.gbuffer);
    expect(pass.ready(glass.subMeshes[0]!, false)).toBe(true);
    expect(pass.ready(decal.subMeshes[0]!, false)).toBe(true);
    expect(skipping.asked).toEqual([]);
    const drawing = fakeBuffer(true);
    geometryBufferPass(scene, drawing.gbuffer).ready(glass.subMeshes[0]!, false);
    expect(drawing.asked.map((a) => a.mesh)).toEqual(["glass"]);
    scene.dispose();
  });
});

