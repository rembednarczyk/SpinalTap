import type { Vec3 } from "@seki/core";

/** A pull-up onto a ledge: from where the hands caught it to standing on top, over `duration` seconds. */
export interface Mantle {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly duration: number;
  t: number;
}

/** Jump timers of the player (ADR-0021). Transient like the posture: not saved. */
export interface JumpState {
  /** Seconds left in which a jump still counts after leaving the ground without one (coyote time). */
  coyote: number;
  /** Seconds left of a press made too early (in the air), so it fires on landing (jump buffer). */
  buffer: number;
}

/** On a ladder (ADR-0021). Transient; a game saved on a ladder grabs it again on load. */
export interface Climbing {
  readonly ladder: string;
  /** Climbing speed this step, m/s, positive up (for the presentation). */
  speed: number;
}
