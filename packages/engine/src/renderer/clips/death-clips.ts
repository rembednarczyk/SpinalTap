import type { Vec3 } from "@seki/core";
import { Quaternion, Vector3 } from "../../babylon";
import { deathLift } from "../character-animation";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { sampleBody } from "./body-sample";
import { RIG_LEG, poseLeg } from "./leg-pose";
import { poseArm } from "./pose-lay";

/*
 * Deaths from Mixamo clips (ADR-0090, the user's clips of 18.11) in place of the procedural fall
 * backwards: hit from the front a figure falls on its back (“Death”), from behind on its face
 * (“Death From The Back”), in the head on its back and over to the side (“Death From Front
 * Headshot”). The way comes from the last hit before the death (`noteHit`, the flinch's `at`
 * and `head`); none, the front. The clip lays the whole body (the torso turned about the hips,
 * the hips carried as in the clip), the root stays upright; the procedural fall still sets where
 * the root lies and its sinking out of view at the end.
 */

interface Hit {
  readonly at: Vec3;
  readonly head: boolean;
}
const hits = new WeakMap<CharacterRig, Hit>();

/** A hit landed on the figure at `at` (world), `head` when in the head. */
export const noteHit = (rig: CharacterRig, at: Vec3, head: boolean): void => {
  hits.set(rig, { at, head });
};

/** The death clip of the figure's last hit: in the head, from behind or (also without a hit) from the front. */
export const deathClipOf = (rig: CharacterRig): BodyClip => {
  const hit = hits.get(rig);
  if (!hit) return BODY_CLIPS.deathFront;
  if (hit.head) return BODY_CLIPS.deathHead;
  rig.root.computeWorldMatrix(true);
  const ahead = rig.root.getDirection(Vector3.Forward());
  const p = rig.root.position;
  return ahead.x * (hit.at.x - p.x) + ahead.z * (hit.at.z - p.z) < 0 ? BODY_CLIPS.deathBack : BODY_CLIPS.deathFront;
};

const chosen = new WeakMap<CharacterRig, BodyClip>();

/** Lays the death clip on a dying rig, after `animateRig` (which played the procedural fall). */
export const poseDeathFromClip = (rig: CharacterRig): void => {
  if (rig.dying === null) return;
  let clip = chosen.get(rig);
  if (!clip) {
    clip = deathClipOf(rig);
    chosen.set(rig, clip);
  }
  const f = sampleBody(clip, rig.dying, false);
  // The root stays upright: the clip turns the body down instead of the procedural tip of the root,
  // and lies on the ground without the lift that tip needed.
  rig.root.rotation.x = 0;
  rig.root.position.y -= deathLift(rig.dying);
  const b = rig.body;
  const hip = new Vector3(0, rig.legL.position.y, 0);
  b.rotation.copyFrom(f.chest.toEulerAngles());
  // About the hips, carried as far as the clip carries them.
  b.position.copyFrom(hip.subtract(hip.applyRotationQuaternion(f.chest)).add(f.hips.scale(RIG_LEG)));
  rig.head.rotation.copyFrom(f.head.toEulerAngles());
  const unlean = Quaternion.Inverse(f.chest);
  poseLeg(rig.legL, rig.kneeL, [...f.legs], 0, 1, unlean, 1);
  poseLeg(rig.legR, rig.kneeR, [...f.legs], 12, 1, unlean, 1);
  for (const e of [rig.elbowL, rig.elbowR]) e.rotation.y = e.rotation.z = 0;
  poseArm(rig.armL, rig.elbowL, rig.wristL, f.arms, 0, 1);
  poseArm(rig.armR, rig.elbowR, rig.wristR, f.arms, 9, 1);
};
