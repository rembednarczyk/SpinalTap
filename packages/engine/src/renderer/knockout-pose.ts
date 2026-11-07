import type { CharacterRig } from "./character-rig";
import { crouchOffset } from "./character-animation";
import { smooth } from "./character-poses";
import { type JointPose, applyPose, blankPose, mixPose } from "./joint-pose";

/**
 * A body knocked out by a takedown (ADR-0065, `Transform.unconscious`): it slumps to its knees
 * and onto its chest, lies still where it fell (it does not sink like the dead), rises again when
 * woken and hangs over the carrier's shoulder while carried. Laid over the walk animation and the
 * activity pose, before a dressed model follows the rig. The poses are joint targets of the rig
 * only, so a ragdoll can take the place of `limpPose` without the views noticing.
 */

/** Seconds from standing to lying, and from lying back on the feet. */
export const KNOCKOUT_FALL = 1;
export const KNOCKOUT_RISE = 1.4;
/** Seconds to swing a lying body onto the shoulder, or off it. */
export const CARRY_SWING = 0.35;
/** Where a takedown grab's choke or kill hands the body over to the fall (ADR-0075): on the knees, the whole pose laid over the walk. */
export const KNOCKOUT_HANDOFF = 0.5;
/** Height of the chest over the ground lying prone, metres at the build of 1.74 m. */
const CHEST_DEPTH = 0.06;
/** How far the body tips over lying (a little short of flat: the head is turned on its cheek). */
const PRONE = 1.5;
/** Torso hanging head down behind the carrier: its axis from the hips, down and back. */
const HANG = 2.5;
/** Over the shoulder, not through it: the belly rests on top of it. */
const SHOULDER_TOP = 0.1;

/** The carrier's shoulder the body hangs over, in the body's own root frame (it shares the carrier's place and yaw). */
export interface Shoulder {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

type Limp = JointPose;

const FALL_MIX = blankPose();
const CARRY_MIX = blankPose();

/** On the knees, slumped forward, the head dropped and the arms hanging. */
const kneeling = (rig: CharacterRig): Limp => {
  const lean = 0.45;
  const drop = crouchOffset(rig, -0.1, 1.5, lean).y;
  return { x: 0, y: drop, z: 0, pitch: lean, yaw: 0, roll: 0, thighL: -0.1 - lean, thighR: -0.15 - lean, kneeL: 1.5, kneeR: 1.45, armLX: 0.1 - lean, armLZ: -0.12, armLY: 0, armRX: 0.05 - lean, armRZ: 0.12, armRY: 0, elbowL: -0.15, elbowR: -0.1, headX: 0.45, headY: 0 };
};

/** Prone on the chest, the hips over where it stood, the cheek on the ground, one knee drawn. */
const prone = (rig: CharacterRig): Limp => {
  const s = rig.legL.position.y / 0.92;
  return {
    x: 0,
    y: CHEST_DEPTH * s,
    z: -rig.legL.position.y,
    pitch: PRONE,
    yaw: 0,
    roll: 0,
    thighL: 0,
    thighR: 0.05,
    kneeL: 0.1,
    kneeR: 0.3,
    armLX: -0.15,
    armLZ: -0.35,
    armLY: 0,
    armRX: -0.15,
    armRZ: 1.9,
    armRY: 0,
    elbowL: -0.05,
    elbowR: -0.6,
    headX: -0.2,
    headY: 1.1,
  };
};

/**
 * Over the carrier's shoulder: turned to face her back, the hips on top of the shoulder, the
 * torso and the arms hanging down behind her, the legs down in front.
 */
const overShoulder = (rig: CharacterRig, at: Shoulder): Limp => {
  const hip = rig.legL.position.y;
  // The rig body turns by yaw π, then pitch HANG: the hips at (0, hip, 0) land at
  // (0, hip cos HANG, -hip sin HANG) from its origin, which is moved so they rest on the shoulder.
  return {
    x: at.x,
    y: at.y + SHOULDER_TOP - hip * Math.cos(HANG),
    z: at.z + hip * Math.sin(HANG),
    pitch: HANG,
    yaw: Math.PI,
    roll: 0,
    thighL: 0.3 - HANG,
    thighR: 0.4 - HANG,
    kneeL: 0.3,
    kneeR: 0.2,
    armLX: -0.1 - HANG,
    armLZ: 0.15,
    armLY: 0,
    armRX: -0.2 - HANG,
    armRZ: -0.1,
    armRY: 0,
    elbowL: -0.25,
    elbowR: -0.15,
    headX: 0.3,
    headY: 0.2,
  };
};

/** Where the fall stands at `k` (0 on the feet .. 1 lying): the knees give first, then the body goes over. */
const limpPose =(rig: CharacterRig, k: number): Limp => mixPose(kneeling(rig), prone(rig), smooth(Math.min(1, Math.max(0, (k - 0.35) / 0.65))), FALL_MIX);

/** The shoulder a body hung over last: it swings down from there when put down. */
const lastShoulder = new WeakMap<CharacterRig, Shoulder>();

/** Spawned already knocked out (a chunk streaming in, a load): lying at once, no fall to watch. */
export const settleKnockout = (rig: CharacterRig, unconscious: boolean, shoulder: Shoulder | null): void => {
  rig.knockout = unconscious ? 1 : 0;
  rig.carried = unconscious && shoulder ? 1 : 0;
  if (shoulder) lastShoulder.set(rig, shoulder);
};

/**
 * Eases the fall (or the getting up) and the swing onto the shoulder (or off it), then lays the
 * pose over the rig. Nothing happens to a conscious rig at rest.
 */
export const animateKnockout = (rig: CharacterRig, dt: number, unconscious: boolean, shoulder: Shoulder | null): void => {
  const k = unconscious ? Math.min(1, rig.knockout + dt / KNOCKOUT_FALL) : Math.max(0, rig.knockout - dt / KNOCKOUT_RISE);
  rig.knockout = k;
  const carry = unconscious && shoulder !== null;
  rig.carried = carry ? Math.min(1, rig.carried + dt / CARRY_SWING) : Math.max(0, rig.carried - dt / CARRY_SWING);
  if (shoulder) lastShoulder.set(rig, shoulder);
  if (k <= 0 && rig.carried <= 0) return;
  const held = shoulder ?? lastShoulder.get(rig) ?? null;
  const pose = held && rig.carried > 0 ? mixPose(limpPose(rig, k), overShoulder(rig, held), smooth(rig.carried), CARRY_MIX) : limpPose(rig, k);
  // The walk gives way within the first half of the fall; the shape of the fall itself is the slump.
  applyPose(rig, pose, Math.max(smooth(Math.min(1, k / 0.5)), rig.carried));
};
