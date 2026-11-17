import type { Entity } from "../world/components";
import { type GroundField, MAX_WALK_SLOPE } from "../world/ground";
import { STEP_HEIGHT } from "./step";

const slope = { x: 0, z: 0 };

/** Rises by less than this per step do not count as climbing (rounding on the contour). */
const RISE_EPS = 1e-3;

/**
 * A step up terrain steeper than MAX_WALK_SLOPE is a wall (ADR-0043): the uphill part of the
 * move is dropped, so the character slides along the bank's contour; when even that climbs
 * steeply, it stays. Feet above the terrain there (a jump, a roof) are not stopped.
 */
export const offTheBank = (field: GroundField, from: Entity["position"], x: number, z: number, feet: number): { x: number; z: number } => {
  // A bridge's deck high overhead is no bank for feet under it (G-062).
  const reach = feet + STEP_HEIGHT;
  const climb = field.heightAt(x, z, reach) - feet;
  if (climb <= RISE_EPS || !field.steepAt(x, z, reach)) return { x, z };
  // A bridge's deck a step or less over feet on the ground is a step up onto it, as onto a kerb
  // (G-898): by its edge the slope over half a metre is the bank's beside it, on a strip narrower
  // than the raster's cell, whose ways take the deck's height there. Not for feet falling off it.
  if (climb <= STEP_HEIGHT && field.heightAt(from.x, from.z, reach) >= feet - RISE_EPS && field.onLowDeck(x, z, reach) && !field.onFlight(x, z)) return { x, z };
  const g = field.gradientAt(x, z, slope, reach);
  const len = Math.hypot(g.x, g.z);
  const dx = x - from.x;
  const dz = z - from.z;
  const up = (dx * g.x + dz * g.z) / len;
  const sx = from.x + dx - (g.x / len) * Math.max(0, up);
  const sz = from.z + dz - (g.z / len) * Math.max(0, up);
  const rise = field.heightAt(sx, sz, reach) - feet;
  if (rise <= RISE_EPS || rise <= MAX_WALK_SLOPE * Math.hypot(sx - from.x, sz - from.z) || !field.steepAt(sx, sz, reach)) return { x: sx, z: sz };
  return { x: from.x, z: from.z };
};
