import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../../world/components";
import { type GroundField, MAX_WALK_SLOPE, groundOf, heightApart } from "../../world/ground";
import { STEP_HEIGHT } from "../movement-system";
import { type Detour, FAR, type Field, NEAR_WINDOW, downhill, fieldFor, grow, nearest, outsideWindow } from "./nav-field";
import { CLEARANCE, NAV_CELL, ON_FLIGHT, type Raster, byLedge, cellCentre, cellIndex, cellRange } from "./nav-raster";
import { wallOnWay } from "./nav-walls";
import { SAME_FLOOR, SAMPLE, bankNear, deckReach, floorOf, straightWalk, walkable } from "./straight-walk";

export { NAV_CELL } from "./nav-raster";
export { type Detour, nearBuilds, wideBuilds } from "./nav-field";
export { KNEE_HEIGHT, SAME_FLOOR, floorOf, straightWalk } from "./straight-walk";
export { advanceChaseDetours, chaseDetour, chaseWork, sameChaseKey, sameWideWindow, startChaseDetour } from "./chase-detour";

/**
 * Walking around obstacles on one floor (ADR-0025). The level graph (ADR-0021) says which
 * stairs to take; this module says how to get somewhere on the floor an NPC already stands on
 * when the straight line is blocked (the flank of a flight of stairs, a stall, a row of
 * containers).
 *
 * A square window around the goal is rasterised from the static solids into 0.5 m cells (a
 * cell is open when a body standing in it touches nothing it cannot step onto, and, above the
 * street, when there is a floor under it). A Dijkstra distance field grows from the goal's
 * cell; an NPC anywhere in the window walks down the field, and string-pulling picks the
 * farthest cell of that way it can walk to in a straight line. Everything is a pure function
 * of the solids, the floor height and the goal: the raster and the field are memoised per
 * world, but a miss gives exactly what a hit would, so a loaded game continues like the
 * original. Kinematic solids (lift platforms and gates) are left out: they move.
 *
 * On terrain (ADR-0043) the ground floor follows it: each cell is measured from the terrain
 * under it, and a cell on a bank steeper than MAX_WALK_SLOPE is closed. Prisms close the cells
 * their walls touch, like boxes.
 */

/** How far down the field the string-pulling looks for a straight walk. */
const LOOKAHEAD = 64;

/** Bodies of other characters closed off in a private copy of the raster (a repath after getting stuck). */
const withBodies = (field: Field, avoid: readonly Vec3[], ground: GroundField): Field => {
  const r = field.raster;
  const open = Uint8Array.from(r.open);
  const reach = 0.38 + CLEARANCE;
  for (const b of avoid) {
    if (Math.abs(b.y - (r.floor === 0 ? ground.heightAt(b.x, b.z, r.reach) : r.floor)) > SAME_FLOOR) continue;
    const [ix0, ix1] = cellRange(b.x - reach, b.x + reach, r.x0, r.cells);
    const [iz0, iz1] = cellRange(b.z - reach, b.z + reach, r.z0, r.cells);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const c = iz * r.cells + ix;
        const at = cellCentre(r, c, b.y);
        if (Math.hypot(at.x - b.x, at.z - b.z) < reach && c !== field.source) open[c] = 0;
      }
    }
  }
  return grow({ ...r, open }, field.source);
};

/**
 * By the side of a bridge's deck over lower ground (`ledgesOf`, G-741), is cell `n` above the feet
 * at `from` where they do not get (`bankNear`, the movement's own rule)? The edge, steep where the
 * cells meet, and the bank beside it make a pocket the cells do not show: a walker pressed into it
 * by the east end of the footbridge of podzamcze-2-0 set out from a cell up the bank or on the
 * deck, and stood there for good.
 */
const outOfReach = (r: Raster, n: number, from: Vec3): boolean => !!r.ledges && (r.base?.[n] ?? 0) > from.y && byLedge(r, n) && bankNear(r.ground, from, cellCentre(r, n, from.y));

/**
 * The cell of the field a walker at `from` sets out from, or -1 when it is off the field (outside
 * the window, cut off). Pressed against a wall its own cell may be closed: the best open cell next
 * to it. Not across a wall in the ground (a flight's side, G-255): a cell within a step of the
 * feet; by a bridge's deck, one the feet get to (`outOfReach`, G-741); nor up a wall between cells
 * (`wallOnWay`, G-740), onto a deck by the edge the feet stand under.
 */
