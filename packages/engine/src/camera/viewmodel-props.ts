import { type AbstractMesh, MeshBuilder, type Scene, type TransformNode } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";

/** The procedural stand-ins of the FPP viewmodel: Seki's forearm and the box pistol. */
export interface ViewmodelProps {
  /** Sleeve, wrist ring and hand: they give way to the arms of her model once it has loaded (`ViewArms`). */
  readonly arm: readonly AbstractMesh[];
  /** The box pistol under the gun holder, until the weapon's model is mounted (G-282). */
  readonly gun: AbstractMesh;
}

/**
 * Builds the stand-ins, kept compact and at least ~25 cm from the eye so perspective does not blow
 * them up: Seki's cybernetic forearm (ivory shell, copper wrist ring, ivory hand) under the
 * viewmodel and the box pistol under the gun holder.
 */
export const buildViewmodelProps = (scene: Scene, materials: ToonMaterials, viewmodel: TransformNode, gunHolder: TransformNode): ViewmodelProps => {
  const sleeve = MeshBuilder.CreateCylinder("vm-sleeve", { height: 0.2, diameterTop: 0.052, diameterBottom: 0.066, tessellation: 12 }, scene);
  sleeve.material = materials.get("cyberIvory");
  sleeve.parent = viewmodel;
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, -0.02, -0.11);
  const wrist = MeshBuilder.CreateTorus("vm-wrist", { diameter: 0.054, thickness: 0.012, tessellation: 16 }, scene);
  wrist.material = materials.get("cyberCopper");
  wrist.parent = viewmodel;
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, -0.015, -0.01);
  const hand = MeshBuilder.CreateSphere("vm-hand", { diameter: 0.06, segments: 10 }, scene);
  hand.material = materials.get("cyberIvory");
  hand.parent = viewmodel;
  hand.scaling.set(0.85, 1, 1.15);
  hand.position.set(0, 0, 0.02);
  const gun = MeshBuilder.CreateBox("vm-gun", { width: 0.035, height: 0.065, depth: 0.19 }, scene);
  gun.material = materials.get("gun");
  gun.parent = gunHolder;
  gun.position.set(0, 0.04, 0.07);
  for (const m of [sleeve, wrist, hand, gun]) {
    m.isPickable = false;
    applyOutline(m, 0.004);
  }
  return { arm: [sleeve, wrist, hand], gun };
};
