import { Quaternion, TransformNode, Vector3 } from "../babylon";
import type { ModelInstance, ModelLibrary } from "./model-library";

export type WeaponKind = "pistol" | "smg";

/** URLs of the weapon models (glTF/GLB) by kind. */
export type WeaponManifest = Partial<Record<WeaponKind, string>>;

/**
 * Weapon models are authored lying along X (muzzle towards `MUZZLE_X`), top up along Y, and are
 * centred on their bounding box. A mount turns them into the frame of what holds them.
 */
const MUZZLE_X = 1;

/** Rotation that takes the model's X (barrel) and Y (top) onto `barrel` and `top`. */
const orient = (barrel: Vector3, top: Vector3): Quaternion =>
  Quaternion.RotationQuaternionFromAxis(barrel, top, Vector3.Cross(barrel, top));

/** Rig forearm / hand frame: the barrel runs along -Y (elbow to fingers), the top faces +Z. */
const IN_HAND = orient(new Vector3(0, -MUZZLE_X, 0), new Vector3(0, 0, 1));
/** FPP viewmodel frame: the barrel points along +Z (camera forward), top up. */
const IN_VIEW = orient(new Vector3(0, 0, MUZZLE_X), new Vector3(0, 1, 0));

export type MountSpace = "hand" | "view";

/** Where the model's centre sits relative to the holding point (grip in the hand). */
const OFFSET: Record<MountSpace, Vector3> = {
  hand: new Vector3(0, -0.055, 0.03),
  view: new Vector3(0, 0.035, 0.07),
};

/**
 * Loads weapon models once and mounts instances under hands, holsters and the viewmodel. The
 * caller keeps the procedural placeholder until the mount resolves, so a missing or broken
 * file only means the old box pistol.
 */
export class WeaponMounts {
  constructor(
    private readonly library: ModelLibrary,
    private manifest: WeaponManifest = {},
  ) {}

  setManifest(manifest: WeaponManifest): void {
    this.manifest = manifest;
  }

  /** Loads every weapon file of the manifest without mounting it (the loading screen, ADR-0057). */
  preload(): Promise<unknown>[] {
    return Object.values(this.manifest)
      .filter((url): url is string => typeof url === "string")
      .map((url) => this.library.preload({ url, preset: "importedProp", outline: true }));
  }

  has(kind: WeaponKind): boolean {
    return !!this.manifest[kind];
  }

  /** Resolves to the pivot holding the model, or null without a model or once `parent` is gone. */
  async mount(parent: TransformNode, kind: WeaponKind, name: string, space: MountSpace): Promise<TransformNode | null> {
    const url = this.manifest[kind];
    if (!url) return null;
    let model: ModelInstance;
    try {
      model = await this.library.instantiate({ url, preset: "importedProp", outline: true }, name);
    } catch (err: unknown) {
      console.warn(`[weapons] ${url} failed to load`, err);
      return null;
    }
    if (parent.isDisposed()) {
      model.dispose();
      return null;
    }
    const pivot = new TransformNode(`${name}-pivot`, parent.getScene());
    pivot.parent = parent;
    pivot.rotationQuaternion = (space === "hand" ? IN_HAND : IN_VIEW).clone();
    pivot.position.copyFrom(OFFSET[space]);
    model.root.parent = pivot;
    for (const m of model.meshes) m.isPickable = false;
    return pivot;
  }
}
