import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Aabb } from "../../world/collision";
import type { Entity } from "../../world/components";
import { DECK_HEADROOM } from "../../world/deck";
import { type GroundField, MAX_WALK_SLOPE, groundOf, heightApart } from "../../world/ground";
import { lineOfSight } from "../../world/hitscan";
import { solidIndexOf } from "../../world/solid-index";
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
/**
 * A window of the raster: `half` its half edge (m), centred on the goal snapped to `snap` (goals
 * close to each other share a raster), `cells` a side; `rasters` and `fields` its memo's sizes
 * per world (a few goals at a time: the player, a victim, homes).
 */
interface Window {
  readonly name: string;
  readonly half: number;
  readonly snap: number;
  readonly cells: number;
  readonly rasters: number;
  readonly fields: number;
}

const windowOf = (name: string, half: number, snap: number, rasters: number, fields: number): Window => ({ name, half, snap, cells: Math.round((2 * half) / NAV_CELL), rasters, fields });

/** The window every walk plans in. */
const NEAR_WINDOW = windowOf("near", 40, 8, 8, 16);
/**
 * A ganger cut off from its target in `NEAR_WINDOW` (a long fence or a wall of a yard, G-625)
 * looks again in this one, 192 m a side (`chaseDetour`): a raster costs some 37 ms and a field
 * some 15 (a near one's 20 and 3), so the ganger keeps the goal it planned for and plans anew
 * seldom (`GangerWalk`). Of the long barriers the near window leaves cut off, a 128 m one leads
 * round a quarter, this one two fifths, a 256 m one hardly more at twice its cost. Four rasters:
 * the four round a corner of the `snap` grid, where goals a step apart fall into different ones.
 */
const WIDE_WINDOW = windowOf("wide", 96, 32, 4, 8);
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

type Solid = Entity & { solid: Aabb };

interface Raster {
  /** Cells a side (its window's). */
  readonly cells: number;
  readonly x0: number;
  readonly z0: number;
  readonly floor: number;
  /** The `reach` its ground is seen with: a bridge's deck high over the terrain is ground or overhead (G-062). */
  readonly reach: number;
  /** 1 where a body can stand, row-major by z then x. */
  readonly open: Uint8Array;
  /** The ground floor's height at each cell on terrain (ADR-0043), else null. */
  readonly base: Float64Array | null;
  /**
   * Near a flight of steps hung off a bridge (G-255), with `base`: `ON_FLIGHT` where a cell lies
   * on one, `NEAR_FLIGHT` within `FLIGHT_MARGIN` of one, else 0; null when none is near the window.
   */
  readonly flight: Uint8Array | null;
  /** With `base`, `ON_LEDGE` where a cell tops the edge of a bridge's deck with no room under it (`ledgesOf`), else 0; null when none is in the window. */
  readonly ledges: Uint8Array | null;
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
  /** Rasters made and fields grown so far: what the misses cost. */
  readonly built: { rasters: number; fields: number };
}

const memos = new WeakMap<World<Entity>, Map<string, Memo>>();

