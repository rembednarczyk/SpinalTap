import type { Vector3 } from "../babylon";

/* Data of the two-handed hold (G-282), apart from the solver so that the rig can carry it. */

/**
 * Arm measurements the hold is solved for, in the rig body's frame (metres): the procedural
 * rig's own, or those of the imported model dressed over it, whose arms follow the rig's joint
 * turns but have their own shoulders and lengths.
 */
export interface ArmReach {
  readonly shoulderL: Vector3;
  readonly shoulderR: Vector3;
  /** Shoulder to elbow, elbow to wrist. */
  readonly upper: number;
  readonly fore: number;
  /**
   * Wrist to the middle of the right hand where the fingers close, in the wrist's frame (the
   * hand hanging at rest: -Y to the fingers, +Z the thumb); the left hand mirrors it in X.
   */
  readonly palm: Vector3;
}

/** A point of a weapon file (metres, muzzle along +X, top along +Y). */
export interface GunPoint {
  readonly x: number;
  readonly y: number;
}

/** Where a long gun is held, in its file's frame (G-282). */
export interface TwoHandGrip {
  /** The point the mount hangs the model from (`GRIP`). */
  readonly grip: GunPoint;
  /** Middle of the grip, inside the right fist. */
  readonly fist: GunPoint;
  /** Bottom of the fore-end, on the left palm. */
  readonly fore: GunPoint;
  /** Where the left hand takes the magazine out and puts the next one in (the shotgun's loading port). */
  readonly mag: GunPoint;
  /** Middle of the butt plate (the rear end of a gun without a stock). */
  readonly butt: GunPoint;
  /** The butt goes to the shoulder when aimed; an SMG is held out in front instead. */
  readonly shouldered: boolean;
  /** Turn of the right hand on the grip: fingers down from the barrel (radians), and to its left. */
  readonly pitch: number;
  readonly yaw: number;
}
