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
}

/** Both hands in the camera's frame. */
export interface ArmsTarget {
  readonly right: HandTarget;
  readonly left: HandTarget;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const hand = (wrist: Vector3, fore: Vector3, fingers: Vector3, palm: Vector3, curl: number, index?: number, thumb?: number): HandTarget => ({
  wrist,
  fore: fore.normalize(),
  fingers: fingers.normalize(),
  palm: palm.normalize(),
  curl,
  ...(index !== undefined ? { index } : {}),
  ...(thumb !== undefined ? { thumb } : {}),
});

/** From the wrist bone to the middle of the palm along the fingers, and from its axis to what the fist holds (Seki at her scale). */
const PALM_REACH = 0.055;
const PALM_DEPTH = 0.035;

/**
 * A hand closing on what is at `at`: the wrist back from it along the fingers and away from it
 * against the palm, so the middle of the fist is on the point.
 */
const grasp = (at: Vector3, fore: Vector3, fingers: Vector3, palm: Vector3, curl: number, index?: number, thumb?: number): HandTarget => {
  const f = fingers.normalizeToNew();
  const p = palm.normalizeToNew();
  return hand(at.subtract(f.scale(PALM_REACH)).subtract(p.scale(PALM_DEPTH)), fore, f, p, curl, index, thumb);
};

/**
 * The right hand on a grip, in the viewmodel's frame (the grip at the origin, the barrel along +Z,
 * the top up): high on the backstrap, the web between thumb and index under the bore's line, the
 * palm on the grip's right side and the fingers closed round its front, the index finger laid
 * straight along the frame. Every gun hangs from its grip (`GRIP`), so one pose fits all, the long
 * guns' pistol grips too.
 */
const RIGHT_ON_GRIP = grasp(v(0, 0.012, 0.012), v(-0.2, 0.22, 1), v(0, -0.06, 1), v(-1, 0, 0.05), 0.85, 0.2, 0.85);

/**
 * On the rifle's pistol grip the forearm comes in from the right, the elbow out beside the stock,
 * so from the eye it shows by the butt and the wrist turns the back of the hand up.
 */
const RIGHT_ON_RIFLE_GRIP = grasp(v(0.006, 0.012, 0.012), v(-0.45, 0.25, 1), v(0, -0.06, 1), v(-1, 0, 0.05), 0.75, 0.15, 0.7);

/** The left hand round the right one with a pistol: palm on the grip's left side, fingers over the right's. */
const LEFT_ROUND_FIST = grasp(v(-0.018, 0.0, 0.004), v(0.45, 0.2, 1), v(0.55, -0.12, 1), v(1, 0.15, 0), 0.9, 0.9, 0.35);

/**
 * Melee weapons stand in the fist (`IN_VIEW_MELEE`) along `VIEW_MELEE_TILT`: a full hammer grip,
 * the knuckles across the handle, the thumb towards the tip, the handle carrying the forearm's
 * line on up and forward.
 */
const HANDLE = v(0, Math.cos(VIEW_MELEE_TILT), Math.sin(VIEW_MELEE_TILT));
const across = (fore: Vector3): Vector3 => {
  const f = fore.normalizeToNew();
  return f.subtract(HANDLE.scale(Vector3.Dot(f, HANDLE))).normalize();
};
/** The right forearm runs on in the handle's line, steeply up from under the view, the wrist cocked to hold it. */
const RIGHT_FORE_MELEE = v(-0.08, 0.5, 1);
const RIGHT_ON_HANDLE = grasp(v(0, 0, 0), RIGHT_FORE_MELEE, across(v(0, 0, 1)), v(-1, 0, 0), 1, 1, 0.8);
/** The sword's handle takes both fists (`shirasaya`): the left a fist's width under the right, at the pommel. */
const LEFT_FORE_MELEE = v(0.3, 0.3, 1);
const LEFT_ON_POMMEL = grasp(HANDLE.scale(-0.1), LEFT_FORE_MELEE, across(LEFT_FORE_MELEE), v(1, 0, 0), 1, 1, 0.8);

/** With a one-handed melee weapon (the baton) the left hand hangs low, under the view (camera frame). */
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
});

/** The hands with the weapon in the viewmodel, `turn` and `position` its frame in the camera's. */
export const weaponHands = (look: WeaponLook | null, frame: { readonly position: Vector3; readonly turn: (d: Vector3) => Vector3 }): ArmsTarget => {
  const melee = look === "baton" || look === "blade";
  const right = intoCamera(melee ? RIGHT_ON_HANDLE : look === "rifle" ? RIGHT_ON_RIFLE_GRIP : RIGHT_ON_GRIP, frame);
  if (look === "blade") return { right, left: intoCamera(LEFT_ON_POMMEL, frame) };
  if (melee) return { right, left: LEFT_DOWN };
  const fore = look ? leftOnForeEnd(look) : null;
  return { right, left: intoCamera(fore ?? LEFT_ROUND_FIST, frame) };
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