const memoOf = (world: World<Entity>, win: Window): Memo => {
  let byWindow = memos.get(world);
  if (!byWindow) {
    byWindow = new Map();
    memos.set(world, byWindow);
  }
  let m = byWindow.get(win.name);
  if (!m) {
    m = { rasters: new Map(), fields: new Map(), built: { rasters: 0, fields: 0 } };
    byWindow.set(win.name, m);
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

/** Static solids whose box overlaps the window (the raster and its signature do not depend on their order). */
const staticSolidsIn = (world: World<Entity>, x0: number, z0: number, x1: number, z1: number): Solid[] => solidIndexOf(world).near(x0, z0, x1, z1, true);

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

const cellRange = (lo: number, hi: number, origin: number, cells: number): [number, number] => [
  Math.max(0, Math.ceil((lo - origin) / NAV_CELL - 0.5)),
  Math.min(cells - 1, Math.floor((hi - origin) / NAV_CELL - 0.5)),
];

const centre = (i: number, origin: number) => origin + (i + 0.5) * NAV_CELL;

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
const deckReach = (ground: GroundField, a: Vec3, b: Vec3): number => {
  const underDeck = (p: Vec3) => ground.heightAt(p.x, p.z, p.y + STEP_HEIGHT) < ground.heightAt(p.x, p.z);
  return underDeck(a) || underDeck(b) || passesUnder(ground, a, b) ? -Infinity : Infinity;
};

/** Terrain height at every cell centre of the window, or null where the world has no terrain. */
const terrainOf = (ground: GroundField, x0: number, z0: number, reach: number, cells: number): Float64Array | null => {
  if (!ground.hasTerrain) return null;
  const base = new Float64Array(cells * cells);
  for (let iz = 0; iz < cells; iz++) for (let ix = 0; ix < cells; ix++) base[iz * cells + ix] = ground.heightAt(centre(ix, x0), centre(iz, z0), reach);
  return base;
};

/** A diagonal neighbour more than this higher is a wall: a step, or the steepest walkable slope over the diagonal if more. */
const WALL_DIAGONAL = Math.max(STEP_HEIGHT, MAX_WALK_SLOPE * NAV_CELL * Math.SQRT2);

const NEAR_FLIGHT = 1;
const ON_FLIGHT = 2;
/**
 * How far from a flight the walls in the ground round it are walls to the AI too (m): its sides,
 * the bridge's deck over its edge and by its landings (G-274). Elsewhere a bridge's edges keep
 * their headroom rule (G-062), and nothing is computed: one flight in the city.
 */
const FLIGHT_MARGIN = 4;

/** Which cells of the window lie on or near a flight of steps hung off a bridge (G-255), or null when none is near it. */
const flightsOf = (ground: GroundField, x0: number, z0: number, cells: number): Uint8Array | null => {
  const x1 = x0 + cells * NAV_CELL;
  const z1 = z0 + cells * NAV_CELL;
  if (!ground.nearFlight(x0, z0, FLIGHT_MARGIN, x1, z1)) return null;
  const out = new Uint8Array(cells * cells);
  for (let iz = 0; iz < cells; iz++) {
    const z = centre(iz, z0);
    for (let ix = 0; ix < cells; ix++) {
      const x = centre(ix, x0);
      if (ground.nearFlight(x, z, FLIGHT_MARGIN)) out[iz * cells + ix] = ground.onFlight(x, z) ? ON_FLIGHT : NEAR_FLIGHT;
    }
  }
  return out;
};

/**
 * The steepest rise from a cell to its neighbour that a walker climbs (m): the movement's slope
 * over the half metre it measures (ADR-0043). Onto a bridge's deck over its edge, by its
 * abutments, a rise more than that is a wall, a step of 0.44 m too.
 */
const LEDGE = MAX_WALK_SLOPE * NAV_CELL;
const ON_LEDGE = 1;

/**
 * Which cells of the window top the edge of a bridge's deck over the terrain with no room under
 * it (G-062), more than `LEDGE` (`LEDGE` · √2 diagonally) over a neighbour (`ON_LEDGE`), or null
 * when none is: by the abutments of the viaduct of Zamkowa (G-255). Only in a window with a
 * flight (`flight`): elsewhere the walk keeps its old ways along and onto the bridges' edges
 * (Mełgiewska, G-068; the footbridge of podzamcze-2-0), and no raster pays for it. The field keeps
 * the cells at their foot open, so the walk does not climb onto them. The deck is looked up only
 * at such a rise.
 */
const ledgesOf = (base: Float64Array, ground: GroundField, x0: number, z0: number, cells: number): Uint8Array | null => {
  let out: Uint8Array | null = null;
  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) {
      const h = base[iz * cells + ix] ?? 0;
      let edge = false;
      for (const [dx, dz] of STEPS) {
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx >= 0 && nz >= 0 && nx < cells && nz < cells) edge ||= h - (base[nz * cells + nx] ?? 0) > (dx !== 0 && dz !== 0 ? LEDGE * Math.SQRT2 : LEDGE);
      }
      if (!edge || !ground.onLowDeck(centre(ix, x0), centre(iz, z0))) continue;
      (out ??= new Uint8Array(cells * cells))[iz * cells + ix] = ON_LEDGE;
    }
  }
  return out;
};

/**
 * Cells of the ground floor on a bank too steep to walk (ADR-0043) are closed, and so are those
 * at the foot of a flight of steps hung off a bridge (G-255) more than a step over them: its side
 * is a wall on one line, which the slope at the cells' middles, either side of it, does not see.
 * The edges of a bridge's deck keep the headroom rule (G-062).
 */
