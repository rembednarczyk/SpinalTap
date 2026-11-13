import { FOV_REFERENCE_ASPECT, type WeaponLook, verticalFov } from "@seki/core";

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
  /** Aimed in, if not `low`: a long gun's right fist may go under the frame then, its left hand on the fore-end not. */
  readonly adsLow?: { readonly y: number; readonly z: number };
  /** From the hip the muzzle turns this much (radians) in towards the view's centre, so the eye looks along the gun, not at its side. */
  readonly yaw?: number;
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
  // From the hip both hands show: the gun out on the right, far enough for the eye to see past the
  // stock to the right fist on the grip, its forearm coming in from the frame's corner, the butt
  // going out under it towards the shoulder, the barrel ahead, turned a little in.
  rifle: {
    hip: { x: 0.2, y: -0.17, z: 0.5 },
    ads: { x: 0, y: -0.22, z: 0.44 },
    muzzle: { x: 0, y: 0.096, z: 0.53 },
    top: 0.17,
    low: { y: -0.03, z: 0.03 },
    // Aimed, the left hand's lowest knuckles, a little over the grip's height and well ahead of it.
    adsLow: { y: 0.04, z: 0.26 },
    yaw: 0.04,
  },
  // Melee weapons stand where the pistol does, the fist on the handle; the sword's second fist lower, at the pommel.
  baton: { ...PISTOL, low: { y: -0.08, z: 0 } },
  blade: { ...PISTOL, low: { y: -0.13, z: -0.09 } },
};

/** The pose for a weapon in hand; an empty hand takes the pistol's. */
export const viewmodelPose = (look: WeaponLook | null): ViewmodelPose => (look ? POSES[look] : undefined) ?? PISTOL;

/** The hands' lowest point stays this far inside the frame's bottom edge (a share of its half height). */
const MARGIN = 0.96;
/**
 * Aimed in, the weapon goes at most this much further out to keep the hands in the frame. Deep in
 * the DMR's zoom on a phone, little more would show of the left hand, and the weapon would shrink.
 */
const ADS_REACH = 1.3;

/**
 * The tangents of half the vertical field of view the viewmodel is drawn with (FPP hands, round
 * 3), its own and fixed: from the hip that of the default hip view (`horizontal`, ADR-0049) on the
 * screen, aimed in that of a 16:9 screen, if wider. The aim zoom, the sprint and the field of view
 * in the settings change the world's view, not the weapon's: zoomed in, the weapon and the hands
 * stay as big on the screen. A phone, wider than 16:9, sees less up and down: aimed in, the weapon
 * low under the crosshair, its view widens to a desktop's, so the weapon shows as on a desktop.
 */
export const viewmodelView = (aspect: number, horizontal: number): { readonly hip: number; readonly aimed: number } => {
  const hip = Math.tan(verticalFov(horizontal, aspect) / 2);
  return { hip, aimed: Math.max(hip, Math.tan(verticalFov(horizontal, FOV_REFERENCE_ASPECT) / 2)) };
};

/**
 * How much the viewmodel's space shrinks across the view (x and y; depth stays) to draw it with
 * its own field of view through the camera's: `tanCamera` and `tanView` are the tangents of half
 * their vertical angles. A point (x, y, z) shows on the screen at x / (z tan): scaled by their
 * ratio, it shows where the viewmodel's own projection would put it, on the same pass, with the
 * same multisampling and ink lines, and no draw call more.
 */
export const viewmodelScale = (tanCamera: number, tanView: number): number => tanCamera / tanView;

/**
 * The pose fitted to the viewmodel's frame (`tanHip`, `tanAds`: `viewmodelView`). From the hip the weapon rises
 * until the pose's `low` point is in the frame. Aimed in, the line of its sights keeps its angle
 * under the crosshair in the world (G-275): the view zooms by `zoomed` (`viewmodelScale` at full
 * aim) and the weapon does not, so the line drops by as much on the screen; then, if the hands
 * would leave the frame, the weapon goes further out along that line (by at most `ADS_REACH`).
 */
export const fitPose = (pose: ViewmodelPose, tanHip: number, tanAds: number, zoomed = 1): { hip: ViewmodelPoint; ads: ViewmodelPoint } => {
  const { hip, low, top } = pose;
  const aimedLow = pose.adsLow ?? low;
  const floor = -(hip.z + low.z) * tanHip * MARGIN - low.y;
  const fitHip = hip.y >= floor ? hip : { ...hip, y: floor };
  const t = tanAds * MARGIN;
  const slope = (pose.ads.y + top) / pose.ads.z / Math.min(1, Math.max(0.05, zoomed));
  const ads = { ...pose.ads, y: slope * pose.ads.z - top };
  if (slope + t <= 0) return { hip: fitHip, ads };
  const z = Math.min(ads.z * ADS_REACH, Math.max(ads.z, (top - aimedLow.y - t * aimedLow.z) / (slope + t)));
  return { hip: fitHip, ads: z === ads.z ? ads : { x: ads.x, y: slope * z - top, z } };
};
