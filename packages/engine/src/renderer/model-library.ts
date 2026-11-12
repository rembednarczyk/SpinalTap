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
  VertexBuffer,
  loadGltfPlugin,
} from "../babylon";
import type { CastKey } from "@seki/core";
import { applyOutline } from "../npr/outline";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";
import { FaceRig } from "./face";
import type { VariantDress } from "./model-variant";
import { type VrmExpressions, type VrmSprings, isVrm, readGlbJson, readVrmExpressions, readVrmSprings } from "./vrm-meta";

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
  /**
   * Which look of the file (ADR-0076 §3, `variantOf`): 0 is the file's own, 1..16 the
   * background's, the named characters' from 100 up. Part of the pool key.
   */
  readonly variant?: number;
  /** A named character's hand-made changes over its variant (hair, clothes, accessories). */
  readonly dress?: VariantDress;
  /**
   * The file lends its top and trousers to the variants though only named characters wear it
   * (`donorFiles`, ADR-0076 stage 4a): set on any of its cast entries.
   */
  readonly lends?: boolean;
}

/** Background roles with a pool of models (ADR-0076). */
export type ModelPoolRole = "civilian" | "vendor" | "ganger" | "corpo";

export const MODEL_POOL_ROLES: readonly ModelPoolRole[] = ["civilian", "vendor", "ganger", "corpo"];

/** One file of a background pool, drawn as often as its weight says (default 1). */
export interface PooledModelSpec extends CharacterModelSpec {
  readonly weight?: number;
}

/**
 * models/manifest.json: a model per role (the fallback), a model per named character (`cast`)
 * and a pool per background role (`pools`, ADR-0076).
 */
export type CharacterModelManifest = Partial<Record<CharacterModelKey, CharacterModelSpec>> & {
  readonly cast?: Partial<Record<CastKey, CharacterModelSpec>>;
  readonly pools?: Partial<Record<ModelPoolRole, readonly PooledModelSpec[]>>;
};

/** What a file lends to the variants of other files of its base (`ModelLibrary.clothOf`). */
export interface ModelCloth {
  readonly family: string | null;
  readonly torso: Texture | null;
  readonly legs: Texture | null;
  /** The VRoid cut of the top and of the trousers or skirt ("M00_001"): only one cut shares a UV layout. */
  readonly cuts: { readonly torso: string | null; readonly legs: string | null };
}

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
  /** The garment slot a VRoid cloth material dresses ("Tops", "Bottoms"), for garment tints. */
  readonly garment: "torso" | "legs" | null;
  /**
   * What a VRoid material paints, for the model variants (ADR-0076): skin, hair, brows, and the
   * top (a one-piece dress too), trousers or skirt, and the tie or bow over the top. Null for the eyes, mouth, shoes and the rest.
   */
  readonly part: ModelPart | null;
  /** The VRoid base the material belongs to ("F00", "M00"), from its name; null for other files. */
  readonly family: string | null;
  /**
   * The VRoid cut of the material, base and garment number ("M00_001", "M00_006"), from its name:
   * cloth of one cut shares its UV layout, of another not (ADR-0076 stage 3). Null for other files.
   */
  readonly cut: string | null;
}

export type ModelPart = "skin" | "hair" | "brow" | "torso" | "legs" | "tie";

const partOf = (name: string): ModelPart | null =>
  /_SKIN\b/.test(name) ? "skin" : /_HAIR(\b|_)/.test(name) ? "hair" : /facebrow/i.test(name) ? "brow" : /tops|onepi/i.test(name) ? "torso" : /bottoms/i.test(name) ? "legs" : /_accessory/i.test(name) ? "tie" : null;

/** What an imported mesh's toon material was made from, kept in `mesh.metadata.toonSource` to recolour it. */
export interface ToonSource {
  readonly preset: PresetName;
  readonly source: SourceMaterial;
}

