import type { CharacterRig } from "../character-rig";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, sampleBody } from "./body-sample";

/*
 * Stopping from a run, from Mixamo's “run to stop” (ADR-0090): the figure plants a foot, leans
 * back and dips as it brakes, the arms swinging forward. The game has already stopped it, so the
 * clip's slide forward is left out: the hips only dip.
 */

/** Running at least this fast (m/s), then falling below `STOPPED`, the figure brakes. */
const RUNNING = 4;
const STOPPED = 1.2;
/** Faster than this again, the braking is over. */
const MOVING_ON = 2;

interface StopState {
  speed: number;
  /** Seconds into the braking, or null. */
  at: number | null;
}
const states = new WeakMap<CharacterRig, StopState>();

/** This frame's braking from a run and its weight, or null. */
export const stopFrame = (rig: CharacterRig, speed: number, dt: number): { readonly frame: BodyFrame; readonly w: number } | null => {
  let s = states.get(rig);
  if (!s) {
    s = { speed, at: null };
    states.set(rig, s);
  }
  if (s.speed >= RUNNING && speed < STOPPED && rig.airBlend < 0.5 && rig.climbBlend < 0.5) s.at = 0;
  else if (s.at !== null) s.at += dt;
  s.speed = Math.max(speed, s.speed * 0.5 ** (dt / 0.15));
  const clip = BODY_CLIPS.runStop;
  if (s.at === null || s.at >= clip.cycle || speed > MOVING_ON || rig.dying !== null) {
    s.at = null;
    return null;
  }
  // Eased out over its last fifth.
  const w = Math.min(1, (clip.cycle - s.at) / (clip.cycle * 0.2));
  return { frame: sampleBody(clip, s.at, false), w };
};
