import type { WeaponLook } from "@seki/core";
import { Vector3 } from "../babylon";
import type { ViewArmsFrame } from "../camera/view-arms";
import { GRIP, LONG_GUN, VIEW_MELEE_TILT, VIEW_SHIFT, WEAPON_MODEL, type WeaponKind } from "./weapon-mount";

/**
 * Where Seki's hands go in first person (`FppHands`): static poses from the bones, no clips yet.
 * A hand is its wrist (the hand bone), the way the forearm runs into it, the way the fingers
 * point from it (to the knuckles) and the way the palm faces, with how far the fingers close.
 */
export interface HandTarget {
  readonly wrist: Vector3;
  readonly fore: Vector3;
  readonly fingers: Vector3;
  readonly palm: Vector3;
  /** 0 open .. 1 a fist (`FingerCurl`). */
  readonly curl: number;
  /** The index finger and the thumb apart (a trigger finger along the frame); the rest's by default. */
  readonly index?: number;
  readonly thumb?: number;
  /** The thumb's root and first knuckle apart (`FingerCurl.apply`): swung round, its last joint straight. */
  readonly thumbRoot?: number;
}

/** Both hands in the camera's frame. */
export interface ArmsTarget {
  readonly right: HandTarget;
  readonly left: HandTarget;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const hand = (wrist: Vector3, fore: Vector3, fingers: Vector3, palm: Vector3, curl: number, index?: number, thumb?: number, thumbRoot?: number): HandTarget => ({
  wrist,
  fore: fore.normalize(),
  fingers: fingers.normalize(),
  palm: palm.normalize(),
  curl,
  ...(index !== undefined ? { index } : {}),
  ...(thumb !== undefined ? { thumb } : {}),
  ...(thumbRoot !== undefined ? { thumbRoot } : {}),
});

/** From the wrist bone to the middle of the palm along the fingers, and from its axis to what the fist holds (Seki at her scale). */
const PALM_REACH = 0.055;
const PALM_DEPTH = 0.035;

/**
 * A hand closing on what is at `at`: the wrist back from it along the fingers and away from it
 * against the palm, so the middle of the fist is on the point.
 */
const grasp = (at: Vector3, fore: Vector3, fingers: Vector3, palm: Vector3, curl: number, index?: number, thumb?: number, thumbRoot?: number): HandTarget => {
  const f = fingers.normalizeToNew();
  const p = palm.normalizeToNew();
  return hand(at.subtract(f.scale(PALM_REACH)).subtract(p.scale(PALM_DEPTH)), fore, f, p, curl, index, thumb, thumbRoot);
};

/**
 * The right hand on a grip, in the viewmodel's frame (the grip at the origin, the barrel along +Z,
 * the top up): high on the backstrap, the web between thumb and index under the bore's line, the
 * palm on the grip's right side and the fingers closed round its front, the index finger laid
 * straight along the frame. Every gun hangs from its grip (`GRIP`), so one pose fits all, the long
 * guns' pistol grips too.
 */
const RIGHT_ON_GRIP = grasp(v(0, 0.012, 0.012), v(-0.2, 0.22, 1), v(0, -0.06, 1), v(-1, 0, 0.05), 0.92, 0.2, 0.95);
/**
 * A handgun (the pistol, the revolver) as the user chose it out of seven rounds (13.11: round 2,
 * commit e17dc2e): the right hand round the grip, the wrist behind and right of it, the palm on
 * the grip's right side, the fingers closing round its front; the left hand under the right fist,
 * palm up and to the right, cupping it. The same from the hip and aimed in.
 * Seated (14.11, the user on PR #537: lower in the fist, not cutting through the hand): the gun
 * hangs `HANDGUN_DEEPER` lower in the view, so the fist closes that much higher up its short grip
 * (round 2's wrist at (0.034, -0.028, -0.075)), and 2 cm further forward, the fingers a little
 * more open round its front, the left hand a little more open under it: no finger of either hand
 * more than 2 mm into the gun (round 2 sank them up to 11 mm through the grip). Read off the
 * skinned hand against each gun's triangles, its own pose for the revolver's rounder grip. The
 * rigid fist's thumb root still sinks into the top of the grip under the web (12 mm, as round 2):
 * laid straight to clear it, the thumb stood up beside the slide.
 */
const HANDGUN_FIST: Readonly<Record<"pistol" | "revolver", HandTarget>> = {
  pistol: hand(v(0.041, -0.012, -0.056), v(-0.22, 0.16, 1), v(-0.12, 0.22, 1), v(-0.995, 0.078, -0.116), 0.8, 0.56),
  revolver: hand(v(0.0417, -0.0181, -0.0608), v(-0.22, 0.16, 1), v(-0.0215, 0.1081, 1.025), v(-0.9981, 0.1163, -0.0137), 0.755, 0.635),
};
const LEFT_UNDER_FIST = hand(v(-0.05, -0.07, -0.031), v(0.4, 0.25, 1), v(0.45, 0.35, 1), v(0.7, 0.7, 0), 0.5);

/**
 * On the rifle's pistol grip the forearm comes in from the right, the elbow out beside the stock,
 * so from the eye it shows by the butt and the wrist turns the back of the hand up.
 */
const RIGHT_ON_RIFLE_GRIP = grasp(v(0.006, 0.012, 0.012), v(-0.45, 0.25, 1), v(0, -0.06, 1), v(-1, 0, 0.05), 0.75, 0.15, 0.7);

/**
 * Melee weapons stand upright in the fist (`IN_VIEW_MELEE`, `VIEW_MELEE_TILT`), at the ready: a
 * full hammer grip, the knuckles across the handle, the thumb towards the tip, the forearm ahead.
 */
const HANDLE = v(0, Math.cos(VIEW_MELEE_TILT), Math.sin(VIEW_MELEE_TILT));
const across = (fore: Vector3): Vector3 => {
  const f = fore.normalizeToNew();
  return f.subtract(HANDLE.scale(Vector3.Dot(f, HANDLE))).normalize();
};
/** The right forearm comes in low and ahead from under the view, the wrist cocked up to hold the weapon upright. */
const RIGHT_FORE_MELEE = v(-0.12, 0.3, 1);
const RIGHT_ON_HANDLE = grasp(v(0, 0, 0), RIGHT_FORE_MELEE, across(v(0, 0, 1)), v(-1, 0, 0), 1, 1, 0.8);
/** The sword's handle takes both fists (`shirasaya`): the left a fist's width under the right, at the pommel. */
const LEFT_FORE_MELEE = v(0.3, 0.3, 1);
const LEFT_ON_POMMEL = grasp(HANDLE.scale(-0.1), LEFT_FORE_MELEE, across(LEFT_FORE_MELEE), v(1, 0, 0), 1, 1, 0.8);

/** With the baton the left hand hangs low, under the view (camera frame). */
const LEFT_DOWN = hand(v(-0.24, -0.46, 0.18), v(0.1, 0.25, 1), v(0.1, 0.1, 1), v(1, 0, 0), 0.4);

/**
 * In first person the left hand reaches this much further along the rifle's long fore-end (file
 * metres): further from the eye, it stays in the frame aimed in deep zoom on a phone, where the
 * weapon sits low (`fitPose`).
 */
const FORE_REACH: Partial<Record<WeaponKind, number>> = { rifle: 0.06 };
/** The left forearm comes up to the rifle's fore-end steeply from below, its end (the elbow) under the frame. */
const FORE_ARM: Partial<Record<WeaponKind, Vector3>> = { rifle: v(0.2, 1.1, 1) };

/**
 * The left hand on a long gun's fore-end (`LONG_GUN`), the point the TPP hold puts the palm on,
 * read in the viewmodel's frame like the grip (`VIEW_SHIFT`): from the left side and under, palm
 * up and in, so the hand shows beside the fore-end from the eye.
 */
const leftOnForeEnd = (look: WeaponLook): HandTarget | null => {
  const kind = WEAPON_MODEL[look].kind;
  const hold = kind ? LONG_GUN[kind] : undefined;
  if (!kind || !hold) return null;
  const scale = WEAPON_MODEL[look].scale;
  const z = (hold.fore.x + (FORE_REACH[kind] ?? 0) - GRIP[kind].x - VIEW_SHIFT.x) * scale;
  const y = (hold.fore.y - GRIP[kind].y - VIEW_SHIFT.y) * scale;
  return grasp(v(-0.012, y + 0.005, z), FORE_ARM[kind] ?? v(0.4, 0.25, 1), v(0.35, 0.05, 1), v(1, 0.5, 0), 0.75, 0.6, 0.4);
};

/** `t` from the viewmodel's frame into the camera's. */
const intoCamera = (t: HandTarget, frame: { readonly position: Vector3; readonly turn: (d: Vector3) => Vector3 }): HandTarget => ({
  wrist: frame.turn(t.wrist).addInPlace(frame.position),
  fore: frame.turn(t.fore),
  fingers: frame.turn(t.fingers),
  palm: frame.turn(t.palm),
  curl: t.curl,
  ...(t.index !== undefined ? { index: t.index } : {}),
  ...(t.thumb !== undefined ? { thumb: t.thumb } : {}),
  ...(t.thumbRoot !== undefined ? { thumbRoot: t.thumbRoot } : {}),
});

/**
 * The hands with the weapon in the viewmodel, `turn` and `position` its frame in the camera's. A
 * handgun (and an empty hand, posed as the pistol) in the right fist with the left under it, from
 * the hip and aimed in (`HANDGUN_FIST`, `LEFT_UNDER_FIST`).
 */
export const weaponHands = (look: WeaponLook | null, frame: { readonly position: Vector3; readonly turn: (d: Vector3) => Vector3 }): ArmsTarget => {
  const melee = look === "baton" || look === "blade";
  const fore = look && !melee ? leftOnForeEnd(look) : null;
  const right = intoCamera(melee ? RIGHT_ON_HANDLE : look === "rifle" ? RIGHT_ON_RIFLE_GRIP : fore ? RIGHT_ON_GRIP : HANDGUN_FIST[look === "revolver" ? "revolver" : "pistol"], frame);
  if (look === "blade") return { right, left: intoCamera(LEFT_ON_POMMEL, frame) };
  if (melee) return { right, left: LEFT_DOWN };
  return { right, left: intoCamera(fore ?? LEFT_UNDER_FIST, frame) };
};

/** Forearm length of the procedural choke arms (`choke-arms.ts`), whose elbows the model's hands follow. */
const CHOKE_FOREARM = 0.26;

/**
 * The hands in a takedown grab: on the forearms the camera's choke arms place (the right across
 * the throat, palm in; the left up on the back of the head, palm forward).
 */
export const chokeHands = (choke: NonNullable<ViewArmsFrame["choke"]>): ArmsTarget => {
  const at = (f: { readonly elbow: Vector3; readonly dir: Vector3 }) => f.elbow.add(f.dir.scale(CHOKE_FOREARM));
  return {
    right: hand(at(choke.right), choke.right.dir.clone(), choke.right.dir.clone(), v(0.1, 0.3, -1), 0.55),
    left: hand(at(choke.left), choke.left.dir.clone(), choke.left.dir.add(v(0, 0.3, 0)), v(0, -0.2, 1), 0.35),
  };
};
