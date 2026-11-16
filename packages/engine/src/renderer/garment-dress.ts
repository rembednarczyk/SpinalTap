import type { AppearanceDescriptor, GarmentMeshId, PaletteKey } from "@seki/core";
import type { AbstractMesh, Mesh, Scene, TransformNode } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./characters";
import { ADD_ONS } from "./garment-addons";
import { type GarmentAssets, type SkinnedGarmentId, isSkinnedGarment } from "./garment-assets";
import { GarmentWear } from "./garment-wear";
import type { AnchorBone } from "./model-rig";

/** What of a dressed model the garments need: its meshes, its bone anchors and its size against the rig's. */
export interface GarmentModel {
  readonly meshes: readonly AbstractMesh[];
  readonly anchors: Partial<Record<AnchorBone, TransformNode>>;
  readonly fit: number;
}

interface Attached {
  readonly id: GarmentMeshId;
  readonly mesh: Mesh;
  readonly onModel: boolean;
}

/**
 * The garments a character wears, a part of `Loadouts` (ADR-0031): the rigid add-ons on the
 * procedural rig's head and body or the model's bones, the shells of the model's own cloth
 * (the vest, G-870) and the skinned garment assets on the model's skeleton (ADR-0086).
 */
export class GarmentDresser {
  private readonly attached = new Map<CharacterRig, Attached[]>();
  /** Skinned garments on the imported models (ADR-0086). */
  private readonly wear: GarmentWear;

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    private readonly onMeshes: (meshes: AbstractMesh[]) => void,
    assets: GarmentAssets,
    tintOf: (key: PaletteKey) => string | null,
  ) {
    this.wear = new GarmentWear(assets, tintOf, onMeshes);
  }

  /** Builds the character's garments again for its look, on the model while one is dressed. */
  dress(rig: CharacterRig, name: string, look: AppearanceDescriptor, model: GarmentModel | null): void {
    this.attach(rig, name, look, model);
    this.wear.sync(rig, name, look, model?.meshes ?? null);
  }

  /** Takes off what hangs on the model (it is about to go); the rest stays on the rig. */
  dropModel(rig: CharacterRig): void {
    const list = this.attached.get(rig) ?? [];
    for (const a of list.filter((x) => x.onModel)) a.mesh.dispose();
    this.attached.set(
      rig,
      list.filter((x) => !x.onModel),
    );
  }

  /** Everything off, the character gone. */
  dispose(rig: CharacterRig): void {
    for (const a of this.attached.get(rig) ?? []) a.mesh.dispose();
    this.attached.delete(rig);
    this.wear.drop(rig);
  }

  /** Garment add-ons on a character, and whether they hang on the imported model's bones. */
  attachments(rig: CharacterRig): { id: GarmentMeshId; onModel: boolean }[] {
    return (this.attached.get(rig) ?? []).map(({ id, onModel }) => ({ id, onModel }));
  }

  /** Skinned garments (ADR-0086) on the character's model now; they arrive once their file has loaded. */
  garments(rig: CharacterRig): SkinnedGarmentId[] {
    return this.wear.worn(rig);
  }

  /** Resolves once the skinned garments on their way have arrived (tests). */
  settled(): Promise<void> {
    return this.wear.settled();
  }

  /** The rigid add-ons and shells, on the model's bones and cloth while dressed. */
  private attach(rig: CharacterRig, name: string, look: AppearanceDescriptor, model: GarmentModel | null): void {
    for (const a of this.attached.get(rig) ?? []) a.mesh.dispose();
    const list: Attached[] = [];
    this.attached.set(rig, list);
    for (const garment of Object.values(look.garments)) {
      for (const a of garment?.attachments ?? []) {
        if (isSkinnedGarment(a.mesh)) continue;
        const spec = ADD_ONS[a.mesh];
        const meshName = `${name}-${a.mesh}`;
        // A shell of the model's cloth is skinned with it and already in place.
        const shell = model && spec.shell ? spec.shell(this.scene, meshName, model.meshes, rig.body) : null;
        const anchor = shell ? undefined : model?.anchors[spec.model.bone];
        const mesh = shell ?? spec.build(this.scene, meshName);
        if (anchor) {
          const size = spec.model.size * model!.fit;
          mesh.parent = anchor;
          mesh.position.set(...spec.model.at).scaleInPlace(model!.fit);
          mesh.scaling.setAll(size);
        } else if (!shell) {
          const at = spec.rig(rig);
          mesh.parent = at.parent;
          mesh.position.set(...at.at);
          mesh.scaling.setAll(at.size);
        }
        mesh.material = this.materials.get(spec.preset);
        mesh.isPickable = false;
        applyOutline(mesh);
        list.push({ id: a.mesh, mesh, onModel: shell !== null || anchor !== undefined });
      }
    }
    this.onMeshes(list.map((a) => a.mesh));
  }
}
