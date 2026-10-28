import type { AppearanceDescriptor, GarmentMeshId, GarmentSlot, PaletteKey, WeaponLook, WeaponSlot } from "@seki/core";
import { type AbstractMesh, type Mesh, MeshBuilder, MeshClass, type Scene, TransformNode, Vector3 } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./characters";
import { recolorSkin } from "./character-skin";
import { toonSourceOf } from "./model-library";
import type { AnchorBone, HumanoidRetarget } from "./model-rig";
import type { WeaponKind, WeaponMounts } from "./weapon-mount";

/** Weapon model and size for a look; melee weapons are simple shapes for now. */
const MODEL: Readonly<Record<WeaponLook, { kind: WeaponKind | null; scale: number }>> = {
  pistol: { kind: "pistol", scale: 1 },
  revolver: { kind: "pistol", scale: 1.08 },
  smg: { kind: "smg", scale: 1 },
  shotgun: { kind: "smg", scale: 1.35 },
  rifle: { kind: "smg", scale: 1.5 },
  baton: { kind: null, scale: 1 },
  blade: { kind: null, scale: 1 },
};

type Place = "hand" | "hip" | "hipL" | "back" | "model";

interface Mounted {
  readonly look: WeaponLook;
  readonly node: TransformNode;
}

/** An imported model dressed over the rig: its bones carry the gun and the garment add-ons. */
export interface DressedModel {
  readonly retarget: HumanoidRetarget;
  /** The model's meshes; VRoid "Tops" and "Bottoms" cloth takes the garment tints. */
  readonly meshes: readonly AbstractMesh[];
}

/** Nodes made on a dressed model's bones; they go with the model. */
interface OnModel {
  readonly model: DressedModel;
  readonly hand: TransformNode | null;
  readonly anchors: Partial<Record<AnchorBone, TransformNode>>;
  /** Model size against the rig's (head heights), for the add-ons. */
  readonly fit: number;
  /** Cloth meshes recoloured by a tint, with the material to give back. */
  readonly tinted: Map<AbstractMesh, AbstractMesh["material"]>;
}

interface State {
  look: AppearanceDescriptor;
  readonly name: string;
  readonly holsterR: TransformNode;
  readonly holsterL: TransformNode;
  readonly back: TransformNode;
  /** Positions of the holsters and the sling on the rig, before fitting them to a model's size. */
  readonly stowage: readonly { readonly node: TransformNode; readonly at: Vector3 }[];
  readonly mounted: Partial<Record<Place, Mounted>>;
  /** Visible implants (optics at the temples, rings on the right forearm). */
  implants: Mesh[];
  attachments: { readonly id: GarmentMeshId; readonly mesh: Mesh; readonly onModel: boolean }[];
  model: OnModel | null;
}

/**
 * Garment add-ons (ADR-0015 `GarmentMeshId`): a shape, its preset, and where it sits on the
 * procedural rig (`rig`, relative to the head or the body) and on an imported model (`model`,
 * metres from the head or upper chest bone in the rig's axes, before the size fit). VRoid hair
 * is bulky, so the helmet on a model is bigger than on the rig's bald egg.
 */
