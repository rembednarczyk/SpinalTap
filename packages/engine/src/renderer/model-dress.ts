import { type AbstractMesh, Color3, type Mesh, type Scene, type Texture, type TransformNode } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { buildAccessories } from "./model-accessories";
import { buildApron } from "./model-apron";
import { type ModelCloth, type ModelPart, toonSourceOf } from "./model-library";
import type { AnchorBone, HumanoidRetarget } from "./model-rig";
import type { ModelVariant } from "./model-variant";

/**
 * Puts a variant (ADR-0076 §3) on an instance of an imported model: other materials for its
 * skin, hair, brows, top and trousers, and the accessories on its bones. Materials come from
 * the shared toon cache by colour and texture, so two characters in one variant share them and
 * a variant costs no draw call; the accessories of one bone are one mesh.
 */

/** VRoid skin textures are painted about this light; the variant's skin colour scales them to it. */
const VROID_SKIN = Color3.FromHexString("#f6e2d6");

/** The multiplier that brings the file's skin to `hex`, as a colour. */
export const skinMultiplier = (hex: string): string => {
  const c = Color3.FromHexString(hex);
  const f = (a: number, b: number) => Math.min(1, a / b);
  return new Color3(f(c.r, VROID_SKIN.r), f(c.g, VROID_SKIN.g), f(c.b, VROID_SKIN.b)).toHexString();
};

/** Files of the same base that lend their top and trousers, by part (sorted by the caller). */
export interface Donors {
  readonly torso: readonly Texture[];
  readonly legs: readonly Texture[];
}

/** What a dressed variant changed, to give back when the model goes to the pool. */
export interface WornVariant {
  /** Accessory meshes on the model's bones. */
  readonly meshes: readonly Mesh[];
  undo(): void;
}

export interface DressContext {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
}

/** Of the donors' textures, the one a fraction picks; null for none. */
const donorOf = (list: readonly Texture[], fraction: number | null): Texture | null =>
  fraction === null || list.length === 0 ? null : list[Math.min(list.length - 1, Math.floor(fraction * list.length))]!;

/** The material of one mesh in the variant, or null to keep its own. */
const materialOf = (ctx: DressContext, mesh: AbstractMesh, v: ModelVariant, swap: Readonly<Partial<Record<ModelPart, Texture>>>): AbstractMesh["material"] | null => {
  const src = toonSourceOf(mesh);
  const part = src?.source.part;
  if (!src || !part || !src.source.texture) return null;
  const { preset, source } = src;
  switch (part) {
    case "skin":
      return v.skin ? ctx.materials.forImported(skinMultiplier(v.skin), source.texture, preset, source) : null;
    case "hair":
      return v.hair ? ctx.materials.forImported(v.hair, source.texture, preset, { ...source, tint: true }) : null;
    case "brow":
      return v.hair ? ctx.materials.forImported(v.hair, source.texture, preset, source) : null;
    case "torso":
    case "legs": {
      const colour = part === "torso" ? v.top : v.bottom;
      // Only a separate top or trousers takes another's texture: a one-piece dress has its own UVs.
      const texture = (source.garment === part ? swap[part] : undefined) ?? source.texture;
      if (!colour && texture === source.texture) return null;
      return ctx.materials.forImported(colour ?? source.base, texture, preset, { ...source, tint: colour !== null });
    }
  }
};

/** A file's cloth to lend: whether `cloth` may dress a model of base `family`. */
export const lends = (cloth: ModelCloth, family: string | null): boolean => family !== null && cloth.family === family;

/** Where a dressed model stands: its retarget, the rig body it faces with, and its size against the rig's. */
export interface DressedOn {
  readonly retarget: HumanoidRetarget;
  readonly body: TransformNode;
  readonly fit: number;
}

/**
 * Dresses `meshes` (an instance's) in `v`: the accessories hang on the retarget's anchors of the
 * head and chest bones, sized by `fit`; an apron is a shell of the model's own cloth.
 */
export const dressVariant = (ctx: DressContext, name: string, meshes: readonly AbstractMesh[], on: DressedOn, v: ModelVariant, donors: Donors): WornVariant => {
  const { retarget, fit } = on;
  const own = new Map<AbstractMesh, AbstractMesh["material"]>();
  const swap: Partial<Record<ModelPart, Texture>> = {};
  const top = donorOf(donors.torso, v.topFrom);
  const bottom = donorOf(donors.legs, v.bottomFrom);
  if (top) swap.torso = top;
  if (bottom) swap.legs = bottom;
  for (const mesh of meshes) {
    const material = materialOf(ctx, mesh, v, swap);
    if (!material || material === mesh.material) continue;
    own.set(mesh, mesh.material);
    mesh.material = material;
  }
  const worn: Mesh[] = [];
  const anchors: TransformNode[] = [];
  for (const bone of ["head", "chest"] as const satisfies readonly AnchorBone[]) {
    const mesh = buildAccessories(ctx.scene, name, v.accessories, bone);
    if (!mesh) continue;
    const anchor = retarget.anchor(bone, `${name}-${bone}-variant`);
    if (!anchor) {
      mesh.dispose();
      continue;
    }
    anchors.push(anchor);
    mesh.parent = anchor;
    mesh.position.setAll(0);
    mesh.scaling.setAll(fit);
    mesh.material = ctx.materials.get("charVertexColor");
    worn.push(mesh);
  }
  const apron = v.accessories.find((a) => a.id === "apron");
  const shell = apron ? buildApron(ctx.scene, `${name}-apron`, meshes, on.body, apron.color) : null;
  if (shell) {
    shell.material = ctx.materials.get("charVertexColor");
    worn.push(shell);
  }
  return {
    meshes: worn,
    undo: () => {
      for (const [mesh, material] of own) mesh.material = material;
      for (const m of worn) m.dispose();
      for (const a of anchors) a.dispose();
    },
  };
};
