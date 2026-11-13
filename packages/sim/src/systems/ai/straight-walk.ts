import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../../world/components";
import { DECK_HEADROOM } from "../../world/deck";
import { type GroundField, groundOf } from "../../world/ground";
import { lineOfSight } from "../../world/hitscan";
import { SNAP_DOWN, STEP_HEIGHT, offTheBank } from "../movement-system";
import { LEDGE, NAV_CELL, ON_LEDGE, type Raster, cellIndex } from "./nav-raster";
import { wallOnWay } from "./nav-walls";

/**
 * The straight-walk tests of the steering (ADR-0025, `steering.ts`): may a body walk from one
 * point to another on its floor, through the raster's open cells or over the terrain's banks.
 */

/** A goal more than this above or below is on another floor: the level graph's job. */
export const SAME_FLOOR = 1;

/** Spacing of the samples of the straight-walk test, metres. */
export const SAMPLE = 0.2;
/** Near the walker its own cell may count as closed (it stands against a wall); the test skips that far. */
const NEAR_SKIP = 0.6;

/**
 * The floor a character walks on, rounded so that a sidewalk kerb is still the street. `ground`
 * is the terrain under it (ADR-0043): 0, the ground floor, is anywhere within a step of it.
 */
export const floorOf = (y: number, ground = 0): number => (y - ground < STEP_HEIGHT ? 0 : Math.round(y * 4) / 4);

/** How often a walk's line is sampled for a deck it passes under (m). */
const UNDER_STEP = 1;

/** The part of the line from `a` to `b` (0..1 along it) inside the box, or null. */
const clipTo = (a: Vec3, b: Vec3, box: { minX: number; maxX: number; minZ: number; maxZ: number }): [number, number] | null => {
  let [t0, t1] = [0, 1];
  for (const [p, d, lo, hi] of [[a.x, b.x - a.x, box.minX, box.maxX], [a.z, b.z - a.z, box.minZ, box.maxZ]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const [u, v] = [(lo - p) / d, (hi - p) / d];
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
  }
  return t0 <= t1 ? [t0, t1] : null;
};

/**
 * Does the straight line from `a` to `b` pass under a bridge's deck with headroom over the
 * terrain there and over both ends: the way under it, both ends off it (G-088)? Sampled only
 * across the decks' boxes.
 */
const passesUnder = (ground: GroundField, a: Vec3, b: Vec3): boolean => {
  const boxes = ground.decksNear(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
  if (boxes.length === 0) return false;
  const top = Math.max(a.y, b.y) + DECK_HEADROOM;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  for (const box of boxes) {
    const span = clipTo(a, b, box);
    if (!span) continue;
    const n = Math.max(1, Math.ceil(((span[1] - span[0]) * len) / UNDER_STEP));
    for (let i = 0; i <= n; i++) {
      const t = span[0] + ((span[1] - span[0]) * i) / n;
      const [x, z] = [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t];
      const deck = ground.heightAt(x, z);
      if (deck > top && deck - ground.heightAt(x, z, -Infinity) > DECK_HEADROOM) return true;
    }
  }
  return false;
};

/**
 * How a walk from `a` to `b` sees the bridges' decks high over the terrain (G-062): as overhead
 * (`-Infinity`) when either end stands under one, or the way between them passes under one high
 * over both (the footway in its tunnel under Zamkowa, G-088), so the way under the bridge is open
 * and the deck's edges over it are no bank; as ground (`Infinity`) otherwise, so a way over the
 * bridge between two ends off it stays open. Only these two: the walk's rasters are kept by it.
 */
export const deckReach = (ground: GroundField, a: Vec3, b: Vec3): number => {
  const underDeck = (p: Vec3) => ground.heightAt(p.x, p.z, p.y + STEP_HEIGHT) < ground.heightAt(p.x, p.z);
  return underDeck(a) || underDeck(b) || passesUnder(ground, a, b) ? -Infinity : Infinity;
};

/**
 * True when a body walks from `a` to `b` through open cells only (the first `NEAR_SKIP` metres
 * excepted), in a window with a flight hung off a bridge never climbing more than a step between
 * two samples onto one or by it: its side (G-255, whose foot is closed only a cell wide); nor
 * onto a bridge's deck over its edge (`ledgesOf`) more than a walkable rise, which the open
 * cells do not show: the chase along Podwale stopped at the viaduct's western abutment by
 * w294098693 (0.56 m), and one under the viaduct at its eastern one; nor a smaller rise there
 * where the movement's slope is too steep, the terrain falling along the edge (by the west end of
 * the footbridge of podzamcze-2-0 the walk cut its corner, G-741). On terrain, the feet not
 * stopped by a bank in the skipped metres either (`bankNear`, G-738), nor the way up a wall
 * between cells (`wallOnWay`, G-740).
 */
export const walkable = (r: Raster, a: Vec3, b: Vec3): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(len / SAMPLE);
  // Cell to cell, the feet's own included: on a tread the feet lie off their cell's height.
  const start = cellIndex(r, a.x, a.z);
  let last = r.base && start >= 0 ? (r.base[start] ?? a.y) : a.y;
  if (wallOnWay(r, a, b, SAMPLE)) return false;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = cellIndex(r, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (c < 0) return false;
    if (r.base && (r.flight || r.ledges)) {
      const h = r.base[c] ?? 0;
      if ((r.flight?.[c] ?? 0) > 0 && h - last > STEP_HEIGHT) return false;
      if (r.ledges?.[c] === ON_LEDGE && h > last && (h - last > LEDGE || r.ground.steepAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r.reach))) return false;
      last = h;
    }
    if (t * len >= NEAR_SKIP && !r.open[c]) return false;
  }
  return !r.base || !bankNear(r.ground, a, b);
};