interface AddOn {
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

const ADD_ONS: Readonly<Record<GarmentMeshId, AddOn>> = {
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

/**
 * Garment tints on imported cloth (ADR-0015 E7), as the hue over the cloth's own shading.
 * Null keeps the model's own colours: Seki's jacket and the cargo trousers are what the
 * placeholder models already wear. The procedural rig keeps its preset colours.
 */
export const GARMENT_TINT: Readonly<Record<PaletteKey, string | null>> = {
  "jacket-seki": null,
  cargo: null,
  "jacket-hebi": "#4fa85c",
  "jacket-tessen": "#2f4a6b",
  vest: "#6b7352",
  kevlar: "#56627a",
};

/** Garment slots whose tint recolours a model's cloth of that slot. */
const TINTED: readonly GarmentSlot[] = ["torso", "legs"];

/**
 * Which cloth of the procedural rigs a garment slot dresses (ADR-0036): tops, jackets and coats
 * take the torso tint (with their sleeves), trousers the legs tint. Skin, hair, shoes and
 * cyberware keep their colours.
 */
export const RIG_GARMENT_PRESETS: Readonly<Partial<Record<GarmentSlot, readonly PresetName[]>>> = {
  torso: ["sekiTop", "heroineCoat", "fixerJacket", "gangerHood", "corpoUniform", "umeCoat", "moriCoat", "docCoat"],
  legs: ["sekiPants", "heroineLegs", "fixerPants", "gangerPants"],
};

/** The tint a procedural rig's part takes from a look, or null to keep its preset colour. */
export const rigTintOf = (look: AppearanceDescriptor, preset: PresetName): string | null => {
  for (const slot of TINTED) {
    if (!RIG_GARMENT_PRESETS[slot]?.includes(preset)) continue;
    const key = look.garments[slot]?.tint;
    return key ? GARMENT_TINT[key] : null;
  }
  return null;
};

/**
 * Weapons and garment add-ons a character carries, from its `AppearanceDescriptor`: the
 * active weapon in hand while drawn, the sidearm in the right hip holster, the melee weapon
 * on the left hip and the long gun across the back while not in hand. Garment add-ons sit on
 * the procedural rig's head and body, or on the head and chest bones of the imported model
 * while one is dressed; torso and legs tints recolour the model's cloth. Only the copies in
 * use are enabled, since a hidden mesh still costs a draw call. The rig's built-in box pistol
 * goes once a look arrives. The same class dresses the world's characters and the menu preview.
 */
export class Loadouts {
  private readonly states = new Map<CharacterRig, State>();
  /** Models that arrived before the character's first look. */
  private readonly pending = new Map<CharacterRig, DressedModel>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    private readonly mounts: WeaponMounts,
    private readonly onMeshes: (meshes: AbstractMesh[]) => void,
  ) {}

  set(rig: CharacterRig, look: AppearanceDescriptor, name: string): void {
    let s = this.states.get(rig);
    if (!s) {
      const node = (n: string, x: number, y: number, z: number) => {
        const t = new TransformNode(`${name}-${n}`, this.scene);
        t.parent = rig.body;
        t.position.set(x, y, z);
        return t;
      };
      // Holsters on their own nodes: the rig's gunHip bone is folded to zero while drawn.
      const hip = rig.gunHip?.position ?? { x: 0.165, y: rig.head.position.y * 0.56, z: 0.025 };
      const holsterR = node("holsterR", hip.x, hip.y, hip.z);
      holsterR.rotation.y = Math.PI;
      const holsterL = node("holsterL", -hip.x, hip.y + 0.05, -0.02);
      holsterL.rotation.set(0.15, 0, 0.12);
      // Across the back, muzzle down to the left, like a sling.
      const sling = node("sling", 0, rig.head.position.y * 0.8, -0.15);
      sling.rotation.set(0, 0, 0.7);
      // A hand mount puts the gun's top towards +Z; turned about the barrel, the gun lies flat on the back.
      const back = new TransformNode(`${name}-back`, this.scene);
      back.parent = sling;
      back.rotation.y = Math.PI / 2;
      const stowage = [holsterR, holsterL, sling].map((n) => ({ node: n, at: n.position.clone() }));
      s = { look, name, holsterR, holsterL, back, stowage, mounted: {}, attachments: [], implants: [], model: null };
      this.states.set(rig, s);
      const waiting = this.pending.get(rig);
      this.pending.delete(rig);
      if (waiting) s.model = this.onModel(rig, waiting, name);
    }
    s.look = look;
    for (const box of rig.gunBoxes) box.scaling.setAll(0);
    this.arm(rig, s);
    this.attach(rig, s);
    this.tint(s);
    this.tintRig(rig, s);
    this.implant(rig, s);
  }

  /** The imported model over the rig (or null when it is taken off). Nothing of it is kept. */
  setModel(rig: CharacterRig, model: DressedModel | null): void {
    const s = this.states.get(rig);
    if (!s) {
      if (model) this.pending.set(rig, model);
      else this.pending.delete(rig);
      return;
    }
    if (s.model?.model === model) return;
    this.dropModel(s);
    if (model) s.model = this.onModel(rig, model, s.name);
    this.fitStowage(s);
    this.arm(rig, s);
    this.attach(rig, s);
    this.tint(s);
    this.implant(rig, s);
  }

  has(rig: CharacterRig): boolean {
    return this.states.has(rig);
  }

  /** Garment add-ons on a character, and whether they hang on the imported model's bones. */
  attachments(rig: CharacterRig): { id: GarmentMeshId; onModel: boolean }[] {
    return (this.states.get(rig)?.attachments ?? []).map(({ id, onModel }) => ({ id, onModel }));
  }

  /** Model meshes recoloured by a garment tint right now. */
  tinted(rig: CharacterRig): number {
    return this.states.get(rig)?.model?.tinted.size ?? 0;
  }

  /** Per frame: show each weapon where it currently is. */
  update(rig: CharacterRig): void {
    const s = this.states.get(rig);
    if (!s) return;
    const w = s.look.weapons;
    const drawn = rig.drawn >= 0.5;
    const dressed = (s.model?.hand ?? null) !== null;
    const stowed = (slot: WeaponSlot) => w.active !== slot || !drawn;
    this.show(s.mounted.hand, drawn && !dressed);
    this.show(s.mounted.model, drawn && dressed);
    this.show(s.mounted.hip, stowed("secondary"));
    this.show(s.mounted.hipL, stowed("melee"));
    this.show(s.mounted.back, stowed("primary"));
  }

  dispose(rig: CharacterRig): void {
    this.pending.delete(rig);
    const s = this.states.get(rig);
    if (!s) return;
    for (const m of Object.values(s.mounted)) m?.node.dispose();
    for (const a of s.attachments) a.mesh.dispose();
    s.attachments = [];
    for (const m of s.implants) m.dispose();
    s.implants = [];
    this.dropModel(s);
    s.holsterR.dispose();
    s.holsterL.dispose();
    s.back.parent?.dispose();
    this.states.delete(rig);
  }

  /** Mounts every weapon again, e.g. once weapon models become available. */
  remountAll(): void {
    for (const [rig, s] of this.states) {
      for (const m of Object.values(s.mounted)) m?.node.dispose();
      for (const key of Object.keys(s.mounted) as Place[]) delete s.mounted[key];
      this.arm(rig, s);
    }
  }

  private onModel(rig: CharacterRig, model: DressedModel, name: string): OnModel {
    const hand = new TransformNode(`${name}-bone-hand`, this.scene);
    const held = model.retarget.holdInRightHand(hand, Vector3.Zero());
    if (!held) hand.dispose();
    const anchors: Partial<Record<AnchorBone, TransformNode>> = {};
    for (const bone of ["head", "chest"] as const) {
      const node = model.retarget.anchor(bone, `${name}-bone-${bone}`);
      if (node) anchors[bone] = node;
    }
    // A smaller or taller model gets smaller or bigger add-ons, within reason.
    const ratio = model.retarget.headHeight / (rig.head.position.y || 1);
    const fit = Number.isFinite(ratio) && ratio > 0 ? Math.min(1.25, Math.max(0.8, ratio)) : 1;
    return { model, hand: held ? hand : null, anchors, fit, tinted: new Map() };
  }

  /** Takes everything off the model's bones and gives its cloth its own colours back. */
  private dropModel(s: State): void {
    const m = s.model;
    if (!m) return;
    s.mounted.model?.node.dispose();
    delete s.mounted.model;
    for (const a of s.attachments.filter((x) => x.onModel)) a.mesh.dispose();
    s.attachments = s.attachments.filter((x) => !x.onModel);
    if (m.hand) {
      m.model.retarget.release(m.hand);
      m.hand.dispose();
    }
    for (const node of Object.values(m.anchors)) node?.dispose();
    for (const [mesh, material] of m.tinted) mesh.material = material;
    s.model = null;
  }

  private arm(rig: CharacterRig, s: State): void {
    const w = s.look.weapons;
    this.place(s, "hand", rig.gunHand, w[w.active]);
    this.place(s, "hip", s.holsterR, w.secondary);
    this.place(s, "hipL", s.holsterL, w.melee);
    this.place(s, "back", s.back, w.primary);
    this.place(s, "model", s.model?.hand ?? null, w[w.active]);
  }

  private show(m: Mounted | undefined, on: boolean): void {
    if (m && m.node.isEnabled() !== on) m.node.setEnabled(on);
  }

  /** (Re)mounts the weapon of a place when its look changed. */
  private place(s: State, place: Place, parent: TransformNode | null, look: WeaponLook | null): void {
    const current = s.mounted[place];
    if (current?.look === look && current.node.parent === parent) return;
    current?.node.dispose();
    delete s.mounted[place];
    if (!parent || !look) return;
    const holder = new TransformNode(`${s.name}-${place}-${look}`, this.scene);
    holder.parent = parent;
    holder.setEnabled(false);
    const mounted: Mounted = { look, node: holder };
    s.mounted[place] = mounted;
    const model = MODEL[look];
    if (!model.kind || !this.mounts.has(model.kind)) {
      // Melee weapons and missing models: a plain shape along the forearm axis.
      const box = MeshBuilder.CreateBox(`${holder.name}-box`, { width: 0.03, height: look === "blade" ? 0.62 : look === "baton" ? 0.5 : 0.2, depth: 0.04 }, this.scene);
      box.material = this.materials.get("gun");
      box.parent = holder;
      box.position.y = look === "blade" || look === "baton" ? -0.25 : -0.1;
      box.isPickable = false;
      applyOutline(box);
      this.onMeshes([box]);
      return;
    }
    void this.mounts.mount(holder, model.kind, holder.name, "hand").then((pivot) => {
      if (!pivot || s.mounted[place] !== mounted) return pivot?.dispose();
      pivot.scaling.scaleInPlace(model.scale);
      this.onMeshes(pivot.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0));
    });
  }

