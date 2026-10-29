import { Bone, Color3, Matrix, type Mesh, MeshClass, Quaternion, Skeleton, TransformNode, VertexBuffer } from "../babylon";
import { applyOutline } from "../npr/outline";
import { PRESETS, type PresetName } from "../npr/presets";
import { presetHasOutline } from "../npr/toon-material";
import type { RigBuilder } from "./rig-builder";

const EMISSIVE: ReadonlySet<PresetName> = new Set<PresetName>(["heroineVisor", "gangerMask", "docGoggles", "corpoVisor"]);

/** Parts that merge into one mesh: an emissive preset of its own, or the outlined or flat rest. */
interface LookGroup {
  readonly meshes: Mesh[];
  readonly preset: PresetName | null;
  readonly outline: boolean;
}

/** One bone per joint, linked to its pivot node so the procedural animation keeps driving it. */
const buildSkeleton = (b: RigBuilder, joints: TransformNode[]): { skeleton: Skeleton; boneOf: Map<TransformNode, Bone> } => {
  const skeleton = new Skeleton(`${b.name}-skeleton`, `${b.name}-skeleton`, b.scene);
  const boneOf = new Map<TransformNode, Bone>();
  const local = (n: TransformNode) =>
    Matrix.Compose(n.scaling, n.rotationQuaternion ?? Quaternion.FromEulerAngles(n.rotation.x, n.rotation.y, n.rotation.z), n.position);
  // Parents before children: joints are listed in creation order, which already guarantees that.
  for (const node of joints) {
    const parentBone = node.parent instanceof TransformNode ? (boneOf.get(node.parent) ?? null) : null;
    const bone = new Bone(node.name, skeleton, parentBone, local(node));
    bone.linkTransformNode(node);
    boneOf.set(node, bone);
  }
  return { skeleton, boneOf };
};

/** Bakes a part into root space (the bind pose), its preset colour into vertex colours, and tags every vertex with its joint. */
const bakePart = (m: Mesh, rootInverse: Matrix, preset: PresetName, boneIndex: number): void => {
  m.computeWorldMatrix(true);
  m.bakeTransformIntoVertices(m.getWorldMatrix().multiply(rootInverse));
  m.parent = null;
  m.position.setAll(0);
  m.rotation.setAll(0);
  m.rotationQuaternion = null;
  m.scaling.setAll(1);
  const count = m.getTotalVertices();
  const color = Color3.FromHexString(PRESETS[preset].base);
  const colors = new Float32Array(count * 4);
  const indices = new Float32Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    colors.set([color.r, color.g, color.b, 1], i * 4);
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  m.setVerticesData(VertexBuffer.ColorKind, colors);
  m.setVerticesData(VertexBuffer.MatricesIndicesKind, indices);
  m.setVerticesData(VertexBuffer.MatricesWeightsKind, weights);
};

/** Vertices of a merged character mesh that came from one part, with the part's preset. */
export interface SkinPart {
  readonly preset: PresetName;
  readonly start: number;
  readonly count: number;
}

const PARTS = new WeakMap<Mesh, readonly SkinPart[]>();
/** Last colours a mesh was painted with, so an unchanged look writes nothing. */
const PAINTED = new WeakMap<Mesh, string>();

/** The parts of a merged character mesh in vertex order (empty for any other mesh). */
export const skinParts = (mesh: Mesh): readonly SkinPart[] => PARTS.get(mesh) ?? [];

/**
 * Repaints the vertex colours of a merged character mesh part by part (ADR-0036): `colorOf`
 * gives a part's new colour, or null for its preset's own. Returns whether anything changed.
 */
export const recolorSkin = (mesh: Mesh, colorOf: (preset: PresetName) => string | null): boolean => {
  const parts = PARTS.get(mesh);
  if (!parts) return false;
  const hexes = parts.map((p) => colorOf(p.preset) ?? PRESETS[p.preset].base);
  const key = hexes.join();
  const current = PAINTED.get(mesh) ?? parts.map((p) => PRESETS[p.preset].base).join();
  if (key === current) return false;
  const data = mesh.getVerticesData(VertexBuffer.ColorKind);
  if (!data) return false;
  const colors = Float32Array.from(data);
  parts.forEach((p, i) => {
    const c = Color3.FromHexString(hexes[i]!);
    for (let v = p.start; v < p.start + p.count; v++) colors.set([c.r, c.g, c.b, 1], v * 4);
  });
  mesh.setVerticesData(VertexBuffer.ColorKind, colors, true);
  PAINTED.set(mesh, key);
  return true;
};

/** One merged, skinned mesh per look group. */
const mergeGroups = (b: RigBuilder, root: TransformNode, skeleton: Skeleton, groups: Map<string, LookGroup>): Mesh[] => {
  const out: Mesh[] = [];
  for (const [key, g] of groups) {
    const parts: SkinPart[] = [];
    let start = 0;
    for (const m of g.meshes) {
      const count = m.getTotalVertices();
      parts.push({ preset: b.presets.get(m) ?? "charVertexColor", start, count });
      start += count;
    }
    const merged = MeshClass.MergeMeshes(g.meshes, true, true);
    if (!merged) continue;
    PARTS.set(merged, parts);
    merged.name = `${b.name}-${key}`;
    merged.parent = root;
    merged.skeleton = skeleton;
    merged.numBoneInfluencers = 1;
    merged.isPickable = false;
    merged.material = b.materials.get(g.preset ?? (g.outline ? "charVertexColor" : "charVertexColorFlat"));
    if (g.outline) applyOutline(merged);
    out.push(merged);
  }
  return out;
};

/**
 * Turns the loose parts into one skinned mesh per look group: every joint becomes a bone
 * linked to its pivot node (so the procedural animation keeps driving it), and each part's
 * preset colour is baked into vertex colours. A character costs 1-3 draw calls per pass
 * instead of one per part, in every pass (colour, shadow, G-buffer, outline).
 */
export const skinCharacter = (b: RigBuilder, root: TransformNode, joints: TransformNode[]): Mesh[] => {
  const { skeleton, boneOf } = buildSkeleton(b, joints);
  root.computeWorldMatrix(true);
  const rootInverse = Matrix.Invert(root.getWorldMatrix());

  const groups = new Map<string, LookGroup>();
  for (const m of b.meshes) {
    const preset = b.presets.get(m) ?? "charVertexColor";
    const parent = m.parent instanceof TransformNode ? m.parent : null;
    const bone = parent ? boneOf.get(parent) : undefined;
    if (!bone) continue;
    bakePart(m, rootInverse, preset, skeleton.bones.indexOf(bone));
    const emissive = EMISSIVE.has(preset);
    const outline = !emissive && presetHasOutline(preset);
    const key = emissive ? `e:${preset}` : outline ? "outlined" : "flat";
    const g = groups.get(key) ?? { meshes: [], preset: emissive ? preset : null, outline };
    g.meshes.push(m);
    groups.set(key, g);
  }
  return mergeGroups(b, root, skeleton, groups);
};
