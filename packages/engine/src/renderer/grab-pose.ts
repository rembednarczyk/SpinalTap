import type { GrabPhase } from "@seki/core";
import { crouchOffset } from "./character-animation";
import type { CharacterRig } from "./character-rig";
import { smooth } from "./character-poses";
import { type JointPose, type MutablePose, mixPose } from "./joint-pose";

/**
 * The takedown grab's clips (ADR-0075 stage 2) as joint targets of the rig, like the knockout
 * poses (G-449): no model files, so a ragdoll (stage 4) can take over the end of the kill. Pure:
 * each pose is a function of the rig's build, the phase and the seconds into it.
 *
 * - hold: the player behind the target, the right forearm across its throat, the left hand on
 *   the back of its head (the arms are put there by `grab-reach`); the target leans back into
 *   her, clutching at the arm and kicking;
 * - choke: over `CHOKE_TIME` the struggle dies down and the target sinks onto its knees, upright
 *   in the player's arms, the head dropped; the player goes down on one knee with it;
 * - kill: a short struggle, the neck snapped (`SNAP`, a turn of the head and the player's
 *   shoulders), then the body goes limp onto its knees the same way.
 *
 * From the knees the knockout's fall takes over (`grab-clip` eases the clip out over it).
 */

/** The target is pulled this far in front of the player, metres between the roots (ADR-0075). */
export const GRAB_PULL = 0.45;
/** Seconds the choke and the kill take in the picture (TAKEDOWN_TIME without Quick Takedown). */
export const CHOKE_TIME = 1.2;
export const KILL_TIME = 1.2;
/** When the neck snaps in the kill, seconds; the body is limp `LIMP` later. */
export const SNAP = 0.4;
const SNAP_TURN = 0.12;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The target fighting the hold: 0 still .. 1 kicking. */
const struggleOf = (phase: GrabPhase, t: number): number => {
  if (phase === "hold") return 1;
  if (phase === "choke") return 1 - clamp01(t / (CHOKE_TIME * 0.7));
  return t < SNAP ? 1.3 : 0;
};

/** The target pulled back into the hold, clutching at the forearm across its throat. */
const heldUp = (t: number, struggle: number): JointPose => {
  const kick = Math.sin(t * 9) * struggle;
  const pull = Math.sin(t * 5.3 + 1) * struggle;
  return {
    x: 0,
    y: -0.02,
    z: 0,
    pitch: -0.08 + 0.03 * pull,
    yaw: 0.06 * pull,
    roll: 0.04 * kick,
    thighL: -0.25 + 0.25 * kick,
    thighR: 0.12 - 0.2 * kick,
    kneeL: 0.35 + 0.2 * Math.max(0, kick),
    kneeR: 0.12 + 0.2 * Math.max(0, -kick),
    armLX: -1.45 + 0.15 * pull,
    armLZ: -0.4,
    armLY: 0,
    armRX: -1.4 - 0.15 * pull,
    armRZ: 0.4,
    armRY: 0,
    elbowL: -1.95,
    elbowR: -1.9,
    headX: -0.3,
    headY: 0.1 * kick,
  };
};

/** Limp on its knees, upright where the player's arms held it, the head dropped and the arms hanging. */
const onKnees = (rig: CharacterRig): JointPose => {
  const drop = crouchOffset(rig, 0, 1.5, 0).y;
  return {
    x: 0,
    y: drop,
    z: 0,
    pitch: 0.05,
    yaw: 0,
    roll: 0.04,
    thighL: -0.05,
    thighR: 0.02,
    kneeL: 1.5,
    kneeR: 1.45,
    armLX: 0.05,
    armLZ: -0.08,
    armLY: 0,
    armRX: 0.02,
    armRZ: 0.1,
    armRY: 0,
    elbowL: -0.2,
    elbowR: -0.15,
    headX: 0.55,
    headY: 0.1,
  };
};

const HELD_MIX: MutablePose = { ...heldUp(0, 0) };

/** Where the target is `t` seconds into `phase`: held up, sinking to its knees, or limp after the snap. */
export const heldPose = (rig: CharacterRig, phase: GrabPhase, t: number): JointPose => {
  const up = heldUp(t, struggleOf(phase, t));
  if (phase === "hold") return up;
  const knees = onKnees(rig);
  if (phase === "choke") return mixPose(up, knees, smooth(clamp01(t / CHOKE_TIME)), HELD_MIX);
  // The kill: the head goes round with the snap and stays turned on the limp body.
  const snapped = clamp01((t - SNAP) / SNAP_TURN);
  const limp = smooth(clamp01((t - SNAP - SNAP_TURN) / (KILL_TIME - SNAP - SNAP_TURN - 0.1)));
  const pose = mixPose(up, knees, limp, HELD_MIX) as MutablePose;
  pose.headY += 0.9 * snapped;
  pose.headX += 0.25 * snapped * (1 - limp);
  // The arms let go of the forearm at once.
  pose.armLX += (knees.armLX - pose.armLX) * snapped;
  pose.armRX += (knees.armRX - pose.armRX) * snapped;
  pose.elbowL += (knees.elbowL - pose.elbowL) * snapped;
  pose.elbowR += (knees.elbowR - pose.elbowR) * snapped;
  return pose;
};

/** The player standing up into the hold, leaning a little over the target, the head turned to its side. */
const holdingUp = (t: number): JointPose => {
  const brace = Math.sin(t * 5.3 + 1) * 0.03;
  return {
    x: 0,
    y: 0,
    z: 0,
    pitch: 0.06 + brace,
    yaw: 0,
    roll: 0,
    thighL: -0.3,
    thighR: 0.2,
    kneeL: 0.3,
    kneeR: 0.15,
    armLX: -1.6,
    armLZ: -0.3,
    armLY: 0,
    armRX: -1.3,
    armRZ: 0.6,
    armRY: 0,
    elbowL: -1.3,
    elbowR: -1.8,
    headX: 0.1,
    headY: -0.45,
  };
};

/** Down on one knee behind the kneeling target, leaning over it. */
const holdingDown = (rig: CharacterRig): JointPose => {
  const lean = 0.3;
  const drop = crouchOffset(rig, -0.75, 1.55, lean);
  return { ...holdingUp(0), y: drop.y, z: drop.z, pitch: lean, thighL: -1.25 - lean, thighR: -0.2 - lean, kneeL: 1.2, kneeR: 1.9, headX: 0.35 };
};

const HOLDING_MIX: MutablePose = { ...holdingUp(0) };

/** Where the player is `t` seconds into `phase`. */
export const holderPose = (rig: CharacterRig, phase: GrabPhase, t: number): JointPose => {
  const up = holdingUp(t);
  if (phase === "hold") return up;
  const sink = phase === "choke" ? smooth(clamp01((t - 0.2) / (CHOKE_TIME - 0.2))) : smooth(clamp01((t - SNAP - SNAP_TURN) / (KILL_TIME - SNAP - SNAP_TURN - 0.1)));
  const pose = mixPose(up, holdingDown(rig), sink, HOLDING_MIX) as MutablePose;
  if (phase === "kill") {
    // The snap: the shoulders wrench round to the left and back.
    const wrench = Math.sin(Math.PI * clamp01((t - SNAP + 0.05) / (SNAP_TURN + 0.15)));
    pose.yaw -= 0.3 * wrench;
    pose.pitch -= 0.08 * wrench;
  }
  return pose;
};