  /** Builds the garment add-ons again, on the model's bones while dressed. */
  private attach(rig: CharacterRig, s: State): void {
    for (const a of s.attachments) a.mesh.dispose();
    s.attachments = [];
    for (const garment of Object.values(s.look.garments)) {
      for (const a of garment?.attachments ?? []) {
        const spec = ADD_ONS[a.mesh];
        const anchor = s.model?.anchors[spec.model.bone];
        const mesh = spec.build(this.scene, `${s.name}-${a.mesh}`);
        if (anchor) {
          const size = spec.model.size * s.model!.fit;
          mesh.parent = anchor;
          mesh.position.set(...spec.model.at).scaleInPlace(s.model!.fit);
          mesh.scaling.setAll(size);
        } else {
          const at = spec.rig(rig);
          mesh.parent = at.parent;
          mesh.position.set(...at.at);
          mesh.scaling.setAll(at.size);
        }
        mesh.material = this.materials.get(spec.preset);
        mesh.isPickable = false;
        applyOutline(mesh);
        s.attachments.push({ id: a.mesh, mesh, onModel: anchor !== undefined });
      }
    }
    this.onMeshes(s.attachments.map((a) => a.mesh));
  }

  /**
   * Holsters and the sling hang on the rig body at the rig's proportions; a taller or shorter
   * model moves them by the same ratio as its head height, so the gun stays at its hip.
   */
  private fitStowage(s: State): void {
    const fit = s.model?.fit ?? 1;
    for (const { node, at } of s.stowage) node.position.copyFrom(at).scaleInPlace(fit);
  }

