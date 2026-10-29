import { SIDEWALK_HEIGHT, onSidewalk } from "@seki/sim";

/**
 * Sidewalks are drawn, not walked (ADR-0041): the simulation keeps everyone's feet on the road
 * plane, so a character standing on a sidewalk is lifted by the sidewalk's height in the picture
 * alone, eased so a kerb reads as a step. Floors above the street are left alone.
 */

/** How high a character at (x, y, z) stands above its simulated feet. */
export const groundLift = (x: number, y: number, z: number): number => (Math.abs(y) < 0.3 && onSidewalk(x, z, 0.05) ? SIDEWALK_HEIGHT : 0);

/** Lift speed (m/s): a kerb is a step of a tenth of a second. */
const RATE = 1.2;

/** One frame of the eased lift towards `target`. */
export const easeLift = (current: number, target: number, dt: number): number => {
  const step = RATE * dt;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
};
