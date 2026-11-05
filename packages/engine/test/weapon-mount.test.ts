import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary } from "../src/renderer/model-library";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { triangleGltf } from "./model-loader.test";
import { weaponUrl } from "./weapon-files";

describe("WeaponMounts", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const mounts = new WeaponMounts(new ModelLibrary(scene, new ToonMaterials(scene)), { pistol: triangleGltf() });
    return { scene, mounts };
  };
  /** Where the pivot sends the barrel (-X under the glTF root, which mirrors the file's +X) and the top (+Y), in the holder's frame. */
  const axes = (pivot: TransformNode) => {
    const q = pivot.rotationQuaternion!;
    return { barrel: new Vector3(-1, 0, 0).applyRotationQuaternion(q), top: new Vector3(0, 1, 0).applyRotationQuaternion(q) };
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

  it.each(["pistol", "smg"] as const)("%s: the muzzle of the file points away from the hand, in the hand and in the view", async (kind) => {
    const scene = new Scene(new NullEngine());
    const mounts = new WeaponMounts(new ModelLibrary(scene, new ToonMaterials(scene)), { [kind]: weaponUrl(kind) });
    for (const space of ["hand", "view"] as const) {
      const pivot = (await mounts.mount(new TransformNode(space, scene), kind, `${kind}-${space}`, space))!;
      const mesh = pivot.getChildMeshes(false).find((m) => m.getTotalVertices() > 0)!;
      // The mesh's own vertices are the file's: muzzle at +X.
      const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
      const world = mesh.computeWorldMatrix(true);
      const forward = (x: number) => {
        const v = Vector3.TransformCoordinates(new Vector3(x, 0, 0), world);
        return space === "hand" ? -v.y : v.z;
      };
      // Before: the glTF root mirrors X, so the muzzle pointed back at the elbow and the eye.
      expect(forward(maximum.x), space).toBeGreaterThan(forward(minimum.x));
    }
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