const closeBanks = (open: Uint8Array, base: Float64Array, flight: Uint8Array | null, ground: GroundField, x0: number, z0: number, reach: number, cells: number): void => {
  // A cheap test on the cell grid first (half the limit, over two cells, edges one-sided);
  // the movement system's own slope decides the rest.
  const rough = 0.5 * MAX_WALK_SLOPE * NAV_CELL;
  const index = (ix: number, iz: number) => Math.min(cells - 1, Math.max(0, iz)) * cells + Math.min(cells - 1, Math.max(0, ix));
  const at = (ix: number, iz: number) => base[index(ix, iz)] ?? 0;
  // A neighbour more than `limit` higher where it or the cell (`own`) lies on a flight: its side,
  // or a bridge's deck over its edge (G-274).
  const wall = (ix: number, iz: number, h: number, limit: number, own: boolean) => (own || flight?.[index(ix, iz)] === ON_FLIGHT) && at(ix, iz) - h > limit;
  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) {
      const h = at(ix, iz);
      const own = flight?.[iz * cells + ix] === ON_FLIGHT;
      // Away from the flights (almost all the window) nothing to look at.
      if ((flight?.[iz * cells + ix] ?? 0) > 0) {
        const straight = wall(ix + 1, iz, h, STEP_HEIGHT, own) || wall(ix - 1, iz, h, STEP_HEIGHT, own) || wall(ix, iz + 1, h, STEP_HEIGHT, own) || wall(ix, iz - 1, h, STEP_HEIGHT, own);
        const diagonal = wall(ix + 1, iz + 1, h, WALL_DIAGONAL, own) || wall(ix - 1, iz + 1, h, WALL_DIAGONAL, own) || wall(ix + 1, iz - 1, h, WALL_DIAGONAL, own) || wall(ix - 1, iz - 1, h, WALL_DIAGONAL, own);
        if (straight || diagonal) open[iz * cells + ix] = 0;
      }
      if (!open[iz * cells + ix]) continue;
      const gx = Math.abs(at(ix + 1, iz) - at(ix - 1, iz));
      const gz = Math.abs(at(ix, iz + 1) - at(ix, iz - 1));
      if (Math.hypot(gx, gz) < rough) continue;
      if (ground.steepAt(centre(ix, x0), centre(iz, z0), reach)) open[iz * cells + ix] = 0;
    }
  }
};

const near = { x: 0, z: 0 };

const rasterise = (solids: readonly Collider[], floor: number, reach: number, x0: number, z0: number, ground: GroundField, cells: number): Raster => {
  const open = new Uint8Array(cells * cells);
  const base = terrainOf(ground, x0, z0, reach, cells);
  const flight = base && floor === 0 ? flightsOf(ground, x0, z0, cells) : null;
  const ledges = base && flight ? ledgesOf(base, ground, x0, z0, cells) : null;
  if (floor === 0) {
    open.fill(1);
    if (base) closeBanks(open, base, flight, ground, x0, z0, reach, cells);
  } else {
    // Above the street only tops at about this height are floor; everything else is a drop.
    for (const c of solids) {
      const b = c.box;
      const [ix0, ix1] = cellRange(b.min.x, b.max.x, x0, cells);
      const [iz0, iz1] = cellRange(b.min.z, b.max.z, z0, cells);
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const x = centre(ix, x0);
          const z = centre(iz, z0);
          if (c.prism && !overCollider(c, x, z)) continue;
          const top = colliderTop(c, x, z);
          if (top >= floor - SNAP_DOWN && top <= floor + STEP_HEIGHT) open[iz * cells + ix] = 1;
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
    const [ix0, ix1] = cellRange(b.min.x - CLEARANCE, b.max.x + CLEARANCE, x0, cells);
    const [iz0, iz1] = cellRange(b.min.z - CLEARANCE, b.max.z + CLEARANCE, z0, cells);
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = centre(iz, z0);
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = centre(ix, x0);
        const q = closestXZ(c, x, z, near);
        if ((x - q.x) ** 2 + (z - q.z) ** 2 >= r2) continue;
        const ref = relative ? (base[iz * cells + ix] ?? 0) : floor;
        if (relative && b.min.y >= ref + BODY_HEIGHT) continue;
        if (colliderTop(c, q.x, q.z) > ref + STEP_HEIGHT) open[iz * cells + ix] = 0;
      }
    }
  }
  return { cells, x0, z0, floor, reach, open, base: relative ? base : null, flight: relative ? flight : null, ledges: relative ? ledges : null };
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
const passable = (r: Raster, c: number, dx: number, dz: number, out: boolean): number => {
  const { open, cells } = r;
  const ix = c % cells;
  const iz = (c - ix) / cells;
  const nx = ix + dx;
  const nz = iz + dz;
  if (nx < 0 || nz < 0 || nx >= cells || nz >= cells) return -1;
  const n = nz * cells + nx;
  if (!open[n]) return -1;
  if (dx !== 0 && dz !== 0 && (!open[iz * cells + nx] || !open[nz * cells + ix])) return -1;
  // Near a flight, not up a wall in the ground more than a step high, as a bridge's deck over the
  // terrain by its landing (G-274): the movement makes it a bank. Down it may (`out`: from `c`).
  if (r.base && r.flight && ((r.flight[c] ?? 0) > 0 || (r.flight[n] ?? 0) > 0)) {
    const [from, to] = out ? [c, n] : [n, c];
    if ((r.base[to] ?? 0) - (r.base[from] ?? 0) > (dx !== 0 && dz !== 0 ? WALL_DIAGONAL : STEP_HEIGHT)) return -1;
  }
  return n;
};

