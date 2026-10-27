import {
  type AbstractMesh,
  type AnimationGroup,
  type AssetContainer,
  type Mesh,
  type BaseTexture,
  Color3,
  LoadAssetContainerAsync,
  type Scene,
  type Texture,
  type TransformNode,
  loadGltfPlugin,
} from "../babylon";
import { applyOutline } from "../npr/outline";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";
import { FaceRig } from "./face";
import { type VrmExpressions, type VrmSprings, readGlbJson, readVrmExpressions, readVrmSprings } from "./vrm-meta";

/** Which character views can be replaced by imported models. */
export type CharacterModelKey = "heroine" | "fixer" | "civilian" | "ripperdoc" | "ganger";

/** One entry of models/manifest.json. */
export interface CharacterModelSpec {
  readonly url: string;
  /** Uniform scale to metres (VRoid exports are already in metres: 1). */
  readonly scale?: number;
  /** Extra rotation around Y if the model does not face +Z. */
  readonly yaw?: number;
  /** Animation group names; matched case-insensitively, first match wins. */
  readonly idle?: string;
  readonly walk?: string;
  readonly run?: string;
  readonly preset?: PresetName;
  readonly outline?: boolean;
}

export type CharacterModelManifest = Partial<Record<CharacterModelKey, CharacterModelSpec>>;

interface Loaded {
  readonly container: AssetContainer;
  readonly springs: VrmSprings | null;
  readonly expressions: VrmExpressions | null;
}

export interface ModelInstance {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  readonly animations: AnimationGroup[];
  /** Spring bone data authored in the VRM file, if any. */
  readonly springs: VrmSprings | null;
  /** Blink and mouth shapes, when the file has VRM expressions with morph targets. */
  readonly face: FaceRig | null;
  /** Name prefix of this instance's nodes (to find bones by their file names). */
  readonly prefix: string;
  /** Puts every node back to its pose at instantiation, so a pooled instance can be reused. */
  resetPose(): void;
  dispose(): void;
}

export interface SourceMaterial {
  readonly base: string;
  readonly texture: Texture | null;
  readonly alphaTest: boolean;
  readonly alphaBlend: boolean;
  readonly doubleSided: boolean;
  /**
   * Inverted-hull ink. Off for the face (the hull shows through the eye sockets), for
   * blended layers and for double-sided cut-out cards like hair strands, whose hull would
   * be the whole quad; the line-art pass still inks their silhouettes.
   */
  readonly outline: boolean;
  /**
   * VRoid "EyeExtra" layers (star and heart eyes) are hidden by a blend shape; the toon
   * shader has no morph targets, so they are dropped instead.
   */
  readonly hidden: boolean;
  /** Depth stacking of VRoid face layers over the face skin. */
  readonly layer: number;
}

const FACE_LAYERS: readonly [RegExp, number][] = [
  [/eyehighlight/i, 4],
  [/eyeiris/i, 3],
  [/eyeline|eyelash|brow/i, 2],
  [/eyewhite/i, 1],
];

/** Base colour, texture and cut-out flags of a glTF material (PBR metallic-roughness or unlit). */
export const readSourceMaterial = (material: unknown): SourceMaterial => {
  const m = material as {
    name?: string;
    albedoColor?: Color3;
    diffuseColor?: Color3;
    albedoTexture?: BaseTexture | null;
    diffuseTexture?: BaseTexture | null;
    transparencyMode?: number | null;
    backFaceCulling?: boolean;
  } | null;
  const color = m?.albedoColor ?? m?.diffuseColor ?? Color3.White();
  const texture = (m?.albedoTexture ?? m?.diffuseTexture ?? null) as Texture | null;
  const mode = m?.transparencyMode ?? 0;
  return {
    base: color.toHexString(),
    texture,
    alphaTest: mode >= 1,
    // Back hair is BLEND in VRoid too, but it is a solid shell: keep it cut out and sorted as opaque.
    alphaBlend: mode >= 2 && !/hair/i.test(m?.name ?? ""),
    doubleSided: m?.backFaceCulling === false,
    hidden: /eyeextra/i.test(m?.name ?? ""),
    layer: FACE_LAYERS.find(([re]) => re.test(m?.name ?? ""))?.[1] ?? 0,
    outline: mode < 2 && m?.backFaceCulling !== false && !/face|eye|mouth|lash|brow|highlight/i.test(m?.name ?? ""),
  };
};