const startOf = (field: Field, from: Vec3): number => {
  const { raster, dist } = field;
  const here = cellIndex(raster, from.x, from.z);
  if (here < 0) return -1;
  const reachable = (n: number) =>
    (dist[n] ?? FAR) < FAR &&
    (!raster.base || raster.flight?.[n] !== ON_FLIGHT || Math.abs((raster.base[n] ?? 0) - from.y) <= STEP_HEIGHT) &&
    !outOfReach(raster, n, from) &&
    !wallOnWay(raster, from, cellCentre(raster, n, from.y), SAMPLE);
  return (dist[here] ?? FAR) < FAR ? here : nearest(here, 2, raster.cells, reachable);
};

/**
 * The way round from `from` to `goal` on this floor, or null when the goal is on another
 * floor, outside the window or not reachable here (the caller then falls back on the level
 * graph or on a straight line). With `avoid`, other characters count as obstacles too: a fresh
 * field, not memoised, for a walker that got stuck behind its own people.
 */
export const planDetour = (world: World<Entity>, from: Vec3, goal: Vec3, avoid: readonly Vec3[] = []): Detour | null => {
  if (heightApart(world, goal, from) > SAME_FLOOR) return null;
  const ground = groundOf(world);
  const field = fieldFor(world, NEAR_WINDOW, floorOf(from.y, ground.heightAt(from.x, from.z, from.y + STEP_HEIGHT)), deckReach(ground, from, goal), goal);
  if (!field) return null;
  return { goal, field: avoid.length > 0 ? withBodies(field, avoid, ground) : field };
};

/**
 * How much longer than the straight line (times it, plus metres) the walk from a ganger to its goal
 * is at least, by the wide field, before `cutOffNear` takes the goal for cut off: a near way
 * round a box or a stall is longer by a metre or two, a way round a long fence by tens of metres.
 */
const CUT_OFF_RATIO = 1.2;
const CUT_OFF_SLACK = 2;

/**
 * Is `goal` cut off from `from` in the near window round it, by the way of `detour` (G-644)? A
 * ganger on such a way round a long barrier follows it without asking that window, which would
 * only find it cut off again and, a dozen of them after a dozen goals, push its rasters out of the
 * memo every step. Two signs, both needed. The walk from `from` to `goal` is at least the
 * difference of their distances down the field (to the goal the field was grown for, a few metres
 * from `goal`): far more than the straight line, `goal` lies behind the barrier. Not when it is on
 * the ganger's side of it (the target came round): the near window then leads, shortly, and this
 * way would take it round the barrier to the old goal (round 2 of G-644). And the way leaves the
 * near window round `goal`, where the near window cannot follow it. Walking down the field costs
 * some cells, not a raster; and as a pure function of the field it gives a loaded game the same
 * answer.
 */
export const cutOffNear = (detour: Detour, from: Vec3, goal: Vec3): boolean => {
  const { field } = detour;
  const here = startOf(field, from);
  const there = startOf(field, goal);
  if (here < 0 || there < 0) return false;
  // Half cells to metres.
  const apart = (((field.dist[here] ?? FAR) - (field.dist[there] ?? FAR)) * NAV_CELL) / 2;
  if (apart <= CUT_OFF_RATIO * Math.hypot(goal.x - from.x, goal.z - from.z) + CUT_OFF_SLACK) return false;
  const { snap, half } = NEAR_WINDOW;
  const cx = Math.round(goal.x / snap) * snap;
  const cz = Math.round(goal.z / snap) * snap;
  for (let c = here; c >= 0; c = downhill(field, c)) {
    const at = cellCentre(field.raster, c, from.y);
    if (Math.max(Math.abs(at.x - cx), Math.abs(at.z - cz)) > half) return true;
  }
  return false;
};

/**
 * Where to walk this step along a detour: a point on the shortest open way, as far along it as
 * a straight walk reaches. Null when `from` is off the field (outside the window, cut off).
 */
