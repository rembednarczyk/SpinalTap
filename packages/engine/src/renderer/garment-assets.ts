import type { GarmentMeshId } from "@seki/core";
import { type AbstractMesh, LoadAssetContainerAsync, Matrix, type Mesh, MeshClass, type Scene, type Skeleton, type Texture, VertexBuffer, loadGltfPlugin } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { clothRemainder, uncoveredTriangles } from "./garment-cover";
import { type BodySurface, type FittedGarment, type GarmentGeometry, type TargetSkeleton, fitGarment } from "./garment-fit";
import { type SourceMaterial, readSourceMaterial, toonSourceOf } from "./model-library";
import { fetchModelBytes } from "./model-fetch";

/**
 * Garments as assets of their own on VRoid characters (ADR-0086, way A): a skinned mesh cut out of
 * a VRoid file by `tools/garments` (`public/garments/<id>.glb`, bones `J_Bip_*`), put on an imported
 * model's skeleton by bone names and fitted to its body (`garment-fit.ts`), with the cloth it covers
 * not drawn (`garment-cover.ts`). The procedural rig wears none of these: it keeps its tints (ADR-0036).
 */

export interface GarmentAssetSpec {
  /** The file, relative to the page like `models/manifest.json`. */
  readonly url: string;
  /**
   * VRoid cloth whose triangles under the garment are not drawn while it is worn: "torso" is the
   * top (a separate "Tops" or a one-piece dress), "tie" what is worn over it, "skin" the body's
   * skin of the arms and the torso (`HIDEABLE_SKIN`).
   */
  readonly covers: readonly ("torso" | "tie" | "skin")[];
}

export const GARMENT_ASSETS = {
  // "Kimi || Desktop Mate Model" by Toriss (VRoid Hub), the techwear jacket, cut at the hips (no coats, user 20.11).
  "jacket-techwear": { url: "./garments/jacket-techwear.glb", covers: ["torso", "tie", "skin"] },
} as const satisfies Partial<Record<GarmentMeshId, GarmentAssetSpec>>;

export type SkinnedGarmentId = keyof typeof GARMENT_ASSETS;

export const isSkinnedGarment = (id: GarmentMeshId): id is SkinnedGarmentId => id in GARMENT_ASSETS;

/** A garment file, read once: its geometry and its texture. */
export interface GarmentTemplate {
  readonly geometry: GarmentGeometry;
  readonly texture: Texture | null;
  readonly source: SourceMaterial;
}

/** A garment on one character, with the cloth it covers: hidden, and drawn instead by its uncovered rest. */
export interface WornGarment {
  readonly id: SkinnedGarmentId;
  readonly mesh: Mesh;
  readonly hidden: readonly AbstractMesh[];
  /** The uncovered triangles of each hidden cloth, `rest[i]` for `hidden[i]` (none when it is covered whole). */
  readonly rest: readonly (Mesh | null)[];
}

/** A fit to one cast file: the garment's geometry and, per covered cloth (its index buffer), the triangles left. */
interface Fit {
  readonly garment: FittedGarment;
  readonly uncovered: WeakMap<object, number[]>;
}

/** Depth bias of the garment's material over the body (ADR-0086, second layer against clipping). */
const GARMENT_LAYER = 2;

const translationOf = (inverseBind: Matrix): [number, number, number] => {
  const t = Matrix.Invert(inverseBind).getTranslation();
  return [t.x, t.y, t.z];
};

/** The garment file's geometry, read off the mesh the glTF loader made. */
const readTemplate = (mesh: Mesh, skeleton: Skeleton): GarmentGeometry => {
  const read = (kind: string) => Float32Array.from(mesh.getVerticesData(kind) ?? []);
  const bones = skeleton.bones;
  return {
    positions: read(VertexBuffer.PositionKind),
    normals: read(VertexBuffer.NormalKind),
    uvs: read(VertexBuffer.UVKind),
    indices: Uint32Array.from(mesh.getIndices() ?? []),
    joints: read(VertexBuffer.MatricesIndicesKind),
    weights: read(VertexBuffer.MatricesWeightsKind),
    bones: bones.map((b) => b.name),
    bind: bones.map((b) => translationOf(b.getAbsoluteInverseBindMatrix())),
    parents: bones.map((b) => {
      const p = b.getParent();
      return p ? bones.indexOf(p) : -1;
    }),
  };
};

