import { Vector3 } from "../babylon";
import type { CharacterRig } from "./character-rig";

/*
 * The figure's footfalls (user notes of 18.11): a foot coming down in the picture, so a footstep's
 * sound goes with the step the player sees, not with a clock of its own. Each foot's ankle height
 * over the root is followed; it lands when it comes down near its lowest after it was lifted.
 * The heights it moves between are learnt as it walks, so a walk, a run or a crouch all count.
 */

/** Below this speed (m/s) the figure stands: no footfalls (the sound's own threshold, footsteps.ts). */
const MOVING = 0.6;
/** The procedural rig's shin, knee to ankle, at its scale 1 (m). */
const SHIN = 0.42;
/** A foot lands below this share of its swing and lifts again above `LIFTED`. */
const LANDED = 0.25;
const LIFTED = 0.6;
/** A swing narrower than this (m) is no step (standing, a shuffle). */
const MIN_SWING = 0.03;
/** How fast the learnt lowest and highest heights let go of an old extreme, per frame. */
const FORGET = 0.02;

interface Foot {
  lo: number;
  hi: number;
  down: boolean;
}

const states = new WeakMap<CharacterRig, readonly [Foot, Foot]>();
const ankle = new Vector3();

const heightOf = (rig: CharacterRig, knee: CharacterRig["kneeL"], scale: number): number => {
  Vector3.TransformCoordinatesToRef(new Vector3(0, -SHIN * scale, 0), knee.computeWorldMatrix(true), ankle);
  return ankle.y - rig.root.getAbsolutePosition().y;
};

/** The footfalls of `rig` in this frame (0, 1, rarely 2), once its legs are posed for it. */
export const footfallsOf = (rig: CharacterRig, speed: number): number => {
  const scale = Math.abs(rig.root.scaling.y) || 1;
  rig.root.computeWorldMatrix(true);
  const h = [heightOf(rig, rig.kneeL, scale), heightOf(rig, rig.kneeR, scale)] as const;
  let feet = states.get(rig);
  if (!feet) {
    feet = [
      { lo: h[0], hi: h[0], down: true },
      { lo: h[1], hi: h[1], down: true },
    ];
    states.set(rig, feet);
  }
  const moving = speed >= MOVING && rig.airBlend < 0.5 && rig.climbBlend < 0.5 && rig.dying === null;
  let n = 0;
  feet.forEach((f, i) => {
    const y = h[i]!;
    f.lo = y < f.lo ? y : f.lo + (y - f.lo) * FORGET;
    f.hi = y > f.hi ? y : f.hi + (y - f.hi) * FORGET;
    const swing = Math.max(MIN_SWING, f.hi - f.lo);
    if (!f.down && y < f.lo + LANDED * swing) {
      f.down = true;
      if (moving && f.hi - f.lo >= MIN_SWING) n++;
    } else if (f.down && y > f.lo + LIFTED * swing) f.down = false;
  });
  return n;
};

/** The followed figure's footfalls since the audio last took them (the renderer's, read once a frame). */
export class FootfallCount {
  private n = 0;

  add(n: number): void {
    this.n += n;
  }

  /** The footfalls since the last take, and none after it. */
  take(): number {
    const n = this.n;
    this.n = 0;
    return n;
  }
}
