/**
 * A body clip (ADR-0090 stage 2), as `tools/animations` makes it from a Mixamo clip, in the rig
 * body's frame (+Y up, +Z forward, the character's left at -X). A pose clip (idle) is how the
 * figure stands: the chest turned from upright, the head in the chest's frame, the arms' and the
 * hands' directions in the chest's frame and the legs as a leg clip's. A delta clip (a hit
 * reaction) is how the chest, the head and the hips move from its first frame; its arms and legs
 * are empty.
 */
export interface BodyClip {
  /** Seconds of the clip. */
  readonly cycle: number;
  readonly frames: number;
  /** x y z per frame: the hips against their mean (pose) or their first frame (delta), in leg lengths. */
  readonly hips: readonly number[];
  /** x y z w per frame. */
  readonly chest: readonly number[];
  /** x y z w per frame, in the chest's frame. */
  readonly head: readonly number[];
  /** Per frame unit directions in the chest's frame: upper arm, forearm, hand of the left arm, then of the right. */
  readonly arms: readonly number[];
  /** Per frame hipL kneeL ankleL toeL hipR kneeR ankleR toeR relative to the hips, in leg lengths. */
  readonly legs: readonly number[];
  /** Per frame, how far the gun in both hands has gone back along its barrel, in leg lengths (delta clips; a shot's kick). */
  readonly gun: readonly number[];
}
