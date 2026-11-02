import { verticalFov } from "@seki/core";
import type { P2 } from "../mapcity/polygon";
import { PATROL_SIZE, patrolFade } from "./patrol-flight";

/**
 * How the low patrols are seen from the street (ADR-0058 stage 7b): the people on the pedestrian
 * streets, and how many pixels a patrol takes at a distance. A patrol may come into sight or go only
 * where no one on those streets sees it: over `SIGHT_ELEVATION` over their horizon, or so far that it
 * takes under `SIGHT_PIXELS` on the reference screen. Pure.
 */

/** A pair of eyes on a pedestrian street. */
export interface Observer {
  readonly x: number;
  readonly z: number;
  readonly eye: number;
}

/** The eyes over the paving (m) and how far apart the observers stand along the streets' axes (m). */
export const SIGHT_EYE = 1.7;
export const SIGHT_SPACING = 2;
/** Higher than this over an observer's horizon a patrol is out of the street's view (rad). */
export const SIGHT_ELEVATION = (40 * Math.PI) / 180;
/** Smaller than this on the reference screen a patrol is not seen (px). */
export const SIGHT_PIXELS = 2;
/** The reference screen: `high` at 1920 x 1080 with the default 80 degrees across (`DEFAULT_HORIZONTAL_FOV`) at 16:9. */
export const REFERENCE_FOCAL = 1080 / 2 / Math.tan(verticalFov((80 * Math.PI) / 180, 16 / 9) / 2);

/** How many pixels across a patrol takes `d` metres away on the reference screen (its fade with the distance included). */
export const patrolPixels = (d: number): number => (PATROL_SIZE.width * patrolFade(d) * REFERENCE_FOCAL) / Math.max(d, 1e-6);

/** The distance from which on a patrol takes under `SIGHT_PIXELS` (m). */
export const PATROL_UNSEEN = ((): number => {
  let from = 0;
  for (let d = 0.5; d <= 2000; d += 0.5) if (patrolPixels(d) >= SIGHT_PIXELS) from = d + 0.5;
  return from;
})();

/** Observers every `SIGHT_SPACING` metres along the streets' axes, their eyes `SIGHT_EYE` over the paving. */
export const observersOf = (axes: readonly (readonly P2[])[], surfaceAt: (x: number, z: number) => number): Observer[] => {
  const out: Observer[] = [];
  for (const line of axes) {
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1] as P2;
      const b = line[i] as P2;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      let s = carry;
      for (; s <= len; s += SIGHT_SPACING) {
        const x = a.x + ((b.x - a.x) * s) / (len || 1);
        const z = a.z + ((b.z - a.z) * s) / (len || 1);
        out.push({ x, z, eye: surfaceAt(x, z) + SIGHT_EYE });
      }
      carry = s - len;
    }
  }
  return out;
};

/** Whether an observer could see a point by its height and distance alone (under `SIGHT_ELEVATION`, nearer than `PATROL_UNSEEN`), walls aside. */
export const inView = (o: Observer, x: number, y: number, z: number): boolean => {
  const d = Math.hypot(x - o.x, z - o.z);
  return Math.hypot(d, y - o.eye) < PATROL_UNSEEN && Math.atan2(y - o.eye, d) < SIGHT_ELEVATION;
};
