import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform, WeaponLook } from "@seki/core";
import { eyeHeightAt } from "@seki/sim";
import { describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Matrix, MeshBuilder, Ray, Scene, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";
import { ModelLibrary } from "../src/renderer/model-library";
import { ViewWeapon } from "../src/renderer/view-weapon";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { allWeaponUrls } from "./weapon-files";

/** Half angle of the circle round the crosshair that the FPP weapon must leave free (degrees). */
const SIGHT_CIRCLE = 3;

/** The FPP rig with the weapon in hand, its model in the viewmodel as the game mounts it, or the box pistol. */
const fppRig = async (look: WeaponLook, model: boolean) => {
  const scene = new Scene(new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 }));
  const materials = new ToonMaterials(scene);
  const rig = new CameraRig(scene, materials, () => false);
  rig.setHeldWeapon(look);
  if (model) {
    const view = new ViewWeapon(new WeaponMounts(new ModelLibrary(scene, materials), allWeaponUrls()), rig);
    view.show(look);
    await vi.waitFor(() => expect(scene.getMeshByName("vm-gun")?.isEnabled()).toBe(false));
  }
  return { scene, rig };
};

const isViewmodel = (rig: CameraRig) => (m: AbstractMesh): boolean => {
  for (let n = m.parent; n; n = n.parent) if (n === rig.camera) return m.isEnabled() && m.isVisible;
  return false;
};

/**
 * Share of the target inside the circle round the crosshair that the viewmodel hides: rays from
 * the eye over the circle, each one that reaches the target counted as hidden when the weapon or
 * the hand is nearer on it.
 */
const hiddenShare = (scene: Scene, rig: CameraRig, target: AbstractMesh): number => {
  scene.meshes.forEach((m) => m.computeWorldMatrix(true));
  const cam = rig.camera;
  const rot = Matrix.RotationYawPitchRoll(cam.rotation.y, cam.rotation.x, cam.rotation.z);
  const vm = isViewmodel(rig);
  let seen = 0;
  let hidden = 0;
  const r = Math.tan((SIGHT_CIRCLE * Math.PI) / 180);
  for (let i = -12; i <= 12; i++) {
    for (let j = -12; j <= 12; j++) {
      const x = (i / 12) * r;
      const y = (j / 12) * r;
      if (x * x + y * y > r * r) continue;
      const dir = Vector3.TransformNormal(new Vector3(x, y, 1).normalize(), rot);
      const ray = new Ray(cam.position.clone(), dir, 10);
      const onTarget = scene.pickWithRay(ray, (m) => m === target);
      if (!onTarget?.hit) continue;
      seen++;
      const onWeapon = scene.pickWithRay(ray, vm);
      if (onWeapon?.hit && onWeapon.distance < onTarget.distance) hidden++;
    }
  }
  // The crosshair is on the target in every case.
  expect(seen).toBeGreaterThan(300);
  return hidden / seen;
};

const CASES = [0.5, 1, 1.5].flatMap((d) =>
  [false, true].flatMap((crouched) => [0, 1].flatMap((aim) => [false, true].map((fired) => ({ d, crouched, aim, fired })))),
);

const GUNS = ["pistol", "revolver", "smg", "shotgun", "rifle"] as const;

/** The largest share of the circle the viewmodel hides over every case, with the case rows. */
const worstHidden = async (look: WeaponLook, model: boolean): Promise<{ worst: number; rows: string[] }> => {
  const { scene, rig } = await fppRig(look, model);
  const rows: string[] = [];
  let worst = 0;
  for (const { d, crouched, aim, fired } of CASES) {
    const h = crouched ? 1.2 : 1.75;
    const target = MeshBuilder.CreateCapsule("target", { height: h, radius: 0.25 }, scene);
    target.position.set(0, h / 2, d + 0.25);
    const eye = eyeHeightAt(1);
    const chest = h * 0.72;
    const t: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: -Math.atan2(chest - eye, d), speed: 0, crouch: 1, aim, aimZoom: 0.8 };
    for (let k = 0; k < 60; k++) rig.update(t, 1 / 30);
    // The frame after a shot, with the recoil at its height.
    if (fired) {
      rig.kick();
      rig.update(t, 1 / 60);
    }
    const share = hiddenShare(scene, rig, target);
    rows.push(`d=${d} crouched=${crouched} aim=${aim} fired=${fired}: ${(share * 100).toFixed(1)}%`);
    worst = Math.max(worst, share);
    target.dispose();
  }
  return { worst, rows };
};

describe("FPP weapon leaves the crosshair free (G-275, every gun G-282)", () => {
  it.each(GUNS.flatMap((look) => [[look, "its model", true] as const, [look, "the box placeholder", false] as const]))(
    "%s, %s: crouched, a standing or crouched target 0.5-1.5 m ahead, from the hip, aimed and just fired",
    async (look, _, model) => {
      const { worst, rows } = await worstHidden(look, model);
      // Before G-275, aimed in: the pistol model hid 66% of the circle and 85% the frame after a
      // shot. Before G-282, the SMG, shotgun and rifle models aimed in the pistol's pose hid 100%.
      expect(worst, rows.join("\n")).toBe(0);
    },
  );
});
