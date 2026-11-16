import type { EntityId } from "@seki/core";
import { Vector3 } from "../babylon";
import type { CameraRig } from "../camera/camera-rig";
import type { Point } from "../effects/muzzle-state";
import type { GunKind } from "./weapon-mount";

/** A shooter with no gun in a hand (a turret, a drone) flashes like an SMG. */
export const UNHELD_GUN: GunKind = "smg";

/** The characters' guns in hand (`Loadouts.muzzle` through `CharacterViews`). */
export interface MuzzleHolders {
  muzzleOf(id: EntityId, at: Vector3, dir: Vector3): { readonly kind: GunKind; readonly shown: boolean } | null;
}

/**
 * Where a shot leaves the gun: in FPP the viewmodel's muzzle (`CameraRig.muzzlePosition`, the
 * barrel along its holder's +Z), in TPP and for everyone else the muzzle of the gun in the hand.
 */
export class MuzzleSource {
  private readonly at = new Vector3();
  private readonly dir = new Vector3();
  /** Whether the last `place` found the viewmodel's muzzle (FPP), not a hand's. */
  inView = false;

  constructor(
    private readonly camera: CameraRig,
    private readonly holders: MuzzleHolders,
    private readonly isCameraTarget: (id: EntityId) => boolean,
  ) {}

  /**
   * Moves `at` and `dir` (unit) to the shooter's muzzle and barrel as they are now, if a gun of
   * theirs shows; otherwise leaves them. Returns the gun, for the flame's size.
   */
  place(id: EntityId, at: Point, dir: Point): GunKind {
    const { at: p, dir: d } = this;
    const held = this.holders.muzzleOf(id, p, d);
    const inView = this.isCameraTarget(id) ? this.camera.muzzlePosition() : null;
    this.inView = inView !== null;
    if (inView) {
      Vector3.TransformNormalToRef(Vector3.Forward(), this.camera.weaponMount.computeWorldMatrix(true), d);
      p.copyFrom(inView);
    } else if (!held?.shown) return held?.kind ?? UNHELD_GUN;
    d.normalize();
    at.x = p.x;
    at.y = p.y;
    at.z = p.z;
    dir.x = d.x;
    dir.y = d.y;
    dir.z = d.z;
    return held?.kind ?? UNHELD_GUN;
  }
}
