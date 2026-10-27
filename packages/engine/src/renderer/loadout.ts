import type { AppearanceDescriptor, WeaponLook, WeaponSlot } from "@seki/core";
import { type AbstractMesh, MeshBuilder, type Scene, TransformNode } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./characters";
import type { MountSpace, WeaponKind, WeaponMounts } from "./weapon-mount";

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

type Place = "hand" | "hip" | "back" | "model";

interface Mounted {
  readonly look: WeaponLook;
  readonly node: TransformNode;
}

interface State {
  look: AppearanceDescriptor;
  readonly back: TransformNode;
  readonly mounted: Partial<Record<Place, Mounted>>;
  attachments: AbstractMesh[];
  /** Holder in an imported model's hand, set while the character is dressed. */
  modelHand: TransformNode | null;
}

/** Garment attachment meshes on the rig (ADR-0015 `GarmentMeshId`). */
const ATTACH: Readonly<Record<string, { size: [number, number, number]; preset: PresetName; at: (rig: CharacterRig) => [TransformNode, number, number, number] }>> = {
  visor: { size: [0.15, 0.03, 0.03], preset: "heroineVisor", at: (r) => [r.head, 0, 0.015, 0.075] },
  helmet: { size: [0.21, 0.13, 0.23], preset: "gangerHood", at: (r) => [r.head, 0, 0.085, -0.005] },
  "vest-plate": { size: [0.26, 0.24, 0.05], preset: "cyberDark", at: (r) => [r.body, 0, r.head.position.y * 0.81, 0.12] },
};

/**
 * Weapons and garment add-ons a character carries, from its `AppearanceDescriptor`: the
 * active weapon in hand while drawn, the sidearm in the hip holster and the long gun across
 * the back while not in hand. Only the copies in use are enabled, since a hidden mesh still
 * costs a draw call. The rig's built-in box pistol goes once a look arrives.
 */
export class Loadouts {
  private readonly states = new Map<CharacterRig, State>();
  /** Model-hand holders that arrived before the character's first look. */
  private readonly pendingHands = new Map<CharacterRig, TransformNode>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    private readonly mounts: WeaponMounts,
    private readonly onMeshes: (meshes: AbstractMesh[]) => void,
  ) {}

  set(rig: CharacterRig, look: AppearanceDescriptor, name: string): void {
    let s = this.states.get(rig);
    if (!s) {
      const sling = new TransformNode(`${name}-sling`, this.scene);
      sling.parent = rig.body;
      // Across the back, muzzle down to the left, like a sling.
      sling.position.set(0, rig.head.position.y * 0.8, -0.15);
      sling.rotation.set(0, 0, 0.7);
      // A hand mount puts the gun's top towards +Z; turned about the barrel, the gun lies flat on the back.
      const back = new TransformNode(`${name}-back`, this.scene);
      back.parent = sling;
      back.rotation.y = Math.PI / 2;
      s = { look, back, mounted: {}, attachments: [], modelHand: this.pendingHands.get(rig) ?? null };
      this.pendingHands.delete(rig);
      this.states.set(rig, s);
    }
    s.look = look;
    for (const box of rig.gunBoxes) box.scaling.setAll(0);
    const w = look.weapons;
    this.place(s, "hand", rig.gunHand, w[w.active], "hand", name);
    this.place(s, "hip", rig.gunHip, w.secondary, "hand", name);
    this.place(s, "back", s.back, w.primary, "hand", name);
    if (s.modelHand) this.place(s, "model", s.modelHand, w[w.active], "hand", name);
    this.attach(rig, s, name);
  }

  /** The holder in a dressed character's model hand (or null when undressed). */
  setModelHand(rig: CharacterRig, holder: TransformNode | null, name: string): void {
    const s = this.states.get(rig);
    if (!s) {
      if (holder) this.pendingHands.set(rig, holder);
      else this.pendingHands.delete(rig);
      return;
    }
    s.mounted.model?.node.dispose();
    delete s.mounted.model;
    s.modelHand = holder;
    if (holder) this.place(s, "model", holder, s.look.weapons[s.look.weapons.active], "hand", name);
  }

  has(rig: CharacterRig): boolean {
    return this.states.has(rig);
  }

  /** Per frame: show each weapon where it currently is. */
  update(rig: CharacterRig, dressed: boolean): void {
    const s = this.states.get(rig);
    if (!s) return;
    const w = s.look.weapons;
    const drawn = rig.drawn >= 0.5;
    const stowed = (slot: WeaponSlot) => w.active !== slot || !drawn;
    this.show(s.mounted.hand, drawn && !dressed);
    this.show(s.mounted.model, drawn && dressed);
    this.show(s.mounted.hip, stowed("secondary"));
    this.show(s.mounted.back, stowed("primary"));
  }

  dispose(rig: CharacterRig): void {
    const s = this.states.get(rig);
    if (!s) return;
    for (const m of Object.values(s.mounted)) m?.node.dispose();
    for (const a of s.attachments) a.dispose();
    s.back.parent?.dispose();
    this.states.delete(rig);
  }

  private show(m: Mounted | undefined, on: boolean): void {
    if (m && m.node.isEnabled() !== on) m.node.setEnabled(on);
  }

  /** (Re)mounts the weapon of a place when its look changed. */
  private place(s: State, place: Place, parent: TransformNode | null, look: WeaponLook | null, space: MountSpace, name: string): void {
    const current = s.mounted[place];
    if (current?.look === look) return;
    current?.node.dispose();
    delete s.mounted[place];
    if (!parent || !look) return;
    const holder = new TransformNode(`${name}-${place}-${look}`, this.scene);
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
    void this.mounts.mount(holder, model.kind, holder.name, space).then((pivot) => {
      if (!pivot || s.mounted[place] !== mounted) return pivot?.dispose();
      pivot.scaling.scaleInPlace(model.scale);
      this.onMeshes(pivot.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0));
    });
  }

  /** Mounts every weapon again, e.g. once weapon models become available. */
  remountAll(names: ReadonlyMap<CharacterRig, string>): void {
    for (const [rig, s] of this.states) {
      for (const m of Object.values(s.mounted)) m?.node.dispose();
      for (const key of Object.keys(s.mounted) as Place[]) delete s.mounted[key];
      this.set(rig, s.look, names.get(rig) ?? rig.root.name);
    }
  }

  private attach(rig: CharacterRig, s: State, name: string): void {
    for (const a of s.attachments) a.dispose();
    s.attachments = [];
    for (const garment of Object.values(s.look.garments)) {
      for (const a of garment?.attachments ?? []) {
        const spec = ATTACH[a.mesh];
        if (!spec) continue;
        const [parent, x, y, z] = spec.at(rig);
        const mesh = MeshBuilder.CreateBox(`${name}-${a.mesh}`, { width: spec.size[0], height: spec.size[1], depth: spec.size[2] }, this.scene);
        mesh.material = this.materials.get(spec.preset);
        mesh.parent = parent;
        mesh.position.set(x, y, z);
        mesh.isPickable = false;
        applyOutline(mesh);
        s.attachments.push(mesh);
      }
    }
    this.onMeshes(s.attachments);
  }
}
