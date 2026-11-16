import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../../world/components";
import { DECK_HEADROOM, type GroundDeck } from "../../world/deck";
import { type GroundField, groundOf } from "../../world/ground";
import { STEP_HEIGHT } from "../movement-system";
import { clipTo } from "./straight-walk";

/*
 * The way off a bridge's deck to the ground under it (G-072). A walker on the deck and
 * a goal under it stand on one floor as floors go (`heightApart` measures each from the ground under
 * it, G-062), and the walk sees the deck as overhead for a goal under it (`deckReach`): its raster
 * took the deck's walker for one under it, walked it to the point over the goal and stood it there
 * for good, the deck between them stopping shots and sight (G-071). The way down is off the deck's
 * end, where it comes down to the terrain: the walker goes there first, then under it. From there
 * the walk keeps off the deck where it rises out of its reach (`pastLedge`, `straightWalk`): it led
 * the walker back onto it, from the street by the end of Mełgiewska's lower bridge too.
 */

/** How far out past a deck's end its landing lies (m): off the deck, on the ground. */
const PAST_END = 1;
/** How far round a walker the bridges' landings are looked for (m): the chase's wide window's reach. */
const LANDING_REACH = 96;

/**
 * Do feet at `p` stand on a bridge's deck high over the terrain, where a walk that sees the deck as
 * overhead (`deckReach`) has them on the terrain under it? On its low end, no room under it, that
 * walk sees the deck itself and leads off it (`pastLedge`, `straightWalk`).
 */
const overDeck = (ground: GroundField, p: Vec3): boolean => ground.heightAt(p.x, p.z, p.y + STEP_HEIGHT) - ground.heightAt(p.x, p.z, -Infinity) > STEP_HEIGHT;

/** Is a bridge's deck over feet at `p` (`deckReach`'s rule)? */
const underDeck = (ground: GroundField, p: Vec3): boolean => ground.heightAt(p.x, p.z, p.y + STEP_HEIGHT) < ground.heightAt(p.x, p.z);

/** How often the feet's way to a goal on a deck is sampled for the deck over them (m). */
const FEET_STEP = 0.5;

/**
 * Do feet walking straight from `a` to `b` pass under a bridge's deck with room to stand (G-885)?
 * Just out from under it, by its edge, the walk at a goal on it sees no bank to climb (the feet go
 * under the edge) and leads them back under it: there the way was off to the deck's end, a step
 * later back at the goal, and so on for good. Not by a deck's low side (`DECK_HEADROOM`), which the
 * walk round its end leads past (G-741). Sampled only across the decks' boxes: off them the feet
 * are on the terrain.
 */
const passesUnder = (ground: GroundField, a: Vec3, b: Vec3): boolean => {
  let [t0, t1] = [1, 0];
  for (const box of ground.decksNear(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z))) {
    const span = clipTo(a, b, box);
    if (span) [t0, t1] = [Math.min(t0, span[0]), Math.max(t1, span[1])];
  }
  if (t0 > t1) return false;
  const [ax, az] = [a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0];
  const n = Math.ceil(((t1 - t0) * Math.hypot(b.x - a.x, b.z - a.z)) / FEET_STEP);
  let feet = t0 === 0 ? a.y : ground.heightAt(ax, az, -Infinity);
  for (let i = 1; i <= n; i++) {
    const [x, z] = [ax + ((b.x - a.x) * (t1 - t0) * i) / n, az + ((b.z - a.z) * (t1 - t0) * i) / n];
    feet = ground.heightAt(x, z, feet + STEP_HEIGHT);
    if (ground.heightAt(x, z) - feet > DECK_HEADROOM) return true;
  }
  return false;
};

/** Is `from` on its way to `to` on a deck high over the terrain from under it, or from beside it under its edge (G-885)? */
const upTo = (ground: GroundField, from: Vec3, to: Vec3): boolean => !overDeck(ground, from) && overDeck(ground, to) && (underDeck(ground, from) || passesUnder(ground, from, to));

/** The point `PAST_END` out past end `e` of a deck, away from its other end `o`. */
const past = (e: { x: number; z: number }, o: { x: number; z: number }) => {
  const d = Math.hypot(e.x - o.x, e.z - o.z);
  return d < 1e-6 ? null : { x: e.x + ((e.x - o.x) / d) * PAST_END, z: e.z + ((e.z - o.z) / d) * PAST_END };
};

/** The landings of a deck: past each end that comes down to the ground, where a deck overhead or not is the same floor. */
const landingsOf = (ground: GroundField, d: GroundDeck): Vec3[] =>
  [past(d.a, d.b), past(d.b, d.a)].flatMap((p) => {
    if (!p) return [];
    const under = ground.heightAt(p.x, p.z, -Infinity);
    return ground.heightAt(p.x, p.z) - under <= STEP_HEIGHT ? [{ x: p.x, y: under, z: p.z }] : [];
  });

/**
 * Where a walker at `from` on a bridge's deck goes first on its way to `to` under one (G-072): the
 * landing of a bridge near it that makes the shortest way of the two legs, off the deck and back
 * under it. So too the other way, from under a deck to a goal on it (G-885): the walk under it
 * has the goal on the terrain under the goal's feet, and the walker stood there for good. Null
 * when they are not so apart, or no bridge near comes down to the terrain.
 */
export const deckLanding = (world: World<Entity>, from: Vec3, to: Vec3): Vec3 | null => {
  const ground = groundOf(world);
  if (!ground.hasTerrain || ground.bridges.length === 0) return null;
  if (!(overDeck(ground, from) && underDeck(ground, to)) && !upTo(ground, from, to)) return null;
  let best: Vec3 | null = null;
  let cost = Infinity;
  for (const d of ground.bridges) {
    const b = d.box;
    if (from.x < b.minX - LANDING_REACH || from.x > b.maxX + LANDING_REACH || from.z < b.minZ - LANDING_REACH || from.z > b.maxZ + LANDING_REACH) continue;
    for (const l of landingsOf(ground, d)) {
      const c = Math.hypot(l.x - from.x, l.z - from.z) + Math.hypot(to.x - l.x, to.z - l.z);
      if (c < cost) [best, cost] = [l, c];
    }
  }
  return best;
};
