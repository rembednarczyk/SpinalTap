import { type AbstractMesh, Color3, Matrix, type Mesh, type Scene, type Texture, type TransformNode, Vector3 } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import type { ActivityId } from "@seki/core";
import type { CharacterRig } from "./character-rig";
import { buildAccessories, buildCane, buildSkirt } from "./model-accessories";
import { buildApron, buildVest } from "./model-apron";
import { UPRIGHT, freshWorld, wearFigure } from "./model-figure";
import { type ModelCloth, type ModelPart, toonSourceOf } from "./model-library";
import { type AnchorBone, type HumanoidRetarget, normaliseBoneName } from "./model-rig";
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
    case "tie":
      return v.tie ? ctx.materials.forImported(v.tie, source.texture, preset, { ...source, tint: true }) : null;
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
  /** The rig, whose stride the figure shortens, and the model's root and bone prefix, whose back it bends (ADR-0076 decision 7). */
  readonly rig?: CharacterRig;
  readonly model?: { readonly root: TransformNode; readonly prefix: string };
}

/** A walking stick reaches from the palm to the ground: about half the height of the head bone. */
const CANE_OF_HEAD = 0.5;
/** The head bone of a VRoid figure stands at about this fraction of its height. */
const HEAD_OF_HEIGHT = 0.86;
/** The hand bone sits at the wrist; the stick is held this much lower, in the palm. */
const PALM = 0.07;

/**
 * Dresses `meshes` (an instance's) in `v`: the accessories hang on the retarget's anchors of the
 * head and chest bones, sized by `fit`; an apron or a vest is a shell of the model's own cloth,
 * a walking stick is held in the right hand, and the figure bends the back and sets the build.
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
  for (const [id, build] of [
    ["apron", buildApron],
    ["vest", buildVest],
  ] as const) {
    const item = v.accessories.find((a) => a.id === id);
    const shell = item ? build(ctx.scene, `${name}-${id}`, meshes, on.body, item.color) : null;
    if (!shell) continue;
    shell.material = ctx.materials.get("charVertexColor");
    worn.push(shell);
  }
  const cane = holdCane(ctx, name, on, v);
  if (cane) worn.push(cane.mesh);
  const long = v.accessories.find((a) => a.id === "skirt");
  let skirt: Mesh | null = null;
  if (long && on.rig) {
    skirt = buildSkirt(ctx.scene, `${name}-skirt`, on.retarget.headHeight / HEAD_OF_HEIGHT, v.figure.build, long.color);
    skirt.material = ctx.materials.get("charVertexColor");
    skirt.parent = on.rig.body;
    worn.push(skirt);
  }
  const rig = on.rig;
  const follow = () => {
    if (!rig) return;
    cane?.mesh.setEnabled(caneShows(rig));
    if (cane?.mesh.isEnabled(false)) cane.place();
    skirt?.setEnabled(skirtShows(rig));
  };
  follow();
  const observer = cane || skirt ? ctx.scene.onBeforeRenderObservable.add(follow) : null;
  // The figure last: the accessories' anchors are sized by the model's scale before it widens.
  // An armed character stays upright: its two-handed hold is solved from the shoulders and arm
  // lengths the retarget measured at rest (G-282), which a bent back or a new width would move.
  const shape = on.rig?.aiming ? UPRIGHT : v.figure;
  const figure = on.model ? wearFigure(on.model.root, on.model.prefix, on.body, shape) : null;
  if (on.rig) on.rig.pace = shape.pace;
  return {
    meshes: worn,
    undo: () => {
      for (const [mesh, material] of own) mesh.material = material;
      if (observer) ctx.scene.onBeforeRenderObservable.remove(observer);
      for (const m of worn) m.dispose();
      for (const a of anchors) a.dispose();
      figure?.undo();
      if (on.rig) on.rig.pace = 1;
    },
  };
};

/** A walking stick and how to put it at the hand. */
interface Cane {
  readonly mesh: Mesh;
  place(): void;
}

/** Activities whose pose bends the knees past a long skirt or lays the body down (ADR-0040). */
const SEATED: readonly ActivityId[] = ["sit", "sleep"];

/** Down, fallen, or over someone's shoulder: no stick in the hand, no stiff skirt round the legs. */
const offFeet = (rig: CharacterRig): boolean => rig.dying !== null || rig.knockout > 0 || rig.carried > 0;

/**
 * The stick only while walking or just standing: an activity's hands (a broom, a gesture, a
 * bowl) would lift it off the ground or cross it; seated and lying it would sink into the floor.
 */
const caneShows = (rig: CharacterRig): boolean => !offFeet(rig) && (rig.doing ?? []).every((a) => a === "idle");

/** The long skirt is a stiff bell: off while seated or lying, where the knees would leave it and it would sink into the floor. */
const skirtShows = (rig: CharacterRig): boolean => !offFeet(rig) && !(rig.doing ?? []).some((a) => SEATED.includes(a));

/**
 * The walking stick in the model's right hand, long enough to reach the ground from the palm;
 * null without one. It hangs from the palm but stays upright whatever the forearm does (a
 * gesture, the swing of a step): on the character's root, which only turns about Y, placed at
 * the hand before every frame (by the dress's observer, which also hides it outside walking and standing).
 */
const holdCane = (ctx: DressContext, name: string, on: DressedOn, v: ModelVariant): Cane | null => {
  const worn = v.accessories.find((a) => a.id === "cane");
  const model = on.model;
  const root = on.rig?.root;
  if (!worn || !model || !root) return null;
  const hand = model.root.getDescendants(false).find((n): n is TransformNode => "rotation" in n && normaliseBoneName(n.name, model.prefix) === "rhand");
  if (!hand) return null;
  const mesh = buildCane(ctx.scene, `${name}-cane`, CANE_OF_HEAD * on.retarget.headHeight, worn.color);
  mesh.material = ctx.materials.get("charVertexColor");
  mesh.parent = root;
  const place = () => {
    const at = freshWorld(hand).getTranslation();
    Vector3.TransformCoordinatesToRef(at, Matrix.Invert(root.getWorldMatrix()), mesh.position);
    mesh.position.y -= PALM;
  };
  place();
  return { mesh, place };
};
