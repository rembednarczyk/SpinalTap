import { Quaternion, TransformNode, Vector3 } from "../babylon";
import type { WeaponLook } from "@seki/core";
import type { ModelInstance, ModelLibrary } from "./model-library";
import type { TwoHandGrip } from "./two-hand-grip";

export type WeaponKind = "pistol" | "revolver" | "smg" | "shotgun" | "rifle";

/**
 * Weapon model and size for a look, in hand and in the FPP viewmodel alike; melee weapons are
 * simple shapes for now. Every gun has its own file (G-282); the DMR shares the rifle's look.
 */
export const WEAPON_MODEL: Readonly<Record<WeaponLook, { readonly kind: WeaponKind | null; readonly scale: number }>> = {
  pistol: { kind: "pistol", scale: 1 },
  revolver: { kind: "revolver", scale: 1 },
  smg: { kind: "smg", scale: 1 },
  shotgun: { kind: "shotgun", scale: 1 },
  rifle: { kind: "rifle", scale: 1 },
  baton: { kind: null, scale: 1 },
  blade: { kind: null, scale: 1 },
};

/** URLs of the weapon models (glTF/GLB) by kind. */
export type WeaponManifest = Partial<Record<WeaponKind, string>>;

/**
 * Weapon files lie along X with the muzzle at +X and the top up along Y, centred on their bounding
 * box (tools/obj2glb.py). The glTF loader's root turns the right-handed file into Babylon's frame
 * by mirroring X, so under the root the muzzle points to -X. A mount turns that into the frame of
 * what holds the gun.
 */
const MUZZLE_X = -1;

/** Rotation that takes the model's +X and +Y (top) onto `x` and `top`; the muzzle, at `MUZZLE_X`, follows. */
const orient = (x: Vector3, top: Vector3): Quaternion => Quaternion.RotationQuaternionFromAxis(x, top, Vector3.Cross(x, top));

/** Rig forearm / hand frame: the barrel runs along -Y (elbow to fingers), the top faces +Z. */
const IN_HAND = orient(new Vector3(0, -MUZZLE_X, 0), new Vector3(0, 0, 1));
/** FPP viewmodel frame: the barrel points along +Z (camera forward), top up. */
const IN_VIEW = orient(new Vector3(0, 0, MUZZLE_X), new Vector3(0, 1, 0));

export type MountSpace = "hand" | "view";

/**
 * Where the hand closes on each model (G-282): the front of the grip, under the back of the trigger
 * guard, in the file's frame (metres at file size, muzzle at +X).
 * The model hangs from this point, so the hand holds the grip of every gun at any size.
 */
export const GRIP: Readonly<Record<WeaponKind, { readonly x: number; readonly y: number }>> = {
  pistol: { x: -0.055, y: -0.03 },
  revolver: { x: -0.075, y: -0.03 },
  smg: { x: -0.115, y: -0.02 },
  shotgun: { x: -0.205, y: -0.03 },
  rifle: { x: -0.115, y: -0.015 },
};

/** The grip sits this much further back and lower in the viewmodel (file frame), where the hand is a ball. */
const VIEW_SHIFT = { x: -0.015, y: -0.005 };

/**
 * Long guns go in both hands (G-282): the right fist round the middle of the grip, the left palm
 * under the fore-end, the butt at the shoulder when aimed. Points read off each file's
 * cross-sections. The shotgun's grip is the wrist of its stock, so the hand comes up to it from
 * below; the SMG has no stock and is held out in front.
 */
export const LONG_GUN: Readonly<Partial<Record<WeaponKind, TwoHandGrip>>> = {
  smg: { grip: GRIP.smg, fist: { x: -0.15, y: -0.04 }, fore: { x: 0.07, y: 0.057 }, mag: { x: 0.01, y: -0.11 }, butt: { x: -0.2, y: 0.1 }, shouldered: false, pitch: 0.15, yaw: 0.25 },
  shotgun: { grip: GRIP.shotgun, fist: { x: -0.19, y: -0.005 }, fore: { x: 0.17, y: 0.003 }, mag: { x: -0.03, y: -0.01 }, butt: { x: -0.37, y: -0.05 }, shouldered: true, pitch: -0.6, yaw: 0.9 },
  rifle: { grip: GRIP.rifle, fist: { x: -0.15, y: -0.045 }, fore: { x: 0.085, y: 0.048 }, mag: { x: 0.01, y: -0.13 }, butt: { x: -0.4, y: 0.03 }, shouldered: true, pitch: 0.2, yaw: 0.3 },
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
    // The pivot sits on the holding point and carries the turn and the size; the grip node under
    // it moves the model so that its grip is on that point.
    const pivot = new TransformNode(`${name}-pivot`, parent.getScene());
    pivot.parent = parent;
    pivot.rotationQuaternion = (space === "hand" ? IN_HAND : IN_VIEW).clone();
    const grip = new TransformNode(`${name}-grip`, parent.getScene());
    grip.parent = pivot;
    const shift = space === "view" ? VIEW_SHIFT : { x: 0, y: 0 };
    grip.position.set(-MUZZLE_X * (GRIP[kind].x + shift.x), -(GRIP[kind].y + shift.y), 0);
    model.root.parent = grip;
    for (const m of model.meshes) m.isPickable = false;
    return pivot;
  }
}
