import type { GarmentMeshId } from "@seki/core";
import { type Mesh, MeshBuilder, MeshClass, type Scene, type TransformNode } from "../babylon";
import type { PresetName } from "../npr/presets";
import type { CharacterRig } from "./character-rig";
import type { AnchorBone } from "./model-rig";

/**
 * Garment add-ons (ADR-0015 `GarmentMeshId`): a shape, its preset, and where it sits on the
 * procedural rig (`rig`, relative to the head or the body) and on an imported model (`model`,
 * metres from the head or upper chest bone in the rig's axes, before the size fit). VRoid hair
 * is bulky, so the helmet on a model is bigger than on the rig's bald egg.
 */
export interface AddOn {
  readonly preset: PresetName;
  readonly build: (scene: Scene, name: string) => Mesh;
  readonly rig: (rig: CharacterRig) => { parent: TransformNode; at: [number, number, number]; size: number };
  readonly model: { bone: AnchorBone; at: [number, number, number]; size: number };
}

/** A dome: the top of a sphere, open below and seen from inside too, its front edge tilted up off the eyes. */
const dome = (scene: Scene, name: string, w: number, h: number, d: number): Mesh => {
  const m = MeshBuilder.CreateSphere(name, { diameterX: w, diameterY: h * 2, diameterZ: d, segments: 12, slice: 0.56, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  // Baked, so the mesh has no own transform and the rim sits near y = 0.
  m.position.y = -h * 0.12;
  m.rotation.x = -0.28;
  m.bakeCurrentTransformIntoVertices();
  return m;
};

/** A band in front of the eyes: an open arc of a cylinder, centred on +Z. */
const arc = (scene: Scene, name: string, diameter: number, height: number, sweep: number): Mesh => {
  const m = MeshBuilder.CreateCylinder(name, { diameter, height, arc: sweep, tessellation: 24, enclose: false, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  // The arc runs from +X through -Z; turn its middle to the front (+Z).
  m.rotation.y = -Math.PI / 2 - Math.PI * sweep;
  m.bakeCurrentTransformIntoVertices();
  return m;
};

/** A chest plate: a flattened, slightly bent box (front panel and shoulder straps). */
const plate = (scene: Scene, name: string): Mesh => {
  const front = MeshBuilder.CreateBox(`${name}-front`, { width: 0.28, height: 0.26, depth: 0.05 }, scene);
  const strapL = MeshBuilder.CreateBox(`${name}-strapL`, { width: 0.06, height: 0.03, depth: 0.2 }, scene);
  const strapR = MeshBuilder.CreateBox(`${name}-strapR`, { width: 0.06, height: 0.03, depth: 0.2 }, scene);
  strapL.position.set(-0.09, 0.13, -0.105);
  strapR.position.set(0.09, 0.13, -0.105);
  const back = MeshBuilder.CreateBox(`${name}-back`, { width: 0.28, height: 0.24, depth: 0.04 }, scene);
  back.position.set(0, 0, -0.21);
  const merged = MeshClass.MergeMeshes([front, strapL, strapR, back], true, true) ?? front;
  merged.name = name;
  return merged;
};

export const ADD_ONS: Readonly<Record<GarmentMeshId, AddOn>> = {
  visor: {
    preset: "heroineVisor",
    build: (scene, name) => arc(scene, name, 0.19, 0.035, 0.42),
    rig: (r) => ({ parent: r.head, at: [0, 0.015, 0.005], size: 1 }),
    model: { bone: "head", at: [0, 0.075, 0.0], size: 1.12 },
  },
  helmet: {
    preset: "gangerHood",
    build: (scene, name) => dome(scene, name, 0.2, 0.13, 0.23),
    rig: (r) => ({ parent: r.head, at: [0, 0.07, -0.015], size: 1.3 }),
    model: { bone: "head", at: [0, 0.115, -0.015], size: 1.25 },
  },
  "vest-plate": {
    preset: "cyberDark",
    build: plate,
    rig: (r) => ({ parent: r.body, at: [0, r.head.position.y * 0.79, 0.095], size: 0.85 }),
    model: { bone: "chest", at: [0, -0.05, 0.085], size: 0.78 },
  },
};
