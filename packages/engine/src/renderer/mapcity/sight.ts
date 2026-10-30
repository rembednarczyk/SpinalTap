/** Is there solid map city at (x, y, z)? (`MapCity.roofOver`.) */
export type SolidAt = (x: number, y: number, z: number) => boolean;

/** Distance between the samples along a line of sight, metres. */
const SIGHT_STEP = 1.5;
/** Left unsampled at the far end: a sign or a lamp hangs on its wall, a hand's width off it. */
const SIGHT_MARGIN = 1.2;

/**
 * True when a building of the map city stands between `from` and `to` (ADR-0044). Samples the
 * segment every `SIGHT_STEP` metres, short of the last `SIGHT_MARGIN`, so a thing on a facade
 * is still seen from the street in front of it. Cheap enough for the few dozen lights in view.
 */
export const sightBlocked = (solidAt: SolidAt, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  for (let d = SIGHT_STEP; d < length - SIGHT_MARGIN; d += SIGHT_STEP) {
    const t = d / length;
    if (solidAt(from.x + dx * t, from.y + dy * t, from.z + dz * t)) return true;
  }
  return false;
};
