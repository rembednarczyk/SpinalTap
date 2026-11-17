import type { CharacterRig } from "../character-rig";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, sampleBody } from "./body-sample";
import { RIG_LEG } from "./leg-pose";

/*
 * A shot's kick from Mixamo's “firing rifle” (ADR-0090; the user's ask of 17.11 for the firing
 * animation): the torso and the head jolt back and the gun goes back along its barrel some 3 cm
 * and forward again, over a quarter of a second. The torso's part is laid on with the other body
 * clips (`body-pose.ts`); the gun's by the long-gun hold and the pistol arm, which read
 * `recoilBack` while they pose the gun.
 */

interface Kick {
  at: number;
  readonly amount: number;
}
const kicks = new WeakMap<CharacterRig, Kick>();

/** The figure fired: the kick starts over, `amount` as hard as the clip's. */
export const startRecoil = (rig: CharacterRig, amount = 1): void => {
  kicks.set(rig, { at: 0, amount });
};

/** How far back along its barrel the gun is now, in the rig's units (0 without a kick). */
export const recoilBack = (rig: CharacterRig): number => {
  const k = kicks.get(rig);
  return k ? sampleBody(BODY_CLIPS.fire, k.at, false).gun * RIG_LEG * k.amount : 0;
};

/** The kick of this frame (the torso's and the head's turns), then on by `dt`; null without one. */
export const stepRecoil = (rig: CharacterRig, dt: number): { readonly frame: BodyFrame; readonly amount: number } | null => {
  const k = kicks.get(rig);
  if (!k) return null;
  const frame = sampleBody(BODY_CLIPS.fire, k.at, false);
  k.at += dt;
  if (k.at > BODY_CLIPS.fire.cycle) kicks.delete(rig);
  return { frame, amount: k.amount };
};
