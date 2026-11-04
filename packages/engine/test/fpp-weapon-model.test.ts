import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, WeaponLook } from "@seki/core";
import { describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterKit } from "../src/renderer/character-kit";
import { buildHeroine } from "../src/renderer/characters";
import { ModelLibrary } from "../src/renderer/model-library";
import { weaponUrl } from "./weapon-files";

const armed = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: active, secondary: "pistol", melee: "baton", active: "primary" },
  garments: {},
  implants: [],
});

/** Length of the model each gun shows in the viewmodel, as in the hands in TPP: the file's length times the look's size. */
const LENGTH: Readonly<Record<string, number>> = { pistol: 0.22, revolver: 0.22 * 1.08, smg: 0.42, shotgun: 0.42 * 1.35, rifle: 0.42 * 1.5 };

describe("FPP viewmodel carries the weapon in hand (G-282)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const camera = new CameraRig(scene, materials, () => false);
    const player = 1;
    const kit = new CharacterKit({
      scene,
      materials,
      shadow: { addCaster: () => {} } as unknown as MoonShadow,
      camera,
      cameraTarget: () => player,
      library: new ModelLibrary(scene, materials),
    });
    kit.setWeaponModels({ pistol: weaponUrl("pistol"), smg: weaponUrl("smg") });
    return { camera, kit, player, rig: buildHeroine(scene, materials, "hero") };
  };
  /** Shown meshes with geometry under the viewmodel's gun holder. */
  const shown = (camera: CameraRig): AbstractMesh[] =>
    camera.weaponMount.getChildMeshes(false).filter((m) => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0);
  /** Length along the view of what the gun holder shows (metres). */
  const length = (camera: CameraRig): number => {
    let min = Infinity;
    let max = -Infinity;
    const inv = camera.weaponMount.computeWorldMatrix(true).clone().invert();
    for (const m of shown(camera)) {
      m.computeWorldMatrix(true);
      for (const c of m.getBoundingInfo().boundingBox.vectorsWorld) {
        const z = Vector3.TransformCoordinates(c, inv).z;
        min = Math.min(min, z);
        max = Math.max(max, z);
      }
    }
    return max - min;
  };
  const placeholder = (camera: CameraRig): boolean => shown(camera).some((m) => m.name === "vm-gun");

  it.each(["rifle", "smg", "shotgun", "revolver", "pistol"] as const)("%s: the viewmodel shows its model, sized as in TPP", async (look) => {
    const { camera, kit, player, rig } = setup();
    kit.arm(player, rig, "hero", armed(look));
    await vi.waitFor(() => {
      expect(placeholder(camera)).toBe(false);
      expect(length(camera)).toBeCloseTo(LENGTH[look]!, 2);
    });
  });

  it("switches the model with the weapon, one model shown at a time", async () => {
    const { camera, kit, player, rig } = setup();
    for (const look of ["pistol", "rifle", "smg", "pistol", "shotgun"] as const) {
      kit.arm(player, rig, "hero", armed(look));
      await vi.waitFor(() => expect(length(camera)).toBeCloseTo(LENGTH[look]!, 2));
      expect(placeholder(camera)).toBe(false);
    }
    // Shown meshes all hang under one model's pivot.
    const pivots = new Set(shown(camera).map((m) => m.parent?.parent?.name));
    expect(pivots.size).toBe(1);
  });

  it("keeps the box pistol for a gun without a model file, and drops it once the gun in hand has one", async () => {
    const { camera, kit, player, rig } = setup();
    kit.setWeaponModels({ pistol: weaponUrl("pistol") });
    kit.arm(player, rig, "hero", armed("rifle"));
    await new Promise((r) => setTimeout(r, 50));
    expect(placeholder(camera)).toBe(true);
    expect(shown(camera)).toHaveLength(1);
    kit.arm(player, rig, "hero", armed("pistol"));
    await vi.waitFor(() => expect(length(camera)).toBeCloseTo(LENGTH.pistol!, 2));
    expect(placeholder(camera)).toBe(false);
  });
});