/**
 * Dijkstra over the open cells with a bucket queue: the costs are small integers, so a ring of
 * four buckets holds every distance still in play. Cells leave a bucket in the order they went
 * in, so the field is the same on every machine.
 */
const grow = (raster: Raster, source: number): Field => {
  const dist = new Int32Array(raster.cells * raster.cells).fill(FAR);
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
        const n = passable(raster, c, dx, dz, false);
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
  return ix < 0 || iz < 0 || ix >= r.cells || iz >= r.cells ? -1 : iz * r.cells + ix;
};

const cellCentre = (r: Raster, c: number, y: number): Vec3 => {
  const ix = c % r.cells;
  const iz = (c - ix) / r.cells;
  return { x: r.x0 + (ix + 0.5) * NAV_CELL, y, z: r.z0 + (iz + 0.5) * NAV_CELL };
};

/** The nearest cell around `c` (rings outwards, fixed order) that passes `ok`, or -1. */
const nearest = (c: number, reach: number, cells: number, ok: (n: number) => boolean): number => {
  if (ok(c)) return c;
  const ix = c % cells;
  const iz = (c - ix) / cells;
  for (let ring = 1; ring <= reach; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx < 0 || nz < 0 || nx >= cells || nz >= cells) continue;
        const n = nz * cells + nx;
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

/**
 * True when a body walks from `a` to `b` through open cells only (the first `NEAR_SKIP` metres
 * excepted), in a window with a flight hung off a bridge never climbing more than a step between
 * two samples onto one or by it: its side (G-255, whose foot is closed only a cell wide); nor
 * onto a bridge's deck over its edge (`ledgesOf`) more than a walkable rise, which the open
 * cells do not show: the chase along Podwale stopped at the viaduct's western abutment by
 * w294098693 (0.56 m), and one under the viaduct at its eastern one.
 */
const walkable = (r: Raster, a: Vec3, b: Vec3): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(len / SAMPLE);
  // Cell to cell, the feet's own included: on a tread the feet lie off their cell's height.
  const start = cellIndex(r, a.x, a.z);
  let last = r.base && start >= 0 ? (r.base[start] ?? a.y) : a.y;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = cellIndex(r, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (c < 0) return false;
    if (r.base && (r.flight || r.ledges)) {
      const h = r.base[c] ?? 0;
      if ((r.flight?.[c] ?? 0) > 0 && h - last > STEP_HEIGHT) return false;
      if (r.ledges?.[c] === ON_LEDGE && h - last > LEDGE) return false;
      last = h;
    }
    if (t * len >= NEAR_SKIP && !r.open[c]) return false;
  }
  return true;
};

