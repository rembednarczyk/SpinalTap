import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Aabb } from "../../world/collision";
import type { Entity } from "../../world/components";
import { type GroundField, MAX_WALK_SLOPE, groundOf, heightApart } from "../../world/ground";
import { lineOfSight } from "../../world/hitscan";
import { type Collider, closestXZ, collidersOf, colliderTop, overCollider } from "../../world/solids";
import { SNAP_DOWN, STEP_HEIGHT } from "../movement-system";

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

/** Cell edge, metres. Narrow enough that the 2.4 m gap past the market stairs has open cells. */
export const NAV_CELL = 0.5;
/** Half the window's edge, metres; the window is centred on the goal snapped to `WINDOW_SNAP`. */
const WINDOW_HALF = 40;
/** Window centres snap to this grid, so goals close to each other share a raster. */
const WINDOW_SNAP = 8;
const CELLS = Math.round((2 * WINDOW_HALF) / NAV_CELL);
/** Body radius (0.38) plus a margin: the way keeps off walls instead of scraping along them. */
const CLEARANCE = 0.48;
const BODY_HEIGHT = 1.8;
/** A goal more than this above or below is on another floor: the level graph's job. */
export const SAME_FLOOR = 1;
/** How far down the field the string-pulling looks for a straight walk. */
const LOOKAHEAD = 64;
/** Spacing of the samples of the straight-walk test, metres. */
const SAMPLE = 0.2;
/** Near the walker its own cell may count as closed (it stands against a wall); the test skips that far. */
const NEAR_SKIP = 0.6;
/** The goal's cell closed (someone at a counter): the field grows from the nearest open cell this close. */
const GOAL_SEARCH = 4;
/** Memo sizes per world: a few goals at a time (the player, a victim, homes). */
const MAX_RASTERS = 8;
const MAX_FIELDS = 16;

type Solid = Entity & { solid: Aabb };

interface Raster {
  readonly x0: number;
  readonly z0: number;
  readonly floor: number;
  /** 1 where a body can stand, row-major by z then x. */
  readonly open: Uint8Array;
}

interface Field {
  readonly raster: Raster;
  /** Walking distance to the goal in half cells (a straight step 2, a diagonal 3), `FAR` where unreachable. */
  readonly dist: Int32Array;
  readonly source: number;
}

interface Memo {
  readonly rasters: Map<string, Raster>;
  readonly fields: Map<string, Field>;
}

const memos = new WeakMap<World<Entity>, Memo>();

const memoOf = (world: World<Entity>): Memo => {
  let m = memos.get(world);
  if (!m) {
    m = { rasters: new Map(), fields: new Map() };
    memos.set(world, m);
  }
  return m;
};

/** Least recently used out once the map is full (Map keeps insertion order). */
const remember = <T>(map: Map<string, T>, key: string, value: T, max: number): T => {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const first = map.keys().next();
    if (first.done) break;
    map.delete(first.value);
  }
  return value;
};

const recall = <T>(map: Map<string, T>, key: string): T | undefined => {
  const v = map.get(key);
  if (v !== undefined) {
    map.delete(key);
    map.set(key, v);
  }
  return v;
};

/**
 * The floor a character walks on, rounded so that a sidewalk kerb is still the street. `ground`
 * is the terrain under it (ADR-0043): 0, the ground floor, is anywhere within a step of it.
 */
export const floorOf = (y: number, ground = 0): number => (y - ground < STEP_HEIGHT ? 0 : Math.round(y * 4) / 4);

const staticSolidsIn = (world: World<Entity>, x0: number, z0: number, x1: number, z1: number): Solid[] => {
  const out: Solid[] = [];
  for (const e of world.with("solid")) {
    if (e.velocity) continue;
    const s = e.solid;
    if (s.max.x < x0 || s.min.x > x1 || s.max.z < z0 || s.min.z > z1) continue;
    out.push(e);
  }
  return out;
};

/** Identity of a set of solids (order-free): which ones they are. Static solids never change shape. */
const signature = (solids: readonly Solid[]): string => {
  let sum = 0;
  let mix = 0;
  for (const s of solids) {
    sum = (sum + s.id) % 2147483647;
    mix = (mix ^ Math.imul(s.id + 1, 2654435761)) >>> 0;
  }
  return `${solids.length}:${sum}:${mix}`;
};

