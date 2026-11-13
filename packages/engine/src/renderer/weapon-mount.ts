import { Quaternion, TransformNode, Vector3 } from "../babylon";
import type { WeaponLook } from "@seki/core";
import type { ModelInstance, ModelLibrary } from "./model-library";
import type { TwoHandGrip } from "./two-hand-grip";

export type WeaponKind = "pistol" | "revolver" | "smg" | "shotgun" | "rifle" | MeleeKind;
export type MeleeKind = "baton" | "blade";

/**
 * Weapon model and size for a look, in hand and in the FPP viewmodel alike. Every gun has its own
 * file (G-282); the DMR shares the rifle's look. The baton and the blade have theirs too.
 */
export const WEAPON_MODEL: Readonly<Record<WeaponLook, { readonly kind: WeaponKind | null; readonly scale: number }>> = {
  pistol: { kind: "pistol", scale: 1 },
  revolver: { kind: "revolver", scale: 1 },
  smg: { kind: "smg", scale: 1 },
  shotgun: { kind: "shotgun", scale: 1 },
  rifle: { kind: "rifle", scale: 1 },
  baton: { kind: "baton", scale: 1 },
  blade: { kind: "blade", scale: 1 },
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
 * Melee weapon files lie like the guns: the tip along +X, the back (the blade's spine) up along
 * +Y (tools/melee_obj.py). `handle` is the angle of the handle's axis (pommel to guard) from the
 * file's X: the curved blade's handle drops 17 degrees from the chord the file was laid along.
 * Mounted, the handle runs along the forearm like a barrel; the hand's holder then cocks it
 * across the fist by the pose's wrist angle (melee-poses.ts).
 */
export const MELEE_HOLD: Readonly<Record<MeleeKind, { readonly handle: number }>> = {
  baton: { handle: 0 },
  blade: { handle: -0.2976 },
};

export const isMeleeKind = (kind: WeaponKind): kind is MeleeKind => kind in MELEE_HOLD;

/**
 * FPP: the melee weapon rises from the fist, its tip this far (radians) from straight up towards
 * the view: at the ready, upright and a little back over the shoulder (round 4).
 */
export const VIEW_MELEE_TILT = -0.2;
/** The tip up, the back towards the eye, so the edge faces what the view looks at. */
const IN_VIEW_MELEE = orient(new Vector3(0, -Math.cos(VIEW_MELEE_TILT), -Math.sin(VIEW_MELEE_TILT)), new Vector3(0, Math.sin(VIEW_MELEE_TILT), -Math.cos(VIEW_MELEE_TILT)));

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
  // The middle of the fist: the baton's rubber grip above its pommel, the blade's handle a fist under the collar.
  baton: { x: -0.164, y: 0 },
  blade: { x: -0.306, y: 0.014 },
};

/** The grip sits this much further back and lower in the viewmodel (file frame), where the hand is a ball. */
export const VIEW_SHIFT = { x: -0.015, y: -0.005 };

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
 * Turns a melee model so that its handle lies along the file's X (where a gun's barrel is) and
 * moves it so that the middle of the fist on the handle is on the holding point.
 */
const placeHandle = (grip: TransformNode, kind: MeleeKind): void => {
  // Under the glTF root the file's X is mirrored, so the handle's angle turns the other way round.
  const turn = Quaternion.RotationAxis(new Vector3(0, 0, 1), MELEE_HOLD[kind].handle);
  grip.rotationQuaternion = turn;
  const at = new Vector3(MUZZLE_X * GRIP[kind].x, GRIP[kind].y, 0).applyRotationQuaternion(turn);
  grip.position.copyFrom(at.scale(-1));
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
    const melee = isMeleeKind(kind);
    pivot.rotationQuaternion = (space === "hand" ? IN_HAND : melee ? IN_VIEW_MELEE : IN_VIEW).clone();
    const grip = new TransformNode(`${name}-grip`, parent.getScene());
    grip.parent = pivot;
    if (melee) placeHandle(grip, kind);
    else {
      const shift = space === "view" ? VIEW_SHIFT : { x: 0, y: 0 };
      grip.position.set(-MUZZLE_X * (GRIP[kind].x + shift.x), -(GRIP[kind].y + shift.y), 0);
    }
    model.root.parent = grip;
    for (const m of model.meshes) m.isPickable = false;
    return pivot;
  }
}