const fieldFor = (world: World<Entity>, win: Window, floor: number, reach: number, goal: Vec3): Field | null => {
  const { half, snap, cells } = win;
  const cx = Math.round(goal.x / snap) * snap;
  const cz = Math.round(goal.z / snap) * snap;
  const x0 = cx - half;
  const z0 = cz - half;
  const solids = staticSolidsIn(world, x0 - CLEARANCE, z0 - CLEARANCE, x0 + 2 * half + CLEARANCE, z0 + 2 * half + CLEARANCE);
  const memo = memoOf(world, win);
  const rasterKey = `${floor}|${reach}|${cx}|${cz}|${signature(solids)}`;
  let raster = recall(memo.rasters, rasterKey);
  if (!raster) {
    memo.built.rasters++;
    raster = remember(memo.rasters, rasterKey, rasterise(collidersOf(solids), floor, reach, x0, z0, groundOf(world), cells), win.rasters);
  }
  const goalCell = cellIndex(raster, goal.x, goal.z);
  if (goalCell < 0) return null;
  const source = nearest(goalCell, GOAL_SEARCH, cells, (n) => raster.open[n] === 1);
  if (source < 0) return null;
  const fieldKey = `${rasterKey}|${source}`;
  const field = recall(memo.fields, fieldKey);
  if (field) return field;
  memo.built.fields++;
  return remember(memo.fields, fieldKey, grow(raster, source), win.fields);
};

/** How many rasters of the wide window a world made and fields it grew so far (G-625: their cost is what a step pays). */
export const wideBuilds = (world: World<Entity>): { readonly rasters: number; readonly fields: number } => ({ ...memoOf(world, WIDE_WINDOW).built });

/** Is the straight walk from `from` to `to` free at knee height (ADR-0021's walk test)? */
export const KNEE_HEIGHT = 0.6;
/**
 * On terrain (ADR-0043) the knee-high line ignores the ground itself (it dips under every
 * crest) and instead the way must not cross a bank too steep to walk. `height` puts the line
 * elsewhere above the feet.
 */
export const straightWalk = (world: World<Entity>, from: Vec3, to: Vec3, height = KNEE_HEIGHT): boolean => {
  const ground = groundOf(world);
  const knee = (p: Vec3) => ({ x: p.x, y: p.y + height, z: p.z });
  if (!ground.hasTerrain) return lineOfSight(world, knee(from), knee(to));
  return lineOfSight(world, knee(from), knee(to), false) && !bankBetween(ground, from, to, deckReach(ground, from, to));
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
 * The cell of the field a walker at `from` sets out from, or -1 when it is off the field (outside
 * the window, cut off). Pressed against a wall its own cell may be closed: the best open cell next
 * to it. Not across a wall in the ground (a flight's side, G-255): a cell within a step of the feet.
 */
const startOf = (field: Field, from: Vec3): number => {
  const { raster, dist } = field;
  const here = cellIndex(raster, from.x, from.z);
  if (here < 0) return -1;
  const reachable = (n: number) => (dist[n] ?? FAR) < FAR && (!raster.base || raster.flight?.[n] !== ON_FLIGHT || Math.abs((raster.base[n] ?? 0) - from.y) <= STEP_HEIGHT);
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

/** The wide ways of the chases, kept with their goals: by the floor and the decks' reach they were made for. */
const chases = new WeakMap<Vec3, { readonly key: string; readonly detour: Detour | null }>();

/**
 * The way round to the goal of a chase in `WIDE_WINDOW` (G-625), or null when it has none from
 * this floor. Kept with the goal object itself, not only in the memo: a ganger holds its goal
 * (`WalkProgress.chase`) for many steps, and a few of them round a corner of the window grid
 * would otherwise push each other's rasters out of the memo and make them again every step. A
 * pure function of the static solids, the floor and the goal, as `planDetour`.
 */
export const chaseDetour = (world: World<Entity>, from: Vec3, goal: Vec3): Detour | null => {
  if (heightApart(world, goal, from) > SAME_FLOOR) return null;
  const ground = groundOf(world);
  const floor = floorOf(from.y, ground.heightAt(from.x, from.z, from.y + STEP_HEIGHT));
  const reach = deckReach(ground, from, goal);
  const key = `${floor}|${reach}`;
  const held = chases.get(goal);
  if (held?.key === key) return held.detour;
  const field = fieldFor(world, WIDE_WINDOW, floor, reach, goal);
  const detour = field ? { goal, field } : null;
  chases.set(goal, { key, detour });
  return detour;
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
    let next = -1;
    let best = dist[c] ?? FAR;
    for (const [dx, dz] of STEPS) {
      const n = passable(raster, c, dx, dz, true);
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
