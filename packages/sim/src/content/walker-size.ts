/**
 * What the residents' walk measures, kept in content so the barriers' cuts (`barrier-room.ts`) and
 * the world's crowd read the same numbers without importing each other.
 */

/** Walkers keep left: each way round a route walks this far to its own left of the line (m). */
export const WALKER_SIDE = 0.28;
/** The radius of a character's body (m). */
export const BODY_RADIUS = 0.38;
