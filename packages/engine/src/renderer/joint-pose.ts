import type { CharacterRig } from "./character-rig";

/**
 * A whole-body pose as joint targets of the rig (ADR-0075): the knockout poses (G-449) and the
 * takedown grab's clips are made of these, laid over the walk animation before a dressed model
 * follows the rig. Only the rig's joints, so a ragdoll (stage 4) can take the place of a clip
 * without the views noticing. Angles in radians, offsets of the rig body in metres.
 */
export interface JointPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
  readonly thighL: number;
  readonly thighR: number;
  readonly kneeL: number;
  readonly kneeR: number;
  readonly armLX: number;
  readonly armLZ: number;
  /** The upper arms' twist about their own length; 0 in the knockout poses. */
  readonly armLY: number;
  readonly armRX: number;
  readonly armRZ: number;
  readonly armRY: number;
  readonly elbowL: number;
  readonly elbowR: number;
  readonly headX: number;
  readonly headY: number;
}

const POSE_KEYS = ["x", "y", "z", "pitch", "yaw", "roll", "thighL", "thighR", "kneeL", "kneeR", "armLX", "armLZ", "armLY", "armRX", "armRZ", "armRY", "elbowL", "elbowR", "headX", "headY"] as const satisfies readonly (keyof JointPose)[];

export type MutablePose = { -readonly [K in keyof JointPose]: number };

export const blankPose = (): MutablePose => ({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, armLX: 0, armLZ: 0, armLY: 0, armRX: 0, armRZ: 0, armRY: 0, elbowL: 0, elbowR: 0, headX: 0, headY: 0 });

/** Mixes into `out`, reused every frame for every body: the pose is applied before the next one is mixed. */
export const mixPose = (a: JointPose, b: JointPose, t: number, out: MutablePose): JointPose => {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

/** Lays `p` over the rig's current joints with weight `w`; the fingers go towards `fist` (0 open .. 1 a fist). */
export const applyPose = (rig: CharacterRig, p: JointPose, w: number, fist = 0): void => {
  const mix = (from: number, to: number) => from + (to - from) * w;
  rig.body.position.set(mix(rig.body.position.x, p.x), mix(rig.body.position.y, p.y), mix(rig.body.position.z, p.z));
  rig.body.rotation.set(mix(rig.body.rotation.x, p.pitch), mix(rig.body.rotation.y, p.yaw), mix(rig.body.rotation.z, p.roll));
  rig.legL.rotation.x = mix(rig.legL.rotation.x, p.thighL);
  rig.legR.rotation.x = mix(rig.legR.rotation.x, p.thighR);
  rig.legL.rotation.y = mix(rig.legL.rotation.y, 0);
  rig.legR.rotation.y = mix(rig.legR.rotation.y, 0);
  // The poses keep the knees together; the crouch's spread (G-512) gives way like the long-gun turn above.
  rig.legL.rotation.z = mix(rig.legL.rotation.z, 0);
  rig.legR.rotation.z = mix(rig.legR.rotation.z, 0);
  rig.kneeL.rotation.x = mix(rig.kneeL.rotation.x, p.kneeL);
  rig.kneeR.rotation.x = mix(rig.kneeR.rotation.x, p.kneeR);
  rig.armL.rotation.x = mix(rig.armL.rotation.x, p.armLX);
  rig.armL.rotation.z = mix(rig.armL.rotation.z, p.armLZ);
  rig.armL.rotation.y = mix(rig.armL.rotation.y, p.armLY);
  rig.armR.rotation.x = mix(rig.armR.rotation.x, p.armRX);
  rig.armR.rotation.z = mix(rig.armR.rotation.z, p.armRZ);
  rig.armR.rotation.y = mix(rig.armR.rotation.y, p.armRY);
  rig.elbowL.rotation.x = mix(rig.elbowL.rotation.x, p.elbowL);
  rig.elbowR.rotation.x = mix(rig.elbowR.rotation.x, p.elbowR);
  rig.head.rotation.x = mix(rig.head.rotation.x, p.headX);
  rig.head.rotation.y = mix(rig.head.rotation.y, p.headY);
  rig.fist[0] = mix(rig.fist[0], fist);
  rig.fist[1] = mix(rig.fist[1], fist);
};
