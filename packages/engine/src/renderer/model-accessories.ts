import { Color3, type Mesh, MeshBuilder, MeshClass, type Scene, VertexBuffer } from "../babylon";
import type { AnchorBone } from "./model-rig";
import type { Accessory, Worn } from "./model-variant";

/**
 * Accessories of the model variants (ADR-0076 §3): simple shapes, like the garment add-ons of
 * `garment-addons.ts`, in metres from the head or chest bone in the rig's axes (+Z ahead, +Y up),
 * before the size fit. Every accessory of one bone is merged into one mesh painted by vertex
 * colours, so a character pays one draw call per bone, not per shape.
 */
export const BONE_OF: Readonly<Record<Accessory, AnchorBone | "hand" | "waist">> = {
  glasses: "head",
  cap: "head",
  mask: "head",
  bag: "chest",
  apron: "chest",
  shawl: "chest",
  headscarf: "head",
  vest: "chest",
  cane: "hand",
  skirt: "waist",
};

type Part = (scene: Scene, name: string) => Mesh;

const at = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh => {
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.bakeCurrentTransformIntoVertices();
  return m;
};

const box = (scene: Scene, name: string, width: number, height: number, depth: number): Mesh => MeshBuilder.CreateBox(name, { width, height, depth }, scene);

/** A rim round one lens, open in the middle so the eyes show through. */
const rim = (scene: Scene, name: string, x: number): Mesh[] => {
  const [y, z, w, h, t] = [0.068, 0.112, 0.046, 0.028, 0.005];
  return [
    at(box(scene, `${name}-t`, w, t, t), x, y + h / 2, z),
    at(box(scene, `${name}-b`, w, t, t), x, y - h / 2, z),
    at(box(scene, `${name}-i`, t, h, t), x - w / 2, y, z),
    at(box(scene, `${name}-o`, t, h, t), x + w / 2, y, z),
  ];
};

/** Two rims on a bridge and the temples back over the ears, at the height of the eyes, ahead of the face. */
const glasses: Part = (scene, name) => {
  const parts = [
    ...rim(scene, `${name}-l`, -0.033),
    ...rim(scene, `${name}-r`, 0.033),
    at(box(scene, `${name}-b`, 0.02, 0.005, 0.005), 0, 0.074, 0.112),
    at(box(scene, `${name}-tl`, 0.005, 0.005, 0.12), -0.079, 0.074, 0.056, 0, -0.1),
    at(box(scene, `${name}-tr`, 0.005, 0.005, 0.12), 0.079, 0.074, 0.056, 0, 0.1),
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

/**
 * A shawl round the shoulders (ADR-0076 decision 7): a cone from the neck over the shoulders,
 * open at the front, and its two ends hanging down the chest.
 */
const shawl: Part = (scene, name) => {
  const sweep = 0.8;
  const cone = MeshBuilder.CreateCylinder(`${name}-c`, { diameterTop: 0.19, diameterBottom: 0.42, height: 0.2, arc: sweep, tessellation: 24, enclose: false, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  cone.scaling.z = 0.72;
  at(cone, 0, 0.07, -0.01, 0, Math.PI / 2 - Math.PI * sweep);
  const ends = [-0.075, 0.075].map((x, i) => at(box(scene, `${name}-e${i}`, 0.06, 0.24, 0.015), x, -0.06, 0.105, -0.1, 0, x * 0.8));
  return MeshClass.MergeMeshes([cone, ...ends], true, true)!;
};

/**
 * A headscarf: a shell over the crown and the back of the hair, the forehead left free, two
 * flaps down the cheeks framing the face and a tail over the nape.
 */
const headscarf: Part = (scene, name) => {
  const shell = MeshBuilder.CreateSphere(`${name}-s`, { diameterX: 0.27, diameterY: 0.25, diameterZ: 0.29, segments: 12, slice: 0.66, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  at(shell, 0, 0.1, -0.025, -0.55);
  const tail = at(box(scene, `${name}-t`, 0.16, 0.2, 0.02), 0, -0.03, -0.13, 0.2);
  const flaps = [-0.11, 0.11].map((x, i) => at(box(scene, `${name}-f${i}`, 0.025, 0.14, 0.09), x, 0.01, 0.0, 0, 0, -x * 1.2));
  return MeshClass.MergeMeshes([shell, tail, ...flaps], true, true)!;
};

/**
 * A long skirt from the waist to the calves, a bell of `height` metres (the model's height):
 * on the rig's body, not on a bone, so the legs step inside it and the feet show under the hem.
 * Wider than the file's own skirt or trousers at every height, so they stay inside it.
 */
export const buildSkirt = (scene: Scene, name: string, height: number, build: number, colour: string): Mesh => {
  const [waist, hem] = [0.58 * height, 0.15 * height];
  const bell = MeshBuilder.CreateCylinder(name, { diameterTop: 0.19 * height, diameterBottom: 0.3 * height, height: waist - hem, tessellation: 20, cap: MeshClass.NO_CAP, sideOrientation: MeshClass.DOUBLESIDE }, scene);
  bell.scaling.set(build, 1, 0.82 * build);
  at(bell, 0, (waist + hem) / 2, 0);
  const skirt = paint(bell, colour);
  skirt.isPickable = false;
  return skirt;
};

/**
 * The apron and the vest are no shapes on a bone but shells of the model's cloth
 * (`model-apron.ts`); the walking stick is held in the hand (`model-dress.ts`).
 */
const PARTS: Readonly<Partial<Record<Accessory, Part>>> = { glasses, cap, mask, bag, shawl, headscarf };

/** A walking stick of `length` metres, in the rig forearm's axes: from the palm down along -Y, the crook ahead. */
export const buildCane = (scene: Scene, name: string, length: number, colour: string): Mesh => {
  const shaft = at(MeshBuilder.CreateCylinder(`${name}-s`, { diameter: 0.022, height: length, tessellation: 8 }, scene), 0, -length / 2 + 0.05, 0);
  const crook = at(MeshBuilder.CreateCylinder(`${name}-c`, { diameter: 0.022, height: 0.1, tessellation: 8 }, scene), 0, 0.05, 0.04, Math.PI / 2);
  const cane = paint(MeshClass.MergeMeshes([shaft, crook], true, true)!, colour);
  cane.name = name;
  cane.isPickable = false;
  return cane;
};

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
  const parts = worn.flatMap((w) => {
    const part = BONE_OF[w.id] === bone ? PARTS[w.id] : undefined;
    return part ? [paint(part(scene, `${name}-${w.id}`), w.color)] : [];
  });
  if (parts.length === 0) return null;
  const merged = parts.length === 1 ? parts[0]! : MeshClass.MergeMeshes(parts, true, true)!;
  merged.name = `${name}-${bone}`;
  merged.isPickable = false;
  return merged;
};