/** The cast file's skeleton as the fit reads it: bone names without the instance's prefix. */
export const targetSkeletonOf = (skeleton: Skeleton, prefix = ""): TargetSkeleton => ({
  names: skeleton.bones.map((b) => (prefix && b.name.startsWith(prefix) ? b.name.slice(prefix.length) : b.name)),
  bind: skeleton.bones.map((b) => translationOf(b.getAbsoluteInverseBindMatrix())),
});

/** What a mesh is to a garment over it: a top ("Tops" or a one-piece dress), what is worn over a top, the body's skin, or neither. */
const coverKindOf = (m: AbstractMesh): "torso" | "tie" | "skin" | null => {
  const part = toonSourceOf(m)?.source.part;
  return part === "torso" || part === "tie" ? part : part === "skin" && /body/i.test(m.name) ? "skin" : null;
};

/**
 * The skin a garment may hide, by the bone it follows most: the arms and the torso. Not the legs
 * (under a long coat's skirt they show as it swings), the hands, the neck or the hips.
 */
const HIDEABLE_SKIN = /(Spine|Chest|UpperChest|Shoulder|UpperArm|LowerArm)$/;

/** Per vertex of a skinned mesh: whether the bone it follows most is one whose skin a garment may hide. */
const hideableSkin = (m: AbstractMesh): ((v: number) => boolean) => {
  const j = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const w = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
  const bones = m.skeleton?.bones ?? [];
  if (!j || !w) return () => false;
  const ok = bones.map((b) => HIDEABLE_SKIN.test(b.name));
  return (v) => {
    let k = 0;
    for (let i = 1; i < 4; i++) if (w[v * 4 + i]! > w[v * 4 + k]!) k = i;
    return ok[j[v * 4 + k]!] ?? false;
  };
};

/**
 * Bones whose skin lends a garment no weights (garment-fit.ts, step 3): the legs (a coat's skirt
 * would part with each of them), the hands and the fingers (the cuffs would bend with them), the
 * head (the collar would turn with it).
 */
const KEEP_OWN = /(UpperLeg|LowerLeg|Foot|Toe|Hand|Thumb\d|Index\d|Middle\d|Ring\d|Little\d|Head)$/;

/** The parts of a model a garment must stay off: skin, trousers or skirt, the top and what is worn over it. */
const UNDER: readonly (string | null | undefined)[] = ["skin", "legs", "torso", "tie"];

