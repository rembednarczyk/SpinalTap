import type { AppearanceDescriptor, PaletteKey } from "@seki/core";
import type { AbstractMesh } from "../babylon";
import { GarmentAssets, type SkinnedGarmentId, type WornGarment, isSkinnedGarment } from "./garment-assets";

/** What a look asks of the skinned garments: each one with the tint of its slot's garment. */
export const skinnedGarmentsOf = (look: AppearanceDescriptor): { readonly id: SkinnedGarmentId; readonly tint: PaletteKey | null }[] =>
  Object.values(look.garments).flatMap((g) => (g?.attachments ?? []).flatMap((a) => (isSkinnedGarment(a.mesh) ? [{ id: a.mesh, tint: g?.tint ?? null }] : [])));

interface Wearer {
  meshes: readonly AbstractMesh[] | null;
  readonly worn: Map<SkinnedGarmentId, WornGarment>;
  /** Garments on their way (the file loading), so a look set twice asks once. */
  readonly coming: Set<SkinnedGarmentId>;
  wanted: Map<SkinnedGarmentId, string | null>;
}

/**
 * The skinned garments (ADR-0086) of every character with an imported model, a part of `Loadouts`:
 * they follow the look and the model, arrive when their file has loaded, and go with the model.
 * Characters without a model (the procedural rig) wear none.
 */
export class GarmentWear {
  private readonly wearers = new Map<object, Wearer>();

  constructor(
    private readonly assets: GarmentAssets,
    /** The colour of a garment tint (`GARMENT_TINT`), or null for the garment's own. */
    private readonly tintOf: (key: PaletteKey) => string | null,
    private readonly onMeshes: (meshes: AbstractMesh[]) => void,
  ) {}

  /** The character's look and model meshes now (null: no model); garments come and go to match. */
  sync(who: object, name: string, look: AppearanceDescriptor, meshes: readonly AbstractMesh[] | null): void {
    let w = this.wearers.get(who);
    if (!w) {
      if (!meshes) return;
      w = { meshes, worn: new Map(), coming: new Set(), wanted: new Map() };
      this.wearers.set(who, w);
    }
    if (w.meshes !== meshes) this.takeOffAll(w);
    w.meshes = meshes;
    w.wanted = new Map(meshes ? skinnedGarmentsOf(look).map((g) => [g.id, g.tint ? this.tintOf(g.tint) : null] as const) : []);
    for (const [id, worn] of [...w.worn]) {
      if (w.wanted.has(id)) continue;
      this.assets.takeOff(worn);
      w.worn.delete(id);
    }
    for (const [id, tint] of w.wanted) {
      const worn = w.worn.get(id);
      if (worn) {
        this.repaint(worn, tint);
        this.assets.follow(worn);
      }
      else if (meshes && !w.coming.has(id)) this.bring(who, w, id, name, meshes);
    }
    if (!meshes && w.coming.size === 0) this.wearers.delete(who);
  }

  /** The skinned garments a character wears now. */
  worn(who: object): SkinnedGarmentId[] {
    return [...(this.wearers.get(who)?.worn.keys() ?? [])];
  }

  /** The garment's mesh on a character, if worn. */
  meshOf(who: object, id: SkinnedGarmentId): AbstractMesh | null {
    return this.wearers.get(who)?.worn.get(id)?.mesh ?? null;
  }

  /** Everything off, the character gone. */
  drop(who: object): void {
    const w = this.wearers.get(who);
    if (!w) return;
    this.takeOffAll(w);
    w.meshes = null;
    w.wanted.clear();
    this.wearers.delete(who);
  }

  /** Resolves once every garment on its way has arrived (tests). */
  async settled(): Promise<void> {
    while ([...this.wearers.values()].some((w) => w.coming.size > 0)) await new Promise((r) => setTimeout(r, 0));
  }

  private bring(who: object, w: Wearer, id: SkinnedGarmentId, name: string, meshes: readonly AbstractMesh[]): void {
    w.coming.add(id);
    void this.assets
      .wear(id, meshes, name, w.wanted.get(id) ?? null)
      .then((worn) => {
        w.coming.delete(id);
        if (!worn) return;
        // The model, the look or the character may have changed while the file loaded.
        if (this.wearers.get(who) !== w || w.meshes !== meshes || !w.wanted.has(id) || w.worn.has(id)) {
          this.assets.takeOff(worn);
          return;
        }
        this.repaint(worn, w.wanted.get(id) ?? null);
        w.worn.set(id, worn);
        this.onMeshes(GarmentAssets.meshesOf(worn));
      })
      .catch(() => w.coming.delete(id));
  }

  private repaint(worn: WornGarment, tint: string | null): void {
    void this.assets.template(worn.id).then((t) => {
      if (t && !worn.mesh.isDisposed()) this.assets.paint(worn.mesh, t, tint);
    });
  }

  private takeOffAll(w: Wearer): void {
    for (const worn of w.worn.values()) this.assets.takeOff(worn);
    w.worn.clear();
  }
}
