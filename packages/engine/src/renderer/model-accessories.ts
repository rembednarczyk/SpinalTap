import { Color3, type Mesh, MeshBuilder, MeshClass, type Scene, VertexBuffer } from "../babylon";
import type { AnchorBone } from "./model-rig";
import type { Accessory, Worn } from "./model-variant";

/**
 * Accessories of the model variants (ADR-0076 §3): simple shapes, like the garment add-ons of
 * `garment-addons.ts`, in metres from the head or chest bone in the rig's axes (+Z ahead, +Y up),
 * before the size fit. Every accessory of one bone is merged into one mesh painted by vertex
 * colours, so a character pays one draw call per bone, not per shape.
 */
export const BONE_OF: Readonly<Record<Accessory, AnchorBone>> = {
  glasses: "head",
  cap: "head",
  mask: "head",
  bag: "chest",
  apron: "chest",
};

type Part = (scene: Scene, name: string) => Mesh;

const at = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh => {
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.bakeCurrentTransformIntoVertices();
  return m;
};

const box = (scene: Scene, name: string, width: number, height: number, depth: number): Mesh => MeshBuilder.CreateBox(name, { width, height, depth }, scene);

/** Two lenses on a bridge and the temples back over the ears, at the height of the eyes. */
const glasses: Part = (scene, name) => {
  const parts = [
    at(box(scene, `${name}-l`, 0.042, 0.024, 0.006), -0.032, 0.07, 0.1),
    at(box(scene, `${name}-r`, 0.042, 0.024, 0.006), 0.032, 0.07, 0.1),
    at(box(scene, `${name}-b`, 0.024, 0.006, 0.006), 0, 0.076, 0.1),
    at(box(scene, `${name}-tl`, 0.005, 0.006, 0.1), -0.074, 0.074, 0.05, 0, -0.12),
    at(box(scene, `${name}-tr`, 0.005, 0.006, 0.1), 0.074, 0.074, 0.05, 0, 0.12),
  ];
  return MeshClass.MergeMeshes(parts, true, true)!;
};

/** A crown over the hair and a brim ahead. VRoid hair is bulky, so it sits high and wide. */
const cap: Part = (scene, name) => {
  const crown = MeshBuilder.CreateSphere(`${name}-c`, { diameterX: 0.25, diameterY: 0.2, diameterZ: 0.27, segments: 10, slice: 0.5, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  at(crown, 0, 0.13, -0.01, -0.12);
  const brim = at(box(scene, `${name}-b`, 0.2, 0.012, 0.11), 0, 0.138, 0.15, -0.12);
  return MeshClass.MergeMeshes([crown, brim], true, true)!;
};

/** A band over the mouth and nose: an open arc of a cylinder, centred on +Z. */
const mask: Part = (scene, name) => {
  const sweep = 0.46;
  const m = MeshBuilder.CreateCylinder(name, { diameter: 0.185, height: 0.065, arc: sweep, tessellation: 20, enclose: false, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  return at(m, 0, 0.026, 0.004, 0, -Math.PI / 2 - Math.PI * sweep);
};

/** A small backpack on two straps. */
const bag: Part = (scene, name) => {
  const parts = [
    at(box(scene, `${name}-p`, 0.24, 0.3, 0.11), 0, -0.14, -0.18),
    at(box(scene, `${name}-l`, 0.035, 0.012, 0.22), -0.085, 0.04, -0.06),
    at(box(scene, `${name}-r`, 0.035, 0.012, 0.22), 0.085, 0.04, -0.06),
  ];
  return MeshClass.MergeMeshes(parts, true, true)!;
};

/** A work apron from the chest to mid-thigh, its hem a little ahead of the legs, on a neck strap. */
const apron: Part = (scene, name) => {
  const parts = [
    at(box(scene, `${name}-f`, 0.34, 0.62, 0.012), 0, -0.36, 0.13, -0.1),
    at(box(scene, `${name}-n`, 0.2, 0.012, 0.16), 0, 0.06, 0.05),
  ];
  return MeshClass.MergeMeshes(parts, true, true)!;
};

const PARTS: Readonly<Record<Accessory, Part>> = { glasses, cap, mask, bag, apron };

const paint = (mesh: Mesh, hex: string): Mesh => {
  const c = Color3.FromHexString(hex);
  const n = mesh.getTotalVertices();
  const colours = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
  return mesh;
};

/** The accessories of one bone as one mesh (null for none). */
export const buildAccessories = (scene: Scene, name: string, worn: readonly Worn[], bone: AnchorBone): Mesh | null => {
  const parts = worn.filter((w) => BONE_OF[w.id] === bone).map((w) => paint(PARTS[w.id](scene, `${name}-${w.id}`), w.color));
  if (parts.length === 0) return null;
  const merged = parts.length === 1 ? parts[0]! : MeshClass.MergeMeshes(parts, true, true)!;
  merged.name = `${name}-${bone}`;
  merged.isPickable = false;
  return merged;
};