export const followDetour = (detour: Detour, from: Vec3): Vec3 | null => {
  const { goal, field } = detour;
  const { raster, dist } = field;
  const start = startOf(field, from);
  if (start < 0) return null;
  const way: number[] = [start];
  for (let c = start; way.length < LOOKAHEAD && (dist[c] ?? 0) > 0; ) {
    const next = downhill(field, c);
    if (next < 0) break;
    way.push(next);
    c = next;
  }
  const last = way[way.length - 1] ?? start;
  if (last === field.source && walkable(raster, from, goal)) return goal;
  for (let i = way.length - 1; i > 0; i--) {
    const at = cellCentre(raster, way[i] ?? start, from.y);
    if (walkable(raster, from, at)) return at;
  }
  const round = reachableLower(field, from, start);
  return cellCentre(raster, round >= 0 ? round : (way[1] ?? start), from.y);
};

/** How far round the feet (cells) `reachableLower` looks: two metres. */
const REACH_AROUND = 4;

/**
 * With no cell of the way a straight walk from `from` (G-747): the cell round the feet lowest
 * down the field below the way's start (the nearest of equals) that the feet get to, a straight
 * walk away on their level; -1 when there is none. The way's next cell, the old answer, often lies
 * up a bank or a deck's edge the walk does not climb: beside the bridge of podzamcze-1-0 the walker
 * pressed against the bank for good, with a cell further down the way a straight walk away 1.5 m
 * aside. With none, the way's next cell is still the answer: from a pocket the field does not
 * show, the stuck check's sidestep gets the walker out (by the west end of Mełgiewska's lower
 * bridge only that way).
 */
const reachableLower = (field: Field, from: Vec3, start: number): number => {
  const { raster, dist } = field;
  const here = cellIndex(raster, from.x, from.z);
  if (here < 0) return -1;
  const ix = here % raster.cells;
  const iz = (here - ix) / raster.cells;
  let [best, bestDist, bestSq] = [-1, dist[start] ?? FAR, Infinity];
  for (let dz = -REACH_AROUND; dz <= REACH_AROUND; dz++) {
    for (let dx = -REACH_AROUND; dx <= REACH_AROUND; dx++) {
      const [nx, nz] = [ix + dx, iz + dz];
      if (nx < 0 || nz < 0 || nx >= raster.cells || nz >= raster.cells) continue;
      const n = nz * raster.cells + nx;
      const d = dist[n] ?? FAR;
      const sq = dx * dx + dz * dz;
      if (d > bestDist || (d === bestDist && (best < 0 || sq >= bestSq))) continue;
      const at = cellCentre(raster, n, from.y);
      if (offLevel(raster, n, from, at) || !walkable(raster, from, at)) continue;
      [best, bestDist, bestSq] = [n, d, sq];
    }
  }
  return best;
};

/**
 * Does cell `n` (at `at`) lie above or below the feet at `from` by more than a step and a walkable
 * slope over the way there? `walkable` asks the rise only by a flight or a deck's edge, and the
 * cells only past its first metres: by the west end of Mełgiewska's lower bridge it let the walker
 * at the foot of the abutment's wall take a cell on top of it, three metres up, and on the steps
 * off Zamkowa's viaduct one on the square beside them, three metres down over their side.
 */
const offLevel = (r: Raster, n: number, from: Vec3, at: Vec3): boolean =>
  !!r.base && Math.abs((r.base[n] ?? from.y) - from.y) > STEP_HEIGHT + MAX_WALK_SLOPE * Math.hypot(at.x - from.x, at.z - from.z);

/**
 * `planDetour` and `followDetour` in one: the step round the static obstacles. None from outside
 * the window round `goal`, without making its raster (G-643): a dozen gangers come round a long
 * barrier on their wide ways, each asking for its goal's near raster every step to find itself
 * off it, pushed the near rasters out of the memo and made three of them again every step.
 */
export const detourStep = (world: World<Entity>, from: Vec3, goal: Vec3): Vec3 | null => {
  if (outsideWindow(NEAR_WINDOW, from, goal)) return null;
  const d = planDetour(world, from, goal);
  return d ? followDetour(d, from) : null;
};

/**
 * The point to walk towards this step: straight at `goal` when the walk is free (or the goal is
 * on another floor), around the obstacle otherwise. `forceDetour` (a walker that made no
 * progress for a while) takes the way around even when the knee-high line looks free.
 */
export const steerPoint = (world: World<Entity>, from: Vec3, goal: Vec3, forceDetour = false): Vec3 => {
  if (heightApart(world, goal, from) > SAME_FLOOR) return goal;
  if (!forceDetour && straightWalk(world, from, goal)) return goal;
  return detourStep(world, from, goal) ?? goal;
};