export const toonSourceOf = (mesh: AbstractMesh): ToonSource | null => (mesh.metadata as { toonSource?: ToonSource } | null)?.toonSource ?? null;

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
    garment: /tops/i.test(m?.name ?? "") ? "torso" : /bottoms/i.test(m?.name ?? "") ? "legs" : null,
    part: partOf(m?.name ?? ""),
    family: /^([FM]\d\d)_/.exec(m?.name ?? "")?.[1] ?? null,
    cut: /^([FM]\d\d_\d{3})_/.exec(m?.name ?? "")?.[1] ?? null,
  };
};

/** Babylon's glTF loader reads VRM as GLB; the VRM extensions are skipped. */
export const pluginExtensionFor = (url: string): string | undefined =>
  url.startsWith("data:model/gltf-binary") ? ".glb" : url.startsWith("data:") ? ".gltf" : /\.vrm(\?|#|$)/i.test(url) ? ".glb" : undefined;

/**
 * Swaps glTF materials for toon materials and folds primitives that end up with the same
 * material back into one mesh: VRoid splits a hairstyle into dozens of primitives over one
 * vertex buffer, which would otherwise cost a draw call (and an outline pass) each.
 *
 * `vertexColors: false` drops the meshes' COLOR_0 (VRM files: MToon does not read it). Babylon
 * compiles VERTEXCOLOR into the toon shader for any mesh with the buffer, and the albedo is
 * multiplied by it: `kaito.vrm` carries one of zeros and drew as a black figure (G-474).
 */
export const convertModelMaterials = (container: AssetContainer, materials: ToonMaterials, preset: PresetName, vertexColors = true): void => {
  const replaced = new Set<unknown>();
  const groups = new Map<string, AbstractMesh[]>();
  const dataIds = new Map<object, number>();
  const dropped: AbstractMesh[] = [];
  const read = new Set<BaseTexture>();
  let nextDataId = 0;
  for (const mesh of container.meshes) {
    if (!mesh.material || mesh.getTotalVertices() === 0) continue;
    if (!vertexColors && mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) (mesh as Mesh).removeVerticesData(VertexBuffer.ColorKind);
    const source = readSourceMaterial(mesh.material);
    replaced.add(mesh.material);
    if (source.hidden) {
      dropped.push(mesh);
      continue;
    }
    if (source.texture) read.add(source.texture);
    mesh.material = materials.forImported(source.base, source.texture, preset, source);
    mesh.isPickable = false;
    const toonSource: ToonSource = { preset, source };
    mesh.metadata = { ...(mesh.metadata as object | null), toonOutline: source.outline, toonSource };
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
  releaseUnreadTextures(container, read);
};

/**
 * Frees the file's textures no toon material reads (ADR-0076 §4): the hidden layers', and any
 * normal, emission or occlusion map a non-VRM glTF brings (the toon shader samples the base only).
 */
const releaseUnreadTextures = (container: AssetContainer, read: ReadonlySet<BaseTexture>): void => {
  const kept = container.textures.filter((t) => read.has(t));
  for (const t of container.textures) if (!read.has(t)) t.dispose();
  container.textures.length = 0;
  container.textures.push(...kept);
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
 * How long a model file may take to download before it counts as failed (G-562 path: the character
 * keeps its stand-in and the next ask fetches it again). The largest VRM is about 8 MB, which a phone
 * on slow 3G (0.75 Mbit/s) gets in about 90 s; the rest is room for a start file sharing the link with
 * another. Past that the fetch has hung rather than crawled (G-561).
 */
export const MODEL_FETCH_TIMEOUT_MS = 120_000;

/** The file's bytes, or a rejection once `MODEL_FETCH_TIMEOUT_MS` passes, with the fetch aborted. */
const fetchModelBytes = async (url: string): Promise<ArrayBuffer> => {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Raced as well as aborted: a stalled body or a fetch that ignores the signal must not hang the load.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Model ${url} did not download within ${MODEL_FETCH_TIMEOUT_MS / 1000} s`);
      abort.abort(err);
      reject(err);
    }, MODEL_FETCH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fetch(url, { signal: abort.signal }).then((r) => r.arrayBuffer()), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Loads each model file once (as an asset container whose materials are converted to the
 * toon materials) and hands out independent instances with their own skeletons and
 * animation groups.
 */
export class ModelLibrary {
  private readonly containers = new Map<string, Promise<Loaded>>();
  /** Files whose container is ready (ADR-0076 stage 4a: the background fetch skips these). */
  private readonly ready = new Map<string, Loaded>();

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

  /** Downloads and parses the file without making an instance (the loading screen, ADR-0057). */
  preload(spec: CharacterModelSpec): Promise<unknown> {
    return this.load(spec);
  }

  /** The file is loaded and its container ready for instances. */
  isLoaded(url: string): boolean {
    return this.ready.has(url);
  }

  /** The files loaded now, in the order they finished. */
  loadedFiles(): string[] {
    return [...this.ready.keys()];
  }

  /**
   * Frees a loaded file (ADR-0076 stage 4b): its container with the meshes, skeletons, animation
   * groups and textures, and the toon materials painted with those textures. Its instances must be
   * disposed first. The next ask loads it again. False for a file not loaded or still on its way.
   */
  release(url: string): boolean {
    const loaded = this.ready.get(url);
    if (!loaded) return false;
    this.ready.delete(url);
    this.containers.delete(url);
    this.materials.releaseTextures(loaded.container.textures);
    loaded.container.dispose();
    return true;
  }

  /** The textures a loaded file keeps for its instances (a measure of its memory, ADR-0076). */
  async texturesOf(spec: CharacterModelSpec): Promise<readonly BaseTexture[]> {
    return [...(await this.load(spec)).container.textures];
  }

  /**
   * The cloth of a file for the variants of others (ADR-0076): its VRoid base (that of its top)
   * and the textures of its separate top ("Tops") and trousers or skirt ("Bottoms"), which share
   * their UV layout within a base and a cut. A one-piece dress lends nothing.
   */
  async clothOf(spec: CharacterModelSpec): Promise<ModelCloth> {
    const { container } = await this.load(spec);
    const sources = container.meshes.map((m) => toonSourceOf(m)?.source).filter((s): s is SourceMaterial => !!s);
    const garmentOf = (slot: "torso" | "legs") => sources.find((s) => s.garment === slot && s.texture);
    const [torso, legs] = [garmentOf("torso"), garmentOf("legs")];
    return {
      family: sources.find((s) => s.part === "torso")?.family ?? null,
      torso: torso?.texture ?? null,
      legs: legs?.texture ?? null,
      cuts: { torso: torso?.cut ?? null, legs: legs?.cut ?? null },
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
        let vrm = false;
        let source: string | Uint8Array = spec.url;
        if (extension === ".glb" || /\.glb(\?|#|$)/i.test(spec.url)) {
          const bytes = await fetchModelBytes(spec.url);
          const json = readGlbJson(bytes);
          springs = json ? readVrmSprings(json) : null;
          expressions = json ? readVrmExpressions(json) : null;
          vrm = json ? isVrm(json) : false;
          source = new Uint8Array(bytes);
        }
        const container = await LoadAssetContainerAsync(source, this.scene, { pluginExtension: extension ?? (typeof source === "string" ? undefined : ".glb") });
        convertModelMaterials(container, this.materials, spec.preset ?? "importedCharacter", !vrm);
        const loaded = { container, springs, expressions };
        this.ready.set(spec.url, loaded);
        return loaded;
      })();
      this.containers.set(spec.url, pending);
      // A file that failed is forgotten, so the next ask fetches it again (G-562).
      const failed = pending;
      failed.catch(() => {
        if (this.containers.get(spec.url) === failed) this.containers.delete(spec.url);
      });
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