/** Babylon's glTF loader reads VRM as GLB; the VRM extensions are skipped. */
export const pluginExtensionFor = (url: string): string | undefined =>
  url.startsWith("data:model/gltf-binary") ? ".glb" : url.startsWith("data:") ? ".gltf" : /\.vrm(\?|#|$)/i.test(url) ? ".glb" : undefined;

/**
 * Swaps glTF materials for toon materials and folds primitives that end up with the same
 * material back into one mesh: VRoid splits a hairstyle into dozens of primitives over one
 * vertex buffer, which would otherwise cost a draw call (and an outline pass) each.
 */
export const convertModelMaterials = (container: AssetContainer, materials: ToonMaterials, preset: PresetName): void => {
  const replaced = new Set<unknown>();
  const groups = new Map<string, AbstractMesh[]>();
  const dataIds = new Map<object, number>();
  const dropped: AbstractMesh[] = [];
  let nextDataId = 0;
  for (const mesh of container.meshes) {
    if (!mesh.material || mesh.getTotalVertices() === 0) continue;
    const source = readSourceMaterial(mesh.material);
    replaced.add(mesh.material);
    mesh.material = materials.forImported(source.base, source.texture, preset, source);
    mesh.isPickable = false;
    if (source.hidden) {
      dropped.push(mesh);
      continue;
    }
    mesh.metadata = { ...(mesh.metadata as object | null), toonOutline: source.outline };
    // Primitives of one glTF mesh have their own Geometry but share the vertex data.
    const data = mesh.getVertexBuffer("position")?.getData() ?? mesh;
    let dataId = dataIds.get(data);
    if (dataId === undefined) dataIds.set(data, (dataId = nextDataId++));
    const key = `${mesh.material.uniqueId}:${dataId}:${mesh.skeleton?.uniqueId ?? "-"}:${mesh.parent?.uniqueId ?? "-"}`;
    const list = groups.get(key);
    if (list) list.push(mesh);
    else groups.set(key, [mesh]);
  }
  for (const m of dropped) {
    container.meshes.splice(container.meshes.indexOf(m), 1);
    m.dispose(false, false);
  }
  for (const list of groups.values()) {
    const [first, ...rest] = list as Mesh[];
    if (!first || rest.length === 0) continue;
    const indices: number[] = [];
    for (const m of list as Mesh[]) {
      const own = m.getIndices();
      if (own) for (const i of own) indices.push(i);
    }
    first.setIndices(indices, first.getTotalVertices());
    for (const m of rest) {
      container.meshes.splice(container.meshes.indexOf(m), 1);
      m.dispose(false, false);
    }
  }
  for (const old of replaced) (old as { dispose?: (a?: boolean, b?: boolean) => void }).dispose?.(false, false);
  container.materials.length = 0;
};

/** Thin enough to stay under most clothing layers when a model opts into the hull. */
export const IMPORTED_OUTLINE_WIDTH = 0.006;

export const outlineModelMeshes = (meshes: readonly AbstractMesh[], enabled: boolean): void => {
  if (!enabled) return;
  for (const m of meshes) {
    if ((m.metadata as { toonOutline?: boolean } | null)?.toonOutline !== false && m.getTotalVertices() > 0) applyOutline(m, IMPORTED_OUTLINE_WIDTH);
  }
};

/**
 * Loads each model file once (as an asset container whose materials are converted to the
 * toon materials) and hands out independent instances with their own skeletons and
 * animation groups.
 */
export class ModelLibrary {
  private readonly containers = new Map<string, Promise<Loaded>>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
  ) {}

  async instantiate(spec: CharacterModelSpec, name: string): Promise<ModelInstance> {
    const { container, springs, expressions } = await this.load(spec);
    const entries = container.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true });
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) throw new Error(`Model ${spec.url} has no root node`);
    const meshes = root.getChildMeshes(false);
    for (const m of meshes) m.isPickable = false;
    // Off by default: the hull's second pass writes inflated depth that hides clothing layered
    // a centimetre above the skin. The line-art pass inks imported models instead.
    outlineModelMeshes(meshes, spec.outline ?? false);
    if (spec.scale !== undefined) root.scaling.scaleInPlace(spec.scale);
    if (spec.yaw) root.rotation.y += spec.yaw;
    const bind = (root.getDescendants(false) as TransformNode[])
      .filter((n) => "rotation" in n)
      .map((n) => ({ n, q: n.rotationQuaternion?.clone() ?? null, r: n.rotation.clone(), p: n.position.clone() }));
    return {
      prefix: `${name}-`,
      resetPose: () => {
        for (const b of bind) {
          b.n.position.copyFrom(b.p);
          b.n.rotation.copyFrom(b.r);
          if (b.q) b.n.rotationQuaternion = b.q.clone();
          else b.n.rotationQuaternion = null;
        }
      },
      root,
      meshes,
      animations: entries.animationGroups,
      springs,
      face: FaceRig.create(meshes, expressions, `${name}-`),
      dispose: () => {
        for (const g of entries.animationGroups) g.dispose();
        for (const s of entries.skeletons) s.dispose();
        root.dispose(false, false);
      },
    };
  }

  private load(spec: CharacterModelSpec): Promise<Loaded> {
    let pending = this.containers.get(spec.url);
    if (!pending) {
      pending = (async () => {
        await loadGltfPlugin();
        const extension = pluginExtensionFor(spec.url);
        // Binary files are fetched here so the VRM spring data can be read from the JSON
        // chunk; a .gltf with external buffers loads by URL so its relative paths resolve.
        let springs: VrmSprings | null = null;
        let expressions: VrmExpressions | null = null;
        let source: string | Uint8Array = spec.url;
        if (extension === ".glb" || /\.glb(\?|#|$)/i.test(spec.url)) {
          const bytes = await (await fetch(spec.url)).arrayBuffer();
          const json = readGlbJson(bytes);
          springs = json ? readVrmSprings(json) : null;
          expressions = json ? readVrmExpressions(json) : null;
          source = new Uint8Array(bytes);
        }
        const container = await LoadAssetContainerAsync(source, this.scene, { pluginExtension: extension ?? (typeof source === "string" ? undefined : ".glb") });
        convertModelMaterials(container, this.materials, spec.preset ?? "importedCharacter");
        return { container, springs, expressions };
      })();
      this.containers.set(spec.url, pending);
    }
    return pending;
  }
}

/** Picks the animation group for a speed, by the names the manifest gives. */
export const pickAnimation = (groups: readonly AnimationGroup[], spec: CharacterModelSpec, speed: number): AnimationGroup | null => {
  const wanted = speed > 5 ? (spec.run ?? spec.walk) : speed > 0.3 ? spec.walk : spec.idle;
  if (!wanted) return groups[0] ?? null;
  const lower = wanted.toLowerCase();
  return groups.find((g) => g.name.toLowerCase().includes(lower)) ?? null;
};
