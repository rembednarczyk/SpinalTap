// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });

/** Everything a character leaves in the scene. */
const resources = (scene: Scene) => ({
  skeletons: scene.skeletons.length,
  meshes: scene.meshes.length,
  transformNodes: scene.transformNodes.length,
  materials: scene.materials.length,
  textures: scene.textures.length,
  geometries: scene.geometries.length,
  animationGroups: scene.animationGroups.length,
  morphTargetManagers: scene.morphTargetManagers.length,
});

/** The game's own VRM files, served from disk. */
const serveModels = () =>
  vi.stubGlobal("fetch", (url: string) => {
    const b = (readFileSync as (u: URL) => Uint8Array)(new URL(`../../app/public/models/${url}`, import.meta.url));
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 2000 && views.loadingCount > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
  expect(views.loadingCount).toBe(0);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("characters leave nothing behind (G-184)", () => {
  it("returns a streamed-out character's skeleton with its rig", () => {
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    const passBy = (id: number) => {
      views.spawn(id, { kind: "npc", preset: "fixer" }, STAND);
      views.despawn(id, false);
    };
    // The first one makes the shared toon materials.
    passBy(10);
    const before = resources(scene);
    for (let i = 1; i < 4; i++) passBy(10 + i);
    expect(resources(scene)).toEqual(before);
  });

  it("keeps every scene resource flat over new game / clear cycles with dressed models", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels({ heroine: { url: "seki.vrm", scale: 1.15 }, civilian: { url: "civilian.vrm", scale: 0.97 } });
    const cycles: ReturnType<typeof resources>[] = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      views.spawn(1, { kind: "heroine" }, STAND);
      views.spawn(2, { kind: "npc", preset: "civilian" }, STAND);
      views.spawn(3, { kind: "npc", preset: "civilian" }, STAND);
      views.spawn(4, { kind: "enemy", preset: "ganger" }, STAND);
      await settled(views);
      expect(views.dressedCount).toBe(3);
      for (let i = 0; i < 5; i++) views.update(1 / 60);
      // One falls before the scene is cleared: the death fall goes too.
      views.despawn(4, true);
      views.update(1 / 60);
      views.clear();
      cycles.push(resources(scene));
    }
    // The first cycle fills the model pool; the next ones reuse it and add nothing.
    expect(cycles[1]).toEqual(cycles[0]);
    expect(cycles[2]).toEqual(cycles[0]);
  }, 60_000);
});
