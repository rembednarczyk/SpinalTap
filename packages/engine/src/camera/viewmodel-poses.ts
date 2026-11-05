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
  muzzle: { x: 0, y: 0.07, z: 0.18 },
};

/**
 * One pose per weapon model (G-282). The hand holds each gun at its grip (`GRIP` in
 * weapon-mount.ts), so the muzzle sits where the file's barrel ends, and the longer and taller the
 * gun above the hand, the lower it is aimed: the tall front sight of the rifle stands 0.17 m above
 * the grip, the pistol's slide 0.09 m.
 */
const POSES: Readonly<Partial<Record<WeaponLook, ViewmodelPose>>> = {
  pistol: PISTOL,
  revolver: { hip: PISTOL.hip, ads: { x: 0, y: -0.14, z: 0.4 }, muzzle: { x: 0, y: 0.076, z: 0.225 } },
  smg: { hip: { x: 0.2, y: -0.25, z: 0.6 }, ads: { x: 0, y: -0.2, z: 0.42 }, muzzle: { x: 0, y: 0.103, z: 0.34 } },
  shotgun: { hip: { x: 0.21, y: -0.25, z: 0.5 }, ads: { x: 0, y: -0.18, z: 0.45 }, muzzle: { x: 0, y: 0.092, z: 0.595 } },
  rifle: { hip: { x: 0.21, y: -0.27, z: 0.5 }, ads: { x: 0, y: -0.22, z: 0.44 }, muzzle: { x: 0, y: 0.096, z: 0.53 } },
};

/** The pose for a weapon in hand; melee weapons and an empty hand take the pistol's. */
export const viewmodelPose = (look: WeaponLook | null): ViewmodelPose => (look ? POSES[look] : undefined) ?? PISTOL;
