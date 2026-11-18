import { Quaternion, Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyFrame } from "./body-sample";
import { RIG_LEG, poseLeg, swing, turnTowards } from "./leg-pose";

/*
 * Laying a body clip's frame on the rig (ADR-0090): the torso turned about the hips, the head, the
 * legs from the clip's joints and the arms along its directions, each `w` of the way from the pose
 * underneath. Shared by the idle and the hit (`body-pose.ts`) and the activities (`activity-clips.ts`).
 */

export const rotationOf = (node: CharacterRig["body"]): Quaternion => node.rotationQuaternion ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);
const dir = (a: readonly number[], i: number): Vector3 => new Vector3(a[i]!, a[i + 1]!, a[i + 2]!);

/** One arm along the clip's upper arm, forearm and hand (directions in the chest's frame), `w` of the way. */
export const poseArm = (arm: CharacterRig["armL"], elbow: CharacterRig["elbowL"], wrist: CharacterRig["wristL"], a: readonly number[], at: number, w: number): void => {
  if (w <= 0) return;
  const upper = swing(dir(a, at));
  const toUpper = Quaternion.Inverse(upper);
  const lower = swing(dir(a, at + 3).applyRotationQuaternion(toUpper));
  const hand = swing(dir(a, at + 6).applyRotationQuaternion(toUpper).applyRotationQuaternion(Quaternion.Inverse(lower)));
  turnTowards(arm, upper, w);
  turnTowards(elbow, lower, w);
  turnTowards(wrist, hand, w);
};

/**
 * Turns the body `w` of the way to `q` about the hips (the body's origin is at the feet), and moves
 * the hips by `by` (leg lengths). Returns the sideways part, which the caller keeps track of.
 */
export const turnAboutHips = (rig: CharacterRig, q: Quaternion, w: number, by: Vector3): number => {
  const b = rig.body;
  const hip = new Vector3(0, rig.legL.position.y, 0);
  const before = hip.applyRotationQuaternion(rotationOf(b));
  turnTowards(b, q, w);
  const after = hip.applyRotationQuaternion(rotationOf(b));
  return shiftHips(b, by.add(before.subtract(after).scale(1 / RIG_LEG)));
};

/** Moves the hips by `by` (leg lengths): y and z on the procedural rig's, set anew each frame; x is returned for the caller to keep track of. */
const shiftHips = (b: CharacterRig["body"], by: Vector3): number => {
  b.position.y += by.y * RIG_LEG;
  b.position.z += by.z * RIG_LEG;
  return by.x * RIG_LEG;
};

/**
 * A pose clip's frame on the rig, `w` of the way, the arms `arms` (left, right) of that. With
 * `sideways` the hips' shift to the side is returned for the caller to track (the body's x is set
 * by nothing else); without, it is left out.
 */
export const layPose = (rig: CharacterRig, f: BodyFrame, w: number, arms: readonly [number, number], sideways: boolean): number => {
  const b = rig.body;
  const by = f.hips.scale(w);
  if (!sideways) by.x = 0;
  const x = turnAboutHips(rig, f.chest.multiply(rotationOf(b)), w, by);
  turnTowards(rig.head, f.head.multiply(rotationOf(rig.head)), w);
  const unlean = Quaternion.Inverse(rotationOf(b));
  poseLeg(rig.legL, rig.kneeL, [...f.legs], 0, w, unlean, 1);
  poseLeg(rig.legR, rig.kneeR, [...f.legs], 12, w, unlean, 1);
  poseArm(rig.armL, rig.elbowL, rig.wristL, f.arms, 0, w * arms[0]);
  poseArm(rig.armR, rig.elbowR, rig.wristR, f.arms, 9, w * arms[1]);
  return x;
};

/** A number 0..1 of the figure's own, from its name: the same figure the same each time, a crowd spread out. */
export const figureSeed = (rig: CharacterRig): number => {
  // FNV-1a, then the bits mixed (names that differ in one letter, “npc-12” and “npc-13”, land far apart).
  let h = 0x811c9dc5;
  for (const c of rig.root.name) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
