import type { WeaponLook } from "@seki/core";
import { Vector3 } from "../babylon";
import type { ViewArmsFrame } from "../camera/view-arms";
import { GRIP, LONG_GUN, VIEW_MELEE_TILT, VIEW_SHIFT, WEAPON_MODEL } from "./weapon-mount";

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
}

/** Both hands in the camera's frame. */
export interface ArmsTarget {
  readonly right: HandTarget;
  readonly left: HandTarget;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const hand = (wrist: Vector3, fore: Vector3, fingers: Vector3, palm: Vector3, curl: number): HandTarget => ({
  wrist,
  fore: fore.normalize(),
  fingers: fingers.normalize(),
  palm: palm.normalize(),
  curl,
});

/**
 * The right hand round the grip, in the viewmodel's frame (the grip at the origin, the barrel
 * along +Z, the top up): the wrist behind and right of it, the palm on the grip's right side, the
 * fingers closing round its front. Every gun is held at its grip (`GRIP`), so one pose fits all.
 */
const RIGHT_ON_GRIP = hand(v(0.034, -0.028, -0.075), v(-0.22, 0.16, 1), v(-0.12, 0.22, 1), v(-1, 0, -0.1), 0.85);

/** The left hand under the right fist with a pistol: palm up and to the right, cupping it. */
const LEFT_UNDER_FIST = hand(v(-0.05, -0.085, -0.05), v(0.4, 0.25, 1), v(0.45, 0.35, 1), v(0.7, 0.7, 0), 0.6);

/** The right fist round a baton's or blade's handle, which rises up and forward from it. */
const RIGHT_ON_HANDLE = hand(v(0.03, 0.025, -0.045), v(-0.2, 0.05, 1), v(0, -Math.sin(VIEW_MELEE_TILT), Math.cos(VIEW_MELEE_TILT)), v(-1, 0, 0), 1);

/** With a melee weapon the left hand hangs low, under the view (camera frame). */
const LEFT_DOWN = hand(v(-0.24, -0.46, 0.18), v(0.1, 0.25, 1), v(0.1, 0.1, 1), v(1, 0, 0), 0.4);

/**
 * The left hand under a long gun's fore-end (`LONG_GUN`): the point the TPP hold puts the palm
 * on, read in the viewmodel's frame like the grip (`VIEW_SHIFT`), the palm up under it.
 */
const leftOnForeEnd = (look: WeaponLook): HandTarget | null => {
  const kind = WEAPON_MODEL[look].kind;
  const hold = kind ? LONG_GUN[kind] : undefined;
  if (!kind || !hold) return null;
  const scale = WEAPON_MODEL[look].scale;
  const z = (hold.fore.x - GRIP[kind].x - VIEW_SHIFT.x) * scale;
  const y = (hold.fore.y - GRIP[kind].y - VIEW_SHIFT.y) * scale;
  return hand(v(-0.03, y - 0.05, z - 0.075), v(0.45, 0.2, 1), v(0.5, 0.15, 1), v(0.15, 1, 0), 0.55);
};

/** `t` from the viewmodel's frame into the camera's. */
const intoCamera = (t: HandTarget, frame: { readonly position: Vector3; readonly turn: (d: Vector3) => Vector3 }): HandTarget => ({
  wrist: frame.turn(t.wrist).addInPlace(frame.position),
  fore: frame.turn(t.fore),
  fingers: frame.turn(t.fingers),
  palm: frame.turn(t.palm),
  curl: t.curl,
});

/** The hands with the weapon in the viewmodel, `turn` and `position` its frame in the camera's. */
export const weaponHands = (look: WeaponLook | null, frame: { readonly position: Vector3; readonly turn: (d: Vector3) => Vector3 }): ArmsTarget => {
  const melee = look === "baton" || look === "blade";
  const right = intoCamera(melee ? RIGHT_ON_HANDLE : RIGHT_ON_GRIP, frame);
  if (melee) return { right, left: LEFT_DOWN };
  const fore = look ? leftOnForeEnd(look) : null;
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