/** A step of the walk checked on the ground (m): about a ganger's run in a step of 60 Hz. */
const NEAR_STEP = 0.06;
/** A slide along a bank getting on less than this share of the walk stops the feet too: under the stuck check's pace (0.4 m in 1.5 s, of 3.1 m/s). */
const CREEP = 0.1;

/**
 * Do the feet stop by a bank (`offTheBank`, the movement's own rule) walking from `a` towards `b`
 * in its first `NEAR_SKIP` metres, where the open cells are not asked? Sliding along it they do
 * not, unless they get on no further than a creep. The raster's cells see no wall within one:
 * by the level ground before the abutment of Mełgiewska's lower bridge (G-738), its 1.5 m edge on
 * the skew closed in cells touching at their corners, a walker by it took the way over it within
 * the skip, or through a corner, and stood at its foot for good, pressed against it. Nor do they
 * when, slid along the foot of a wall, they end below the line's ground more than a walk climbs:
 * along the deck's edge over the abutment's ramp of that bridge the slide got on, and a step
 * further the way it led along the deck was left for the one back (G-740).
 */
export const bankNear = (ground: GroundField, a: Vec3, b: Vec3): boolean => {
  let at = a;
  for (let walked = 0; walked < NEAR_SKIP; walked += NEAR_STEP) {
    const d = Math.hypot(b.x - at.x, b.z - at.z);
    if (d < NEAR_STEP) return false;
    const to = offTheBank(ground, at, at.x + ((b.x - at.x) / d) * NEAR_STEP, at.z + ((b.z - at.z) / d) * NEAR_STEP, at.y);
    if (((to.x - at.x) * (b.x - at.x) + (to.z - at.z) * (b.z - at.z)) / d < CREEP * NEAR_STEP) return true;
    // The feet on the ground there, as far down as they follow it.
    const h = ground.heightAt(to.x, to.z, at.y + STEP_HEIGHT);
    at = { x: to.x, y: h > at.y || at.y - h <= SNAP_DOWN ? h : at.y, z: to.z };
  }
  // Slid along the foot of a wall that the line goes up (G-740): the feet are not on it.
  const k = Math.min(1, NEAR_SKIP / Math.hypot(b.x - a.x, b.z - a.z));
  return ground.heightAt(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, at.y + STEP_HEIGHT) - at.y > LEDGE;
};

/** Is the straight walk from `from` to `to` free at knee height (ADR-0021's walk test)? */
export const KNEE_HEIGHT = 0.6;
/**
 * On terrain (ADR-0043) the knee-high line ignores the ground itself (it dips under every
 * crest) and instead the way must not cross a bank too steep to walk, nor stop the feet by one in
 * its first metres (`bankNear`): its samples step over a wall sheer to its foot, and from under the
 * deck of Mełgiewska's lower bridge the walk went straight at a goal on it, pressed against its
 * edge (G-740). `height` puts the line elsewhere above the feet.
 */
export const straightWalk = (world: World<Entity>, from: Vec3, to: Vec3, height = KNEE_HEIGHT): boolean => {
  const ground = groundOf(world);
  const knee = (p: Vec3) => ({ x: p.x, y: p.y + height, z: p.z });
  if (!ground.hasTerrain) return lineOfSight(world, knee(from), knee(to));
  return lineOfSight(world, knee(from), knee(to), false) && !bankBetween(ground, from, to, deckReach(ground, from, to)) && !bankNear(ground, from, to);
};

/**
 * Does the way from `a` to `b` on the ground cross a bank too steep to walk, or climb onto a
 * flight hung off a bridge more than a step high (its side, G-255, which the slope at the
 * samples steps over)? Sampled every half cell.
 */
const bankBetween = (ground: GroundField, a: Vec3, b: Vec3, reach: number): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(len / NAV_CELL);
  // The heights only where a flight is near the way: elsewhere (almost everywhere) no cost.
  const flights = ground.nearFlight(Math.min(a.x, b.x), Math.min(a.z, b.z), 0, Math.max(a.x, b.x), Math.max(a.z, b.z));
  let last = flights ? ground.heightAt(a.x, a.z, reach) : 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const [x, z] = [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t];
    if (ground.steepAt(x, z, reach)) return true;
    if (!flights) continue;
    const h = ground.heightAt(x, z, reach);
    if (h - last > STEP_HEIGHT && ground.onFlight(x, z)) return true;
    last = h;
  }
  return false;
};
