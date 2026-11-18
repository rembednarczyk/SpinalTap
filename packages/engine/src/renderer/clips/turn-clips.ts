import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, sampleBody } from "./body-sample";
import { yawOf } from "./leg-pose";

/*
 * Turning on the spot from the Female Locomotion pack's turns (ADR-0090): a figure standing that
 * turns faster than `TURNING` steps round as in the clip instead of sliding its feet. The clips'
 * own turn is taken out by the tool (`inPlace`); the phase runs with the angle turned, one loop per
 * the clip's quarter turn, so the feet keep up at any rate and stop when the turning does.
 */

/** Turning faster than this (rad/s) standing, the figure steps round. */
const TURNING = 0.5;
/** How fast the turn's steps ease in and out, per second. */
const EASE = 8;

interface TurnState {
  yaw: number | null;
  w: number;
  phase: number;
  clip: BodyClip;
}
const states = new WeakMap<CharacterRig, TurnState>();

/** The clip that turns the way `dyaw` (the root's change of yaw) does: the clips' turn is the heading's, opposite to the yaw. */
const clipFor = (dyaw: number): BodyClip => ((BODY_CLIPS.turnLeft.turn ?? 0) * -dyaw > 0 ? BODY_CLIPS.turnLeft : BODY_CLIPS.turnRight);

/**
 * This frame's step round on the spot and its weight, or null. `standing` (0..1): how far the
 * figure stands still and free to step (the idle's weight).
 */
export const turnFrame = (rig: CharacterRig, dt: number, standing: number): { readonly frame: BodyFrame; readonly w: number } | null => {
  let s = states.get(rig);
  const yaw = yawOf(rig);
  if (!s) {
    s = { yaw, w: 0, phase: 0, clip: BODY_CLIPS.turnLeft };
    states.set(rig, s);
  }
  const dyaw = s.yaw === null ? 0 : Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
  s.yaw = yaw;
  const turning = dt > 0 && standing > 0.5 && Math.abs(dyaw / dt) > TURNING;
  if (turning) {
    s.clip = clipFor(dyaw);
    s.phase += Math.abs(dyaw) / Math.abs(s.clip.turn ?? Math.PI / 2);
  }
  s.w += ((turning ? 1 : 0) - s.w) * Math.min(1, dt * EASE);
  if (s.w < 1e-3) return null;
  return { frame: sampleBody(s.clip, s.phase * s.clip.cycle, true), w: s.w * standing };
};
