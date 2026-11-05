import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary } from "../src/renderer/model-library";
import { GRIP, type WeaponKind, WeaponMounts } from "../src/renderer/weapon-mount";
import { triangleGltf } from "./model-loader.test";
import { allWeaponUrls } from "./weapon-files";

/** Length of each weapon file (public/weapons/README.md). */
const LENGTH: Readonly<Record<WeaponKind, number>> = { pistol: 0.22, revolver: 0.27, smg: 0.42, shotgun: 0.75, rifle: 0.8 };

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

  it.each(["pistol", "revolver", "smg", "shotgun", "rifle"] as const)(
    "%s: its own file, held at the grip with the muzzle away from the hand (G-282)",
    async (kind) => {
      const scene = new Scene(new NullEngine());
      const mounts = new WeaponMounts(new ModelLibrary(scene, new ToonMaterials(scene)), allWeaponUrls());
      for (const space of ["hand", "view"] as const) {
        const holder = new TransformNode(space, scene);
        const pivot = (await mounts.mount(holder, kind, `${kind}-${space}`, space))!;
        const mesh = pivot.getChildMeshes(false).find((m) => m.getTotalVertices() > 0)!;
        // The mesh's own vertices are the file's: muzzle at +X, top up.
        const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
        const world = mesh.computeWorldMatrix(true);
        const inHolder = (x: number, y: number) => Vector3.TransformCoordinates(new Vector3(x, y, 0), world);
        const forward = space === "hand" ? (v: Vector3) => -v.y : (v: Vector3) => v.z;
        const grip = inHolder(GRIP[kind].x, GRIP[kind].y);
        const muzzle = inHolder(maximum.x, 0);
        const back = inHolder(minimum.x, 0);
        // The grip is on the holding point (the ball hand of the viewmodel sits 2 cm off it).
        expect(grip.length(), `${space} grip`).toBeLessThan(space === "hand" ? 1e-6 : 0.02);
        // Before: the glTF root mirrors X, so every gun pointed its muzzle back at the elbow.
        expect(forward(muzzle), `${space} muzzle`).toBeGreaterThan(0.08);
        expect(forward(back), `${space} butt`).toBeLessThan(0);
        expect(maximum.x - minimum.x).toBeCloseTo(LENGTH[kind], 3);
      }
    },
  );

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
