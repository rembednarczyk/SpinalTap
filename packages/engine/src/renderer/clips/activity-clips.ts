import type { ActivityId } from "@seki/core";
import { Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, mixFrames, sampleBody } from "./body-sample";
import { figureSeed, layPose } from "./pose-lay";

/*
 * The passers-by's activities from Mixamo clips (ADR-0090; the user's clips of 18.11). Over the
 * procedural activity pose (ADR-0040) a clip lays the whole figure: a smoker draws on the
 * cigarette in the right hand, shifts and looks about; someone on the phone holds it to the right
 * ear and talks, or types on it with both thumbs (half of them); at a terminal the hands work a
 * screen; in a talk the hands and the head go through gestures one after another, each figure in
 * its own order; leaning, it stands at ease; drinking, it sways drunk while the procedural arm
 * lifts the can. The procedural poses of these put the hands up by the
 * head on the imported models (G-731: the phone's free hand, the lean's both). Each figure at its own point of its clip. The props stay in the hands they were
 * in, so they go where the clip's hands go.
 */

/** The clips an activity can show; a figure keeps its one. */
const CLIPS: Partial<Readonly<Record<ActivityId, readonly BodyClip[]>>> = {
  smoke: [BODY_CLIPS.smoke],
  phone: [BODY_CLIPS.phoneTalk, BODY_CLIPS.phoneText],
  terminal: [BODY_CLIPS.tablet],
  // No lean against a wall in the packs: standing at ease with the weight shifting. The procedural
  // lean bent the arms up by the head on the models, as if the hands were up (G-731).
  lean: [BODY_CLIPS.idleShift],
};

/** A talk's gestures, played one after another in the figure's own order. */
const GESTURES: readonly BodyClip[] = [
  BODY_CLIPS.talkHappy,
  BODY_CLIPS.talkAck,
  BODY_CLIPS.talkCocky,
  BODY_CLIPS.talkNod,
  BODY_CLIPS.talkShake,
  BODY_CLIPS.talkDismiss,
  BODY_CLIPS.talkLook,
  BODY_CLIPS.talkAngry,
  BODY_CLIPS.talkAnnoyed,
  BODY_CLIPS.talkSarcastic,
  BODY_CLIPS.talkSigh,
  BODY_CLIPS.talkNo,
  BODY_CLIPS.talkHardNod,
  BODY_CLIPS.talkLongNod,
];
/** A drinker sways as the Male Drunk pack's idles do; its arms keep the procedural pose, which lifts the can. */
const DRUNK: readonly BodyClip[] = [BODY_CLIPS.drunkIdle, BODY_CLIPS.drunkIdle2];
/** Seconds one gesture eases into the next. */
const GESTURE_EASE = 0.3;


/** The figure's order of the gestures: a turn of the list by its seed, every other one backwards. */
const gestureOrder = (seed: number): BodyClip[] => {
  const n = GESTURES.length;
  const start = Math.floor(seed * n);
  const back = Math.floor(seed * 2 * n) % 2 === 1;
  return Array.from({ length: n }, (_, i) => GESTURES[(start + (back ? n - i : i)) % n]!);
};

/** The talk at `t` seconds: the gesture it is in, eased from the end of the one before. */
const talkFrame = (seed: number, t: number): BodyFrame => {
  const order = gestureOrder(seed);
  const total = order.reduce((a, c) => a + c.cycle, 0);
  let at = (((t + seed * total) % total) + total) % total;
  let i = 0;
  while (at >= order[i]!.cycle) at -= order[i++]!.cycle;
  const now = sampleBody(order[i]!, at, false);
  if (at >= GESTURE_EASE) return now;
  const before = order[(i + order.length - 1) % order.length]!;
  const k = at / GESTURE_EASE;
  return mixFrames(sampleBody(before, before.cycle, false), now, k * k * (3 - 2 * k));
};

/** The frame of `activity` for this figure at `t` seconds into it, or null when it has no clip. */
export const activityFrame = (rig: CharacterRig, activity: ActivityId, t: number): BodyFrame | null => {
  const seed = figureSeed(rig);
  if (activity === "talk") return talkFrame(seed, t);
  if (activity === "drink") {
    const clip = DRUNK[Math.floor(seed * DRUNK.length)]!;
    return sampleBody(clip, t + seed * clip.cycle, true);
  }
  const choices = CLIPS[activity];
  if (!choices) return null;
  const clip = choices[Math.floor(seed * choices.length)]!;
  return sampleBody(clip, t + seed * clip.cycle, true);
};

/**
 * Lays the clip of the activity the figure does over its procedural pose, `w` of the way (the
 * activity's own blend weight). Call after the activity pose. The hips do not shift sideways: the
 * body's x is the idle's to keep (`body-pose.ts`).
 */
export const layActivityClip = (rig: CharacterRig, activity: ActivityId | null, t: number, w: number): void => {
  if (activity === null || w <= 1e-3 || rig.dying !== null) return;
  const f = activityFrame(rig, activity, t);
  if (!f) return;
  // Drinking, the procedural arm lifts the can; the clip sways the rest.
  const arms = rig.handsBusy || activity === "drink" ? 0 : 1;
  layPose(rig, f, w, [arms, arms], false);
};

/** How near the right hand is to the head, 0 far (0.5 m and more) .. 1 at the lips: the cigarette's glow follows the drags. */
export const handAtLips = (rig: CharacterRig): number => {
  rig.root.computeWorldMatrix(true);
  const hand = rig.wristR.computeWorldMatrix(true).getTranslation();
  const head = rig.head.computeWorldMatrix(true).getTranslation();
  const d = Vector3.Distance(hand, head) / (Math.abs(rig.root.scaling.y) || 1);
  return Math.max(0, Math.min(1, (0.5 - d) / 0.3));
};
