/**
 * A locomotion clip's legs (ADR-0090), as `tools/animations` makes them from Mixamo clips: both
 * legs' joints per frame relative to the hips, in the rig body's frame (+Y up, +Z forward, the
 * character's left at -X) and in leg lengths; the hips' rise and fall; the travel of one loop.
 */
export interface LegClip {
  /** Seconds of one loop. */
  readonly cycle: number;
  readonly frames: number;
  /** Horizontal travel of the hips in one loop, in leg lengths: x to the character's right, z forward. */
  readonly stride: { readonly x: number; readonly z: number };
  /** The hips' height over its mean, per frame, in leg lengths. */
  readonly bob: readonly number[];
  /** Per frame: hipL kneeL ankleL toeL hipR kneeR ankleR toeR, x y z relative to the hips, in leg lengths. */
  readonly legs: readonly number[];
}