  /** Implants that show (ADR-0015 `implants`): optics glow beside the eyes, arms ring the right forearm. */
  private implant(rig: CharacterRig, s: State): void {
    for (const m of s.implants) m.dispose();
    s.implants = [];
    const shows = new Set(s.look.implants);
    const onModel = s.model;
    if (shows.has("optics")) {
      const head = onModel?.anchors.head ?? rig.head;
      const fit = onModel?.anchors.head ? onModel.fit : 1;
      // A glowing strip at the outer corner of each eye.
      const [x, y, z] = onModel?.anchors.head ? [0.064, 0.072, 0.078] : [0.062, 0.015, 0.045];
      for (const side of [-1, 1]) {
        const lens = MeshBuilder.CreateBox(`${s.name}-optics${side}`, { width: 0.014, height: 0.03, depth: 0.012 }, this.scene);
        lens.parent = head;
        lens.position.set(side * x * fit, y * fit, z * fit);
        lens.rotation.y = side * 0.5;
        lens.scaling.setAll(fit);
        lens.material = this.materials.get("heroineVisor");
        s.implants.push(lens);
      }
    }
    if (shows.has("arms")) {
      // Forearm frame: -Y runs from the elbow to the fingers. On a model the hand holder sits at the wrist.
      const forearm = onModel?.hand ?? rig.elbowR;
      const fit = onModel?.hand ? onModel.fit : 1;
      const along = onModel?.hand ? [0.05, 0.11] : [-0.12, -0.19];
      for (const [i, y] of along.entries()) {
        const ring = MeshBuilder.CreateTorus(`${s.name}-cyberarm${i}`, { diameter: 0.07, thickness: 0.014, tessellation: 14 }, this.scene);
        ring.parent = forearm;
        ring.position.set(0, y * fit, 0);
        ring.scaling.setAll(fit);
        ring.material = this.materials.get("cyberCopper");
        s.implants.push(ring);
      }
    }
    for (const m of s.implants) m.isPickable = false;
    this.onMeshes(s.implants);
  }

  /**
   * The procedural rig wears the tints too (ADR-0036), so a disguise reads on the cast without
   * imported models (phones, the reference frame): its cloth vertices take the garment colour.
   */
  private tintRig(rig: CharacterRig, s: State): void {
    for (const mesh of rig.meshes) recolorSkin(mesh, (preset) => rigTintOf(s.look, preset));
  }

  /** Recolours the model's cloth by the torso and legs tints; the rest keeps its own colours. */
  private tint(s: State): void {
    const m = s.model;
    if (!m) return;
    for (const mesh of m.model.meshes) {
      const src = toonSourceOf(mesh);
      const slot = src?.source.garment;
      const key = slot && TINTED.includes(slot) ? s.look.garments[slot]?.tint : undefined;
      const color = key ? GARMENT_TINT[key] : null;
      const original = m.tinted.get(mesh);
      if (!src || !color || !src.source.texture) {
        if (original !== undefined) {
          mesh.material = original;
          m.tinted.delete(mesh);
        }
        continue;
      }
      if (original === undefined) m.tinted.set(mesh, mesh.material);
      mesh.material = this.materials.forImported(color, src.source.texture, src.preset, { ...src.source, tint: true });
    }
  }
}
