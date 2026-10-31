import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary } from "../src/renderer/model-library";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { triangleGltf } from "./model-loader.test";

describe("WeaponMounts", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const mounts = new WeaponMounts(new ModelLibrary(scene, new ToonMaterials(scene)), { pistol: triangleGltf() });
    return { scene, mounts };
  };
  /** Where the pivot sends the model's +X (barrel) and +Y (top) axes, in the holder's frame. */
  const axes = (pivot: TransformNode) => {
    const q = pivot.rotationQuaternion!;
    return { barrel: new Vector3(1, 0, 0).applyRotationQuaternion(q), top: new Vector3(0, 1, 0).applyRotationQuaternion(q) };
  };

  it("lays the barrel along the forearm in a hand and forward in the viewmodel", async () => {
    const { scene, mounts } = setup();
    const hand = (await mounts.mount(new TransformNode("hand", scene), "pistol", "h", "hand"))!;
    const view = (await mounts.mount(new TransformNode("vm", scene), "pistol", "v", "view"))!;
    const h = axes(hand);
    expect(h.barrel.y).toBeCloseTo(-1);
    expect(h.top.z).toBeCloseTo(1);
    const v = axes(view);
    expect(v.barrel.z).toBeCloseTo(1);
    expect(v.top.y).toBeCloseTo(1);
  });

  it("mounts nothing without a model for the kind or once the holder is gone", async () => {
    const { scene, mounts } = setup();
    expect(await mounts.mount(new TransformNode("x", scene), "smg", "s", "hand")).toBeNull();
    const gone = new TransformNode("gone", scene);
    const pending = mounts.mount(gone, "pistol", "g", "hand");
    gone.dispose();
    expect(await pending).toBeNull();
  });

  it("preloads each weapon file once for the loading screen, and a later mount reuses it (ADR-0057)", async () => {
    const scene = new Scene(new NullEngine());
    const library = new ModelLibrary(scene, new ToonMaterials(scene));
    const broken = "data:model/gltf+json;base64,bm90IGpzb24=";
    const mounts = new WeaponMounts(library, { pistol: triangleGltf(), smg: broken });
    const files = mounts.preload();
    expect(files).toHaveLength(2);
    const settled = await Promise.allSettled(files);
    expect(settled.map((s) => s.status)).toEqual(["fulfilled", "rejected"]);
    const before = scene.meshes.length;
    expect(await mounts.mount(new TransformNode("hand", scene), "pistol", "h", "hand")).not.toBeNull();
    expect(scene.meshes.length).toBeGreaterThan(before);
    expect(new WeaponMounts(library).preload()).toEqual([]);
  });
});
