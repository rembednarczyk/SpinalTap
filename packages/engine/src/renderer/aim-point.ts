import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { CharacterRig } from "./character-rig";

/*
 * Where the gun points (the user's ask of 17.11): the weapon goes where the crosshair is, so a
 * shot's tracer leaves along the barrel and not at an angle to it. Each figure keeps a point in
 * the world its gun is to point at: the player's is along the look (yaw and pitch, the
 * simulation's aim ray) as far as the last shot went; anyone's is where its last shot went.
 * From it comes the turn, in the root's frame, from straight ahead (where the aimed poses hold
 * the gun) to the point as seen from the right shoulder. The pistol arm and the long gun's pose
 * take it in as far as they are aimed (`character-poses.ts`, `two-hand-hold.ts`).
 */

/** The simulation's eye height (`hitscan.ts`), standing and fully crouched. */
const EYE = 1.62;
const CROUCH_EYE = 1.14;
/** How far along the look the player's gun points before any shot has gone further or nearer. */
const LOOK_DISTANCE = 20;
/** Nearer than this the point would swing the arm round wildly: it is taken this far off. */
const NEAREST = 2;
/** The most the gun turns from straight ahead; past it the body is to turn (the simulation turns it). */
const MOST = (70 * Math.PI) / 180;

interface Aim {
  point: Vector3 | null;
  distance: number;
  turn: Quaternion | null;
}
const aims = new WeakMap<CharacterRig, Aim>();
const aimOf = (rig: CharacterRig): Aim => {
  let a = aims.get(rig);
  if (!a) {
    a = { point: null, distance: LOOK_DISTANCE, turn: null };
    aims.set(rig, a);
  }
  return a;
};

/** A shot of the figure went from `from` to `to` (world): its gun points there now. */
export const aimShot = (rig: CharacterRig, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): void => {
  const a = aimOf(rig);
  a.point = new Vector3(to.x, to.y, to.z);
  a.distance = Math.max(NEAREST, Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z));
};

/** The player's look (the simulation's yaw and pitch, its crouch 0..1): the gun points along it, as far as the last shot went. */
export const aimLook = (rig: CharacterRig, at: { x: number; y: number; z: number }, yaw: number, pitch: number, crouch: number): void => {
  const a = aimOf(rig);
  const eye = EYE + (CROUCH_EYE - EYE) * Math.min(1, Math.max(0, crouch));
  const d = a.distance;
  a.point = new Vector3(at.x + Math.sin(yaw) * Math.cos(pitch) * d, at.y + eye - Math.sin(pitch) * d, at.z + Math.cos(yaw) * Math.cos(pitch) * d);
};

/**
 * The turn from straight ahead to the aim point as seen from the right shoulder, in the root's
 * frame, for this frame (call after the root is placed, before `animateRig`); none without a point.
 */
export const updateAimTurn = (rig: CharacterRig): void => {
  const a = aimOf(rig);
  if (!a.point) {
    a.turn = null;
    return;
  }
  const toRoot = Matrix.Invert(rig.root.computeWorldMatrix(true));
  const p = Vector3.TransformCoordinates(a.point, toRoot);
  const shoulder = new Vector3(rig.armR.position.x, rig.armR.position.y + rig.body.position.y, rig.body.position.z);
  const dir = p.subtract(shoulder);
  if (dir.lengthSquared() < 1e-6) {
    a.turn = null;
    return;
  }
  dir.normalize();
  const q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.Forward(), dir, q);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  a.turn = angle > MOST ? Quaternion.Slerp(Quaternion.Identity(), q, MOST / angle) : q;
};

/** The turn of this frame in the root's frame, or null. */
export const aimTurnOf = (rig: CharacterRig): Quaternion | null => aims.get(rig)?.turn ?? null;

/**
 * The turn of this frame in the body's frame (the body leans and turns under the root), or null.
 * `level` first turns a pose's barrel to straight ahead, when its aimed pose holds it otherwise.
 */
export const bodyAimTurn = (rig: CharacterRig, level: Quaternion | null = null): Quaternion | null => {
  const turn = aimTurnOf(rig);
  if (!turn) return null;
  const b = rig.body;
  const body = b.rotationQuaternion ?? Quaternion.FromEulerAngles(b.rotation.x, b.rotation.y, b.rotation.z);
  const whole = level ? turn.multiply(level) : turn;
  return Quaternion.Inverse(body).multiply(whole).multiply(body);
};
