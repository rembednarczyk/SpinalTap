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
import { allWeaponUrls, weaponUrl } from "./weapon-files";

const armed = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: active, secondary: "pistol", melee: "baton", active: "primary" },
  garments: {},
  implants: [],
});

/** Length of the model each gun shows in the viewmodel, as in the hands in TPP: each gun its own file (public/weapons/README.md). */
const LENGTH: Readonly<Record<string, number>> = { pistol: 0.22, revolver: 0.27, smg: 0.42, shotgun: 0.75, rifle: 0.8 };

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
    kit.setWeaponModels(allWeaponUrls());
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
  /** Name of the mount pivot a mesh hangs under. */
  const pivotOf = (m: AbstractMesh): string | undefined => {
    for (let n = m.parent; n; n = n.parent) if (n.name.endsWith("-pivot")) return n.name;
    return undefined;
  };
  const placeholder = (camera: CameraRig): boolean => shown(camera).some((m) => m.name === "vm-gun");

  it.each(["rifle", "smg", "shotgun", "revolver", "pistol"] as const)("%s: the viewmodel shows its model, sized as in TPP", async (look) => {
    const { camera, kit, player, rig } = setup();
    kit.arm(player, rig, "hero", armed(look));
    await vi.waitFor(() => {
      expect(placeholder(camera)).toBe(false);
      expect(length(camera)).toBeCloseTo(LENGTH[look]!, 2);
    });
    // Its own file, not another gun's model resized (G-282).
    expect(new Set(shown(camera).map(pivotOf))).toEqual(new Set([`vm-${look}-pivot`]));
  });

  it("switches the model with the weapon, one model shown at a time", async () => {
    const { camera, kit, player, rig } = setup();
    for (const look of ["pistol", "rifle", "smg", "pistol", "shotgun"] as const) {
      kit.arm(player, rig, "hero", armed(look));
      await vi.waitFor(() => expect(length(camera)).toBeCloseTo(LENGTH[look]!, 2));
      expect(placeholder(camera)).toBe(false);
    }
    // Shown meshes all hang under one model's pivot.
    const pivots = new Set(shown(camera).map(pivotOf));
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

  it.each(["baton", "blade"] as const)("%s: the viewmodel swings its model, not the stand-in box, and the gun comes back on a switch", async (melee) => {
    const { camera, kit, player, rig } = setup();
    const inHand = (look: "baton" | "blade" | null): AppearanceDescriptor => ({
      weapons: { primary: "rifle", secondary: "pistol", melee, active: look ? "melee" : "secondary" },
      garments: {},
      implants: [],
    });
    const meleeShown = () => camera.meleeMount.getChildMeshes(false).filter((m) => m.isEnabled() && m.getTotalVertices() > 0);
    kit.arm(player, rig, "hero", inHand(melee));
    // Before: the melee holder showed a plain box; now the weapon's model hangs under it.
    await vi.waitFor(() => expect(new Set(meleeShown().map(pivotOf))).toEqual(new Set([`vm-${melee}-pivot`])));
    expect(meleeShown().some((m) => m.name === `vm-${melee}`)).toBe(false);
    expect(camera.weaponMount.isEnabled()).toBe(false);
    kit.arm(player, rig, "hero", inHand(null));
    await vi.waitFor(() => expect(length(camera)).toBeCloseTo(LENGTH.pistol!, 2));
    expect(placeholder(camera)).toBe(false);
    expect(camera.meleeMount.isEnabled()).toBe(false);
  });
});
