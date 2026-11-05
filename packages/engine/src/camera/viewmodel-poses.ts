import type { WeaponLook } from "@seki/core";

export interface ViewmodelPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Where the FPP hand sits for a weapon, from the eye in camera space, and where its muzzle is from the hand. */
export interface ViewmodelPose {
  readonly hip: ViewmodelPoint;
  /**
   * Aimed down sights (ADR-0019): centred and pulled in, the top of the weapon a little under the
   * eye line (G-275), so its far end stays more than 3 degrees below the crosshair.
   */
  readonly ads: ViewmodelPoint;
  /** Tracer start in FPP. */
  readonly muzzle: ViewmodelPoint;
}

const PISTOL: ViewmodelPose = {
  hip: { x: 0.2, y: -0.22, z: 0.62 },
  ads: { x: 0, y: -0.118, z: 0.4 },
  muzzle: { x: 0, y: 0.04, z: 0.17 },
};

/**
 * One pose per weapon model and size (G-282): the hand holds an SMG mid-body with its top 0.16 m
 * above the hand, and a rifle is the same model half as large again, so a long gun aimed with the
 * pistol's pose covered the whole circle round the crosshair.
 */
const POSES: Readonly<Partial<Record<WeaponLook, ViewmodelPose>>> = {
  pistol: PISTOL,
  revolver: { hip: PISTOL.hip, ads: { x: 0, y: -0.124, z: 0.4 }, muzzle: { x: 0, y: 0.04, z: 0.18 } },
  smg: { hip: { x: 0.2, y: -0.25, z: 0.6 }, ads: { x: 0, y: -0.205, z: 0.42 }, muzzle: { x: 0, y: 0.14, z: 0.28 } },
  shotgun: { hip: { x: 0.21, y: -0.27, z: 0.58 }, ads: { x: 0, y: -0.258, z: 0.45 }, muzzle: { x: 0, y: 0.18, z: 0.35 } },
  rifle: { hip: { x: 0.21, y: -0.28, z: 0.56 }, ads: { x: 0, y: -0.28, z: 0.46 }, muzzle: { x: 0, y: 0.2, z: 0.38 } },
};

/** The pose for a weapon in hand; melee weapons and an empty hand take the pistol's. */
export const viewmodelPose = (look: WeaponLook | null): ViewmodelPose => (look ? POSES[look] : undefined) ?? PISTOL;
