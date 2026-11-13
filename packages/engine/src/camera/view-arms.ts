import type { WeaponLook } from "@seki/core";
import type { TransformNode, Vector3 } from "../babylon";

/** One forearm in the camera's frame (metres: +X right, +Y up, +Z ahead): its elbow and the way it points. */
export interface Forearm {
  readonly elbow: Vector3;
  readonly dir: Vector3;
}

/** What the FPP arms follow in a frame, after the camera rig has placed the viewmodel. */
export interface ViewArmsFrame {
  /** The viewmodel (a child of the camera) with the weapon in hand; null when it is out of view. */
  readonly viewmodel: TransformNode | null;
  /** The weapon in hand (null: an empty hand, posed as the pistol). */
  readonly look: WeaponLook | null;
  /** Both forearms on a grabbed target's neck (ADR-0075), or null outside a takedown grab. */
  readonly choke: { readonly right: Forearm; readonly left: Forearm } | null;
}

/**
 * Seki's own arms in first person, posed after the viewmodel each frame (the renderer's part,
 * `FppHands`). `pose` returns true while they are there to be drawn: the camera then hides its
 * procedural forearms, which stand in until her model has loaded and without models.
 */
export interface ViewArms {
  pose(frame: ViewArmsFrame | null): boolean;
}