const cellRange = (lo: number, hi: number, origin: number): [number, number] => [
  Math.max(0, Math.ceil((lo - origin) / NAV_CELL - 0.5)),
  Math.min(CELLS - 1, Math.floor((hi - origin) / NAV_CELL - 0.5)),
];

const centre = (i: number, origin: number) => origin + (i + 0.5) * NAV_CELL;

/** Terrain height at every cell centre of the window, or null where the world has no terrain. */
const terrainOf = (ground: GroundField, x0: number, z0: number): Float64Array | null => {
  if (!ground.hasTerrain) return null;
  const base = new Float64Array(CELLS * CELLS);
  for (let iz = 0; iz < CELLS; iz++) for (let ix = 0; ix < CELLS; ix++) base[iz * CELLS + ix] = ground.heightAt(centre(ix, x0), centre(iz, z0));
  return base;
};

/** Cells of the ground floor on a bank too steep to walk (ADR-0043) are closed. */
const closeBanks = (open: Uint8Array, base: Float64Array, ground: GroundField, x0: number, z0: number): void => {
  // A cheap test on the cell grid first; the movement system's own slope decides the rest.
  const rough = 0.8 * MAX_WALK_SLOPE * 2 * NAV_CELL;
  for (let iz = 1; iz < CELLS - 1; iz++) {
    for (let ix = 1; ix < CELLS - 1; ix++) {
      const c = iz * CELLS + ix;
      const gx = Math.abs((base[c + 1] ?? 0) - (base[c - 1] ?? 0));
      const gz = Math.abs((base[c + CELLS] ?? 0) - (base[c - CELLS] ?? 0));
      if (Math.hypot(gx, gz) < rough) continue;
      if (ground.steepAt(centre(ix, x0), centre(iz, z0))) open[c] = 0;
    }
  }
};

const near = { x: 0, z: 0 };

const rasterise = (solids: readonly Collider[], floor: number, x0: number, z0: number, ground: GroundField): Raster => {
  const open = new Uint8Array(CELLS * CELLS);
  const base = terrainOf(ground, x0, z0);
  if (floor === 0) {
    open.fill(1);
    if (base) closeBanks(open, base, ground, x0, z0);
  } else {
    // Above the street only tops at about this height are floor; everything else is a drop.
    for (const c of solids) {
      const b = c.box;
      const [ix0, ix1] = cellRange(b.min.x, b.max.x, x0);
      const [iz0, iz1] = cellRange(b.min.z, b.max.z, z0);
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const x = centre(ix, x0);
          const z = centre(iz, z0);
          if (c.prism && !overCollider(c, x, z)) continue;
          const top = colliderTop(c, x, z);
          if (top >= floor - SNAP_DOWN && top <= floor + STEP_HEIGHT) open[iz * CELLS + ix] = 1;
        }
      }
    }
    // A hillside at the height of a roof or a deck is floor too.
    if (base) for (let i = 0; i < base.length; i++) if ((base[i] ?? 0) >= floor - SNAP_DOWN && (base[i] ?? 0) <= floor + STEP_HEIGHT) open[i] = 1;
  }
  // Closed where the body would touch a solid it cannot step onto (movementSystem's rule, a wider body).
  const r2 = CLEARANCE * CLEARANCE;
  const relative = floor === 0 && base !== null;
  for (const c of solids) {
    const b = c.box;
    if (!relative && (b.min.y >= floor + BODY_HEIGHT || b.max.y <= floor + STEP_HEIGHT)) continue;
    const [ix0, ix1] = cellRange(b.min.x - CLEARANCE, b.max.x + CLEARANCE, x0);
    const [iz0, iz1] = cellRange(b.min.z - CLEARANCE, b.max.z + CLEARANCE, z0);
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = centre(iz, z0);
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = centre(ix, x0);
        const q = closestXZ(c, x, z, near);
        if ((x - q.x) ** 2 + (z - q.z) ** 2 >= r2) continue;
        const ref = relative ? (base[iz * CELLS + ix] ?? 0) : floor;
        if (relative && b.min.y >= ref + BODY_HEIGHT) continue;
        if (colliderTop(c, q.x, q.z) > ref + STEP_HEIGHT) open[iz * CELLS + ix] = 0;
      }
    }
  }
  return { x0, z0, floor, open };
};

/** Distance of a cell the field does not reach. */
const FAR = 0x3fffffff;

