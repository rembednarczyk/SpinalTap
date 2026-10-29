import type { ActivityJoints } from "./activity-poses";
import { crouchOffset } from "./character-animation";
import type { CharacterRig } from "./character-rig";

/** Knee bend of the standing pose (character-animation.ts). */
const KNEE_REST = 0.04;

/**
 * Body offset that keeps the feet planted under the root for these legs and this lean, relative
 * to standing: a seated pose drops the hips and moves them back over the seat.
 */
export const plantedOffset = (rig: CharacterRig, j: ActivityJoints): { y: number; z: number } => {
  const rest = crouchOffset(rig, 0, KNEE_REST, 0);
  const thigh = (j.legLX + j.legRX) / 2;
  const knee = (j.kneeL + j.kneeR) / 2;
  const pose = crouchOffset(rig, thigh, knee, j.lean);
  return { y: pose.y - rest.y, z: pose.z - rest.z };
};

/**
 * Lays an activity's pose over what the walk animation set this frame, by `w` (0..1). Run after
 * `animateRig` and before the retarget copies the rig onto an imported model. A drawn weapon
 * keeps its arm (a guard on watch holds the rifle where the aim put it).
 */
export const applyActivityPose = (rig: CharacterRig, j: ActivityJoints, w: number): void => {
  // The walk never turns these: they rest at 0, so the pose scales them from there (and w = 0 puts them back).
  rig.legL.rotation.z = j.spread * w;
  rig.legR.rotation.z = -j.spread * w;
  rig.head.rotation.y = j.headY * w;
  rig.head.rotation.z = j.headZ * w;
  if (w <= 0) return;
  const mix = (from: number, to: number): number => from + (to - from) * w;
  const armed = rig.aiming && rig.drawn > 0.5;
  // A hand holding an umbrella keeps holding it up (ADR-0041).
  if (!rig.leftHold) {
    rig.armL.rotation.x = mix(rig.armL.rotation.x, j.armLX - j.lean);
    rig.armL.rotation.z = mix(rig.armL.rotation.z, j.armLZ);
    rig.elbowL.rotation.x = mix(rig.elbowL.rotation.x, j.elbowL);
  }
  if (!armed) {
    rig.armR.rotation.x = mix(rig.armR.rotation.x, j.armRX - j.lean);
    rig.armR.rotation.z = mix(rig.armR.rotation.z, j.armRZ);
    rig.elbowR.rotation.x = mix(rig.elbowR.rotation.x, j.elbowR);
  }
  // Legs are relative to the leaning body, like the walk's.
  rig.legL.rotation.x = mix(rig.legL.rotation.x, j.legLX - j.lean);
  rig.legR.rotation.x = mix(rig.legR.rotation.x, j.legRX - j.lean);
  rig.kneeL.rotation.x = mix(rig.kneeL.rotation.x, j.kneeL);
  rig.kneeR.rotation.x = mix(rig.kneeR.rotation.x, j.kneeR);
  const offset = plantedOffset(rig, j);
  const breathe = Math.sin(rig.time * 1.7) * 0.006;
  rig.body.position.y = mix(rig.body.position.y, offset.y + breathe);
  rig.body.position.z = mix(rig.body.position.z, offset.z - j.back);
  rig.body.rotation.x = mix(rig.body.rotation.x, rig.stoop + j.lean);
  rig.body.rotation.y = mix(rig.body.rotation.y, j.twist);
  rig.head.rotation.x = mix(rig.head.rotation.x, j.headX - j.lean * 0.5);
};
