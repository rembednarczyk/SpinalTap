/* The ladder a climber hangs on (G-310), apart from the hands' solver so that the rig can carry it. */

/**
 * The rungs of the ladder a climber hangs on (ADR-0021), as the content builds them: rung `j`
 * (0 at the foot) is a bar `spacing * (j + 0.5)` over `bottom`, across the ladder through
 * (`x`, `z`); `yaw` faces the ladder from the climber's side.
 */
export interface LadderRungs {
  readonly bottom: number;
  readonly spacing: number;
  readonly count: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
