import type { CharacterRig } from "../character-rig";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, mixFrames, sampleBody } from "./body-sample";

/*
 * Jumps, falls and hard landings from Mixamo's Action Adventure pack (ADR-0090, the user's clips
 * of 18.11). Off the ground the figure tucks its legs as it springs up (“jumping up”, from the
 * take-off) and flails them a little as it falls (“falling idle”), mixed by how fast it rises.
 * A landing from a drop of 7 m/s and more is a hard one (“hard landing”): down on bent knees,
 * a hand to the ground, and up again over two seconds, eased out as soon as it moves on; a
 * lighter landing keeps the procedural dip.
 */

/** Falling at least this fast (m/s) when it lands, the landing is a hard one. */
export const HARD_LANDING = 7;
/** Seconds into the hard landing when the feet touch the ground. */
const TOUCH = 0.13;
/** Rising this fast (m/s) and more, the figure is all in the jump's tuck; falling, in the fall. */
const RISE = 2;

interface AirState {
  /** Seconds off the ground. */
  air: number;
  /** Seconds since a hard landing, or null. */
  landed: number | null;
  /** The last vertical speed off the ground. */
  lastAir: number | null;
}
const states = new WeakMap<CharacterRig, AirState>();

/** The frame of a figure off the ground, its weight the rig's air blend; null on the ground. */
const offGround = (rig: CharacterRig, s: AirState): BodyFrame | null => {
  if (rig.lastAir === null || rig.airBlend < 1e-3) return null;
  const up = sampleBody(BODY_CLIPS.jumpUp, s.air, false);
  const fall = sampleBody(BODY_CLIPS.fall, s.air, true);
  const rise = Math.max(0, Math.min(1, rig.lastAir / RISE));
  return mixFrames(fall, up, rise);
};

/**
 * This frame's jump, fall or hard landing for the figure (after `animateRig`): the frame and its
 * weight, or null. `moving` (0..1) eases a landing out as the figure walks or runs on.
 */
export const airFrame = (rig: CharacterRig, dt: number, moving: number): { readonly frame: BodyFrame; readonly w: number } | null => {
  let s = states.get(rig);
  if (!s) {
    s = { air: 0, landed: null, lastAir: rig.lastAir };
    states.set(rig, s);
  }
  if (rig.lastAir !== null) {
    if (s.lastAir === null) s.air = 0;
    s.air += dt;
    s.landed = null;
  } else if (s.lastAir !== null && -s.lastAir >= HARD_LANDING && rig.climbBlend < 0.5) {
    s.landed = 0;
    // The clip's crouch takes the place of the procedural dip.
    rig.landing = 0;
  } else if (s.landed !== null) s.landed += dt;
  s.lastAir = rig.lastAir;
  const off = offGround(rig, s);
  if (off) return { frame: off, w: rig.airBlend };
  if (s.landed === null) return null;
  const t = TOUCH + s.landed;
  if (t >= BODY_CLIPS.hardLanding.cycle || rig.dying !== null) {
    s.landed = null;
    return null;
  }
  const w = 1 - Math.max(0, Math.min(1, moving));
  return w > 1e-3 ? { frame: sampleBody(BODY_CLIPS.hardLanding, t, false), w } : null;
};
