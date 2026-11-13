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
  /** Height of the sights over the grip (the top of the slide, the front sight): aimed in, they keep their place. */
  readonly top: number;
  /** The lowest point of the hands from the grip that should stay in the frame (`fitPose`; y down, z ahead). */
  readonly low: { readonly y: number; readonly z: number };
}

const PISTOL: ViewmodelPose = {
  hip: { x: 0.2, y: -0.22, z: 0.62 },
  ads: { x: 0, y: -0.118, z: 0.4 },
  muzzle: { x: 0, y: 0.07, z: 0.18 },
  top: 0.09,
  // Both fists round the grip, the left's underside.
  low: { y: -0.06, z: 0 },
};

/**
 * One pose per weapon model (G-282). The hand holds each gun at its grip (`GRIP` in
 * weapon-mount.ts), so the muzzle sits where the file's barrel ends, and the longer and taller the
 * gun above the hand, the lower it is aimed: the tall front sight of the rifle stands 0.17 m above
 * the grip, the pistol's slide 0.09 m.
 */
const POSES: Readonly<Partial<Record<WeaponLook, ViewmodelPose>>> = {
  pistol: PISTOL,
  revolver: { ...PISTOL, ads: { x: 0, y: -0.14, z: 0.4 }, muzzle: { x: 0, y: 0.076, z: 0.225 }, top: 0.105 },
  // The long guns keep the left hand on the fore-end in the frame (`LONG_GUN`); the right one's grip may go under it.
  smg: { hip: { x: 0.2, y: -0.25, z: 0.6 }, ads: { x: 0, y: -0.2, z: 0.42 }, muzzle: { x: 0, y: 0.103, z: 0.34 }, top: 0.15, low: { y: 0, z: 0.19 } },
  shotgun: { hip: { x: 0.21, y: -0.25, z: 0.5 }, ads: { x: 0, y: -0.18, z: 0.45 }, muzzle: { x: 0, y: 0.092, z: 0.595 }, top: 0.13, low: { y: -0.04, z: 0.37 } },
  rifle: { hip: { x: 0.21, y: -0.27, z: 0.5 }, ads: { x: 0, y: -0.22, z: 0.44 }, muzzle: { x: 0, y: 0.096, z: 0.53 }, top: 0.17, low: { y: -0.03, z: 0.215 } },
  // Melee weapons stand where the pistol does, the fist on the handle; the sword's second fist lower, at the pommel.
  baton: { ...PISTOL, low: { y: -0.08, z: 0 } },
  blade: { ...PISTOL, low: { y: -0.13, z: -0.09 } },
};

/** The pose for a weapon in hand; an empty hand takes the pistol's. */
export const viewmodelPose = (look: WeaponLook | null): ViewmodelPose => (look ? POSES[look] : undefined) ?? PISTOL;

/** The hands' lowest point stays this far inside the frame's bottom edge (a share of its half height). */
const MARGIN = 0.96;
/** Aimed in, the weapon goes at most this much further out to keep the hands in the frame. */
const ADS_REACH = 2.4;

/**
 * The pose fitted to the screen (13.11): the horizontal field of view is fixed (ADR-0049), so a
 * screen wider than 16:9, a phone's, sees less up and down, and the hands under the weapon left
 * the frame. `tanHip` and `tanAds` are the tangents of half the vertical field of view from the
 * hip and fully aimed. From the hip the weapon rises until the pose's `low` point is in the frame;
 * aimed in, it goes further out along the line of its sights, which keeps their place on the
 * screen, so the crosshair stays as clear as it was; the zoom narrows the view too, so this moves
 * the aimed weapons on a 16:9 screen as well (by at most `ADS_REACH`). From the hip on 16:9 the
 * guns stand as they were.
 */
export const fitPose = (pose: ViewmodelPose, tanHip: number, tanAds: number): { hip: ViewmodelPoint; ads: ViewmodelPoint } => {
  const { hip, ads, low, top } = pose;
  const floor = -(hip.z + low.z) * tanHip * MARGIN - low.y;
  const fitHip = hip.y >= floor ? hip : { ...hip, y: floor };
  const t = tanAds * MARGIN;
  const slope = (ads.y + top) / ads.z;
  if (slope + t <= 0) return { hip: fitHip, ads };
  const z = Math.min(ads.z * ADS_REACH, Math.max(ads.z, (top - low.y - t * low.z) / (slope + t)));
  return { hip: fitHip, ads: z === ads.z ? ads : { x: ads.x, y: slope * z - top, z } };
};