/** Neighbour offsets in a fixed order (straight ones first); integer costs, a diagonal 3/2 of a straight step (√2 ≈ 1.41). */
const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 2],
  [-1, 0, 2],
  [0, 1, 2],
  [0, -1, 2],
  [1, 1, 3],
  [-1, 1, 3],
  [1, -1, 3],
  [-1, -1, 3],
];

/** Can a body move from cell `c` by (dx, dz)? A diagonal needs both straight neighbours open (no corner cutting). */
const passable = (open: Uint8Array, c: number, dx: number, dz: number): number => {
  const ix = c % CELLS;
  const iz = (c - ix) / CELLS;
  const nx = ix + dx;
  const nz = iz + dz;
  if (nx < 0 || nz < 0 || nx >= CELLS || nz >= CELLS) return -1;
  const n = nz * CELLS + nx;
  if (!open[n]) return -1;
  if (dx !== 0 && dz !== 0 && (!open[iz * CELLS + nx] || !open[nz * CELLS + ix])) return -1;
  return n;
};

/**
 * Dijkstra over the open cells with a bucket queue: the costs are small integers, so a ring of
 * four buckets holds every distance still in play. Cells leave a bucket in the order they went
 * in, so the field is the same on every machine.
 */
const grow = (raster: Raster, source: number): Field => {
  const dist = new Int32Array(CELLS * CELLS).fill(FAR);
  dist[source] = 0;
  const buckets: number[][] = [[source], [], [], []];
  let pending = 1;
  for (let d = 0; pending > 0; d++) {
    const bucket = buckets[d & 3] ?? [];
    for (let i = 0; i < bucket.length; i++) {
      const c = bucket[i] ?? 0;
      pending--;
      if ((dist[c] ?? FAR) !== d) continue;
      for (const [dx, dz, cost] of STEPS) {
        const n = passable(raster.open, c, dx, dz);
        if (n < 0) continue;
        const nd = d + cost;
        if (nd < (dist[n] ?? FAR)) {
          dist[n] = nd;
          buckets[nd & 3]?.push(n);
          pending++;
        }
      }
    }
    bucket.length = 0;
  }
  return { raster, dist, source };
};

const cellIndex = (r: Raster, x: number, z: number): number => {
  const ix = Math.floor((x - r.x0) / NAV_CELL);
  const iz = Math.floor((z - r.z0) / NAV_CELL);
  return ix < 0 || iz < 0 || ix >= CELLS || iz >= CELLS ? -1 : iz * CELLS + ix;
};

const cellCentre = (r: Raster, c: number, y: number): Vec3 => {
  const ix = c % CELLS;
  const iz = (c - ix) / CELLS;
  return { x: r.x0 + (ix + 0.5) * NAV_CELL, y, z: r.z0 + (iz + 0.5) * NAV_CELL };
};

/** The nearest cell around `c` (rings outwards, fixed order) that passes `ok`, or -1. */
const nearest = (c: number, reach: number, ok: (n: number) => boolean): number => {
  if (ok(c)) return c;
  const ix = c % CELLS;
  const iz = (c - ix) / CELLS;
  for (let ring = 1; ring <= reach; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx < 0 || nz < 0 || nx >= CELLS || nz >= CELLS) continue;
        const n = nz * CELLS + nx;
        const d = dx * dx + dz * dz;
        if (d < bestD && ok(n)) {
          best = n;
          bestD = d;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
};

/** True when a body walks from `a` to `b` through open cells only (the first `NEAR_SKIP` metres excepted). */
const walkable = (r: Raster, a: Vec3, b: Vec3): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(len / SAMPLE);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (t * len < NEAR_SKIP) continue;
    const c = cellIndex(r, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (c < 0 || !r.open[c]) return false;
  }
  return true;
};

const fieldFor = (world: World<Entity>, floor: number, goal: Vec3): Field | null => {
  const cx = Math.round(goal.x / WINDOW_SNAP) * WINDOW_SNAP;
  const cz = Math.round(goal.z / WINDOW_SNAP) * WINDOW_SNAP;
  const x0 = cx - WINDOW_HALF;
  const z0 = cz - WINDOW_HALF;
  const solids = staticSolidsIn(world, x0 - CLEARANCE, z0 - CLEARANCE, x0 + 2 * WINDOW_HALF + CLEARANCE, z0 + 2 * WINDOW_HALF + CLEARANCE);
  const memo = memoOf(world);
  const rasterKey = `${floor}|${cx}|${cz}|${signature(solids)}`;
  const raster =
    recall(memo.rasters, rasterKey) ?? remember(memo.rasters, rasterKey, rasterise(collidersOf(solids), floor, x0, z0, groundOf(world)), MAX_RASTERS);
  const goalCell = cellIndex(raster, goal.x, goal.z);
  if (goalCell < 0) return null;
  const source = nearest(goalCell, GOAL_SEARCH, (n) => raster.open[n] === 1);
  if (source < 0) return null;
  const fieldKey = `${rasterKey}|${source}`;
  return recall(memo.fields, fieldKey) ?? remember(memo.fields, fieldKey, grow(raster, source), MAX_FIELDS);
};

