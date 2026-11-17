import type { Entity } from "../world/components";
import { type GroundField, MAX_WALK_SLOPE } from "../world/ground";
import { STEP_HEIGHT } from "./step";

const slope = { x: 0, z: 0 };

/** Rises by less than this per step do not count as climbing (rounding on the contour). */
const RISE_EPS = 1e-3;

/**
 * Does the step from feet at `from` onto (x, z) climb onto a bridge's deck more than a step over
 * them (G-903)? Its side is a wall then however level its deck is past the edge, where the slope
 * over half a metre no longer sees the edge; so is its underside to feet under it, where the room
 * there closes. A deck within its headroom of the terrain is ground for all feet (G-062), the feet
 * standing on one already: they get onto it only a step up, as onto a kerb (G-898).
 */
const deckSide = (field: GroundField, from: Entity["position"], x: number, z: number, climb: number, reach: number): boolean =>
  climb > STEP_HEIGHT && field.onLowDeck(x, z, reach) && !field.onFlight(x, z) && !field.onLowDeck(from.x, from.z, reach);

/** Does the step from feet at `feet` at `from` to (x, z) climb a bridge deck's side (`deckSide`)? */
export const ontoDeckSide = (field: GroundField, from: Entity["position"], x: number, z: number, feet: number): boolean => {
  const reach = feet + STEP_HEIGHT;
  return deckSide(field, from, x, z, field.heightAt(x, z, reach) - feet, reach);
};

/**
 * A step up terrain steeper than MAX_WALK_SLOPE is a wall (ADR-0043): the uphill part of the
 * move is dropped, so the character slides along the bank's contour; when even that climbs
 * steeply, it stays. Feet above the terrain there (a jump, a roof) are not stopped. So is the
 * side of a bridge's deck more than a step up (`deckSide`).
 */
export const offTheBank = (field: GroundField, from: Entity["position"], x: number, z: number, feet: number): { x: number; z: number } => {
  // A bridge's deck high overhead is no bank for feet under it (G-062).
  const reach = feet + STEP_HEIGHT;
  const climb = field.heightAt(x, z, reach) - feet;
  if (climb <= RISE_EPS) return { x, z };
  const steep = field.steepAt(x, z, reach);
  if (!steep && !deckSide(field, from, x, z, climb, reach)) return { x, z };
  // A bridge's deck a step or less over feet on the ground is a step up onto it, as onto a kerb
  // (G-898): by its edge the slope over half a metre is the bank's beside it, on a strip narrower
  // than the raster's cell, whose ways take the deck's height there. Not for feet falling off it.
  if (climb <= STEP_HEIGHT && field.heightAt(from.x, from.z, reach) >= feet - RISE_EPS && field.onLowDeck(x, z, reach) && !field.onFlight(x, z)) return { x, z };
  // On a deck's level past its side the slope to slide along is the one by its edge, at the feet.
  const g = steep ? field.gradientAt(x, z, slope, reach) : field.gradientAt(from.x, from.z, slope, reach);
  const len = Math.hypot(g.x, g.z);
  // No slope to slide along (a wall by a flight's side, G-255; from deep in a cellar under a deck): the feet stay.
  if (len < 1e-9) return { x: from.x, z: from.z };
  const dx = x - from.x;
  const dz = z - from.z;
  const up = (dx * g.x + dz * g.z) / len;
  const sx = from.x + dx - (g.x / len) * Math.max(0, up);
  const sz = from.z + dz - (g.z / len) * Math.max(0, up);
  const rise = field.heightAt(sx, sz, reach) - feet;
  if (deckSide(field, from, sx, sz, rise, reach)) return { x: from.x, z: from.z };
  if (rise <= RISE_EPS || rise <= MAX_WALK_SLOPE * Math.hypot(sx - from.x, sz - from.z) || !field.steepAt(sx, sz, reach)) return { x: sx, z: sz };
  return { x: from.x, z: from.z };
};