/** The vertices of the model's body and cloth on one skeleton (`UNDER`), which the garment must stay off. */
export const bodySurfaceOf = (meshes: readonly AbstractMesh[], skeleton: Skeleton): BodySurface | null => {
  const used = new Map<Float32Array | number[], Set<number>>();
  const extra = new Map<Float32Array | number[], { n: Float32Array | number[]; j: Float32Array | number[] | null; w: Float32Array | number[] | null }>();
  for (const m of meshes) {
    const part = toonSourceOf(m)?.source.part;
    if (m.skeleton !== skeleton || !UNDER.includes(part)) continue;
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    const nor = m.getVerticesData(VertexBuffer.NormalKind);
    const idx = m.getIndices();
    if (!pos || !nor || !idx) continue;
    const set = used.get(pos) ?? new Set<number>();
    used.set(pos, set);
    extra.set(pos, { n: nor, j: m.getVerticesData(VertexBuffer.MatricesIndicesKind), w: m.getVerticesData(VertexBuffer.MatricesWeightsKind) });
    for (const i of idx) set.add(i);
  }
  const p: number[] = [];
  const n: number[] = [];
  const j: number[] = [];
  const w: number[] = [];
  let skinned = true;
  for (const [pos, set] of used) {
    const e = extra.get(pos)!;
    if (!e.j || !e.w) skinned = false;
    for (const i of [...set].sort((a, b) => a - b)) {
      p.push(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
      n.push(e.n[i * 3]!, e.n[i * 3 + 1]!, e.n[i * 3 + 2]!);
      for (let k = 0; k < 4; k++) {
        j.push(e.j?.[i * 4 + k] ?? 0);
        w.push(e.w?.[i * 4 + k] ?? 0);
      }
    }
  }
  if (p.length === 0) return null;
  // The legs, the hands and the head lend no weights to a garment (garment-fit.ts, step 3).
  const keepOwn = new Set(skeleton.bones.flatMap((b, i) => (KEEP_OWN.test(b.name) ? [i] : [])));
  return {
    positions: Float32Array.from(p),
    normals: Float32Array.from(n),
    ...(skinned ? { joints: Float32Array.from(j), weights: Float32Array.from(w), keepOwn } : {}),
  };
};

/**
 * Loads each garment file once and puts copies of it on dressed models. The fit to a cast file is
 * made once and kept with the body's vertex data, which every instance of one file shares
 * (`instantiateModelsToScene` with `doNotInstantiate`); each copy has its own small buffers.
 */
export class GarmentAssets {
  private readonly templates = new Map<SkinnedGarmentId, Promise<GarmentTemplate | null>>();
  private readonly fits = new WeakMap<object, Map<SkinnedGarmentId, Fit>>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    private readonly fetchBytes: (url: string) => Promise<ArrayBuffer> = fetchModelBytes,
  ) {}

  /** The garment file, or null when it cannot be had (the character keeps its own cloth). */
  template(id: SkinnedGarmentId): Promise<GarmentTemplate | null> {
    let pending = this.templates.get(id);
    if (!pending) {
      pending = this.load(id).catch(() => {
        this.templates.delete(id);
        return null;
      });
      this.templates.set(id, pending);
    }
    return pending;
  }

  /**
   * Puts the garment on a dressed model's skeleton (that of its body) and draws only the uncovered
   * triangles of the cloth under it.
   * Null when the model has no VRoid top on a skeleton to follow, or the file failed.
   */
  async wear(id: SkinnedGarmentId, meshes: readonly AbstractMesh[], name: string, tint: string | null): Promise<WornGarment | null> {
    const template = await this.template(id);
    const anchor = meshes.find((m) => m.skeleton && toonSourceOf(m)?.source.part === "skin" && m.getTotalVertices() > 0 && /body/i.test(m.name));
    if (!template || !anchor?.skeleton || anchor.isDisposed()) return null;
    const fit = this.fitFor(id, template, meshes, anchor);
    const fitted = fit.garment;
    const mesh = new MeshClass(`${name}-${id}`, this.scene);
    mesh.setVerticesData(VertexBuffer.PositionKind, fitted.positions, false, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, fitted.normals, false, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, template.geometry.uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, fitted.joints, false, 4);
    mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, fitted.weights, false, 4);
    mesh.setIndices(template.geometry.indices);
    mesh.skeleton = anchor.skeleton;
    mesh.numBoneInfluencers = 4;
    mesh.parent = anchor.parent;
    mesh.position.copyFrom(anchor.position);
    mesh.rotationQuaternion = anchor.rotationQuaternion?.clone() ?? null;
    mesh.rotation.copyFrom(anchor.rotation);
    mesh.scaling.copyFrom(anchor.scaling);
    mesh.isPickable = false;
    mesh.metadata = { garmentAsset: id };
    this.paint(mesh, template, tint);
    const covers: readonly string[] = GARMENT_ASSETS[id].covers;
    const hidden = meshes.filter((m) => {
      const kind = coverKindOf(m);
      return m.skeleton === anchor.skeleton && kind !== null && covers.includes(kind) && m.isEnabled(false);
    });
    const rest = hidden.map((m) => clothRemainder(this.scene, m, this.uncoveredOf(fit, m), `${m.name}-${id}-rest`));
    for (const m of hidden) m.setEnabled(false);
    return { id, mesh, hidden, rest };
  }

  /** The new meshes a worn garment brings: itself and the uncovered rest of the cloth under it. */
  static meshesOf(worn: WornGarment): Mesh[] {
    return [worn.mesh, ...worn.rest.filter((m): m is Mesh => m !== null)];
  }

  /** The rest of each covered cloth takes its cloth's material again (a garment tint recolours the top). */
  follow(worn: WornGarment): void {
    worn.rest.forEach((r, i) => {
      const m = worn.hidden[i]!;
      if (r && r.material !== m.material) r.material = m.material;
    });
  }

  /** Paints the garment again, e.g. with another tint (null: its own colours). */
  paint(mesh: Mesh, template: GarmentTemplate, tint: string | null): void {
    const base = tint ?? template.source.base;
    mesh.material = this.materials.forImported(base, template.texture, "importedCharacter", { ...template.source, layer: GARMENT_LAYER, tint: tint !== null });
  }

  /** Takes the garment off: the hidden cloth shows again. */
  takeOff(worn: WornGarment): void {
    for (const m of worn.hidden) if (!m.isDisposed()) m.setEnabled(true);
    for (const r of worn.rest) r?.dispose(false, false);
    worn.mesh.dispose(false, false);
  }

  private fitFor(id: SkinnedGarmentId, template: GarmentTemplate, meshes: readonly AbstractMesh[], anchor: AbstractMesh): Fit {
    // Every instance of one file shares the body's vertex data; its fit is the same.
    const key = anchor.getVertexBuffer(VertexBuffer.PositionKind)?.getData() ?? anchor;
    const known = this.fits.get(key as object) ?? new Map<SkinnedGarmentId, Fit>();
    this.fits.set(key as object, known);
    let fit = known.get(id);
    if (!fit) {
      fit = { garment: fitGarment(template.geometry, targetSkeletonOf(anchor.skeleton!), bodySurfaceOf(meshes, anchor.skeleton!)), uncovered: new WeakMap() };
      known.set(id, fit);
    }
    return fit;
  }

  /** The triangles of a cloth the fitted garment leaves uncovered, once per cloth of a file (its shared index buffer). */
  private uncoveredOf(fit: Fit, cloth: AbstractMesh): number[] {
    const indices = cloth.getIndices();
    const positions = cloth.getVerticesData(VertexBuffer.PositionKind);
    const normals = cloth.getVerticesData(VertexBuffer.NormalKind);
    if (!indices || !positions || !normals) return [];
    let left = fit.uncovered.get(indices);
    if (!left) {
      left = uncoveredTriangles({ positions, normals, indices }, fit.garment.positions, coverKindOf(cloth) === "skin" ? hideableSkin(cloth) : undefined);
      fit.uncovered.set(indices, left);
    }
    return left;
  }

  private async load(id: SkinnedGarmentId): Promise<GarmentTemplate | null> {
    await loadGltfPlugin();
    const bytes = await this.fetchBytes(GARMENT_ASSETS[id].url);
    const container = await LoadAssetContainerAsync(new Uint8Array(bytes), this.scene, { pluginExtension: ".glb" });
    try {
      const mesh = container.meshes.find((m): m is Mesh => m instanceof MeshClass && m.getTotalVertices() > 0 && m.skeleton !== null);
      if (!mesh?.skeleton) return null;
      const source = readSourceMaterial(mesh.material);
      const texture = source.texture;
      // The texture stays for the toon material; the rest of the file goes.
      container.textures.splice(0, container.textures.length, ...container.textures.filter((t) => t !== texture));
      return { geometry: readTemplate(mesh, mesh.skeleton), texture, source };
    } finally {
      container.dispose();
    }
  }
}