/** Is the straight walk from `from` to `to` free at knee height (ADR-0021's walk test)? */
export const KNEE_HEIGHT = 0.6;
/**
 * On terrain (ADR-0043) the knee-high line ignores the ground itself (it dips under every
 * crest) and instead the way must not cross a bank too steep to walk.
 */
export const straightWalk = (world: World<Entity>, from: Vec3, to: Vec3): boolean => {
  const ground = groundOf(world);
  const knee = (p: Vec3) => ({ x: p.x, y: p.y + KNEE_HEIGHT, z: p.z });
  if (!ground.hasTerrain) return lineOfSight(world, knee(from), knee(to));
  return lineOfSight(world, knee(from), knee(to), false) && !bankBetween(ground, from, to);
};

/** Does the way from `a` to `b` on the ground cross a bank too steep to walk? Sampled every half cell. */
const bankBetween = (ground: GroundField, a: Vec3, b: Vec3): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(len / NAV_CELL);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (ground.steepAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true;
  }
  return false;
};

/** A way round obstacles to one goal: the distance field the walker follows. */
export interface Detour {
  readonly goal: Vec3;
  readonly field: Field;
}

/** Bodies of other characters closed off in a private copy of the raster (a repath after getting stuck). */
const withBodies = (field: Field, avoid: readonly Vec3[], ground: GroundField): Field => {
  const r = field.raster;
  const open = Uint8Array.from(r.open);
  const reach = 0.38 + CLEARANCE;
  for (const b of avoid) {
    if (Math.abs(b.y - (r.floor === 0 ? ground.heightAt(b.x, b.z) : r.floor)) > SAME_FLOOR) continue;
    const [ix0, ix1] = cellRange(b.x - reach, b.x + reach, r.x0);
    const [iz0, iz1] = cellRange(b.z - reach, b.z + reach, r.z0);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const c = iz * CELLS + ix;
        const at = cellCentre(r, c, b.y);
        if (Math.hypot(at.x - b.x, at.z - b.z) < reach && c !== field.source) open[c] = 0;
      }
    }
  }
  return grow({ ...r, open }, field.source);
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
  const field = fieldFor(world, floorOf(from.y, ground.heightAt(from.x, from.z)), goal);
  if (!field) return null;
  return { goal, field: avoid.length > 0 ? withBodies(field, avoid, ground) : field };
};

/**
 * Where to walk this step along a detour: a point on the shortest open way, as far along it as
 * a straight walk reaches. Null when `from` is off the field (outside the window, cut off).
 */
export const followDetour = (detour: Detour, from: Vec3): Vec3 | null => {
  const { goal, field } = detour;
  const { raster, dist } = field;
  const here = cellIndex(raster, from.x, from.z);
  if (here < 0) return null;
  // Pressed against a wall its own cell may be closed: start from the best open cell next to it.
  const start = (dist[here] ?? FAR) < FAR ? here : nearest(here, 2, (n) => (dist[n] ?? FAR) < FAR);
  if (start < 0) return null;
  const way: number[] = [start];
  for (let c = start; way.length < LOOKAHEAD && (dist[c] ?? 0) > 0; ) {
    let next = -1;
    let best = dist[c] ?? FAR;
    for (const [dx, dz] of STEPS) {
      const n = passable(raster.open, c, dx, dz);
      if (n >= 0 && (dist[n] ?? FAR) < best) {
        next = n;
        best = dist[n] ?? FAR;
      }
    }
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
  return cellCentre(raster, way[1] ?? start, from.y);
};

/** `planDetour` and `followDetour` in one: the step round the static obstacles. */
export const detourStep = (world: World<Entity>, from: Vec3, goal: Vec3): Vec3 | null => {
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
