import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Aabb } from "../../world/collision";
import type { Entity } from "../../world/components";
import { groundOf } from "../../world/ground";
import { solidIndexOf } from "../../world/solid-index";
import { collidersOf } from "../../world/solids";
import { STEP_HEIGHT } from "../movement-system";
import { type NavMemo, heldRaster, recall, remember } from "./nav-memo";
import { CLEARANCE, LEDGE, NAV_CELL, ON_LEDGE, type Raster, STEPS, type Slices, WALL_DIAGONAL, cellIndex, finish, rasterise } from "./nav-raster";

/**
 * The distance fields of the steering (ADR-0025, `steering.ts`): the windows rasterised round a
 * goal, the Dijkstra field grown from its cell, and their memo per world.
 */

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
export const NEAR_WINDOW = windowOf("near", 40, 8, 8, 16);
/**
 * A ganger cut off from its target in `NEAR_WINDOW` (a long fence or a wall of a yard, G-625)
 * looks again in this one, 192 m a side (`chaseDetour`): a raster costs some 37 ms and a field
 * some 15 (a near one's 20 and 3), so the ganger keeps the goal it planned for and plans anew
 * seldom (`GangerWalk`). Of the long barriers the near window leaves cut off, a 128 m one leads
 * round a quarter, this one two fifths, a 256 m one hardly more at twice its cost. Four rasters:
 * the four round a corner of the `snap` grid, where goals a step apart fall into different ones.
 */
export const WIDE_WINDOW = windowOf("wide", 96, 32, 4, 8);

/** The goal's cell closed (someone at a counter): the field grows from the nearest open cell this close. */
const GOAL_SEARCH = 4;

type Solid = Entity & { solid: Aabb };

export interface Field {
  readonly raster: Raster;
  /** Walking distance to the goal in half cells (a straight step 2, a diagonal 3), `FAR` where unreachable. */
  readonly dist: Int32Array;
  readonly source: number;
}

type Memo = NavMemo<Raster, Field>;

const memos = new WeakMap<World<Entity>, Map<string, Memo>>();

export const memoOf = (world: World<Entity>, win: Window): Memo => {
  let byWindow = memos.get(world);
  if (!byWindow) {
    byWindow = new Map();
    memos.set(world, byWindow);
  }
  let m = byWindow.get(win.name);
  if (!m) {
    m = { rasters: new Map(), fields: new Map(), built: { rasters: 0, fields: 0, units: 0 } };
    byWindow.set(win.name, m);
  }
  return m;
};

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

/** Distance of a cell the field does not reach. */
export const FAR = 0x3fffffff;

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
  // Not up the side of a bridge's deck over lower ground either (`ledgesOf`, G-741): round by its
  // end. Down off it, over the edge, it may.
  if (r.base && r.ledges?.[out ? n : c] === ON_LEDGE) {
    const [from, to] = out ? [c, n] : [n, c];
    if ((r.base[to] ?? 0) - (r.base[from] ?? 0) > (dx !== 0 && dz !== 0 ? LEDGE * Math.SQRT2 : LEDGE)) return -1;
  }
  return n;
};

/**
 * Dijkstra over the open cells with a bucket queue: the costs are small integers, so a ring of
 * four buckets holds every distance still in play. Cells leave a bucket in the order they went
 * in, so the field is the same on every machine, and the same grown in slices (G-643): a yield
 * every row's worth of cells settled.
 */
function* growSteps(raster: Raster, source: number): Slices<Field> {
  const dist = new Int32Array(raster.cells * raster.cells).fill(FAR);
  dist[source] = 0;
  const buckets: number[][] = [[source], [], [], []];
  let pending = 1;
  let settled = 0;
  for (let d = 0; pending > 0; d++) {
    const bucket = buckets[d & 3] ?? [];
    for (let i = 0; i < bucket.length; i++) {
      const c = bucket[i] ?? 0;
      pending--;
      if ((dist[c] ?? FAR) !== d) continue;
      if (++settled === raster.cells) {
        yield settled;
        settled = 0;
      }
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
  if (settled > 0) yield settled;
  return { raster, dist, source };
}

export const grow = (raster: Raster, source: number): Field => finish(growSteps(raster, source));

/** The nearest cell around `c` (rings outwards, fixed order) that passes `ok`, or -1. */
export const nearest = (c: number, reach: number, cells: number, ok: (n: number) => boolean): number => {
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

/** The window round `goal`: its centre, its corner and the static solids in it. */
export const windowAt = (world: World<Entity>, win: Window, goal: Vec3) => {
  const { half, snap } = win;
  const cx = Math.round(goal.x / snap) * snap;
  const cz = Math.round(goal.z / snap) * snap;
  const x0 = cx - half;
  const z0 = cz - half;
  return { cx, cz, x0, z0, solids: staticSolidsIn(world, x0 - CLEARANCE, z0 - CLEARANCE, x0 + 2 * half + CLEARANCE, z0 + 2 * half + CLEARANCE) };
};

export function* fieldSteps(world: World<Entity>, win: Window, floor: number, reach: number, goal: Vec3, at = windowAt(world, win, goal)): Slices<Field | null> {
  const { cx, cz, x0, z0, solids } = at;
  const { cells } = win;
  const memo = memoOf(world, win);
  const rasterKey = `${floor}|${reach}|${cx}|${cz}|${signature(solids)}`;
  let raster = recall(memo.rasters, rasterKey) ?? heldRaster(memo.fields, rasterKey);
  if (!raster) {
    raster = yield* rasterise(collidersOf(solids), floor, reach, x0, z0, groundOf(world), cells);
    memo.built.rasters++;
  }
  remember(memo.rasters, rasterKey, raster, win.rasters);
  const goalCell = cellIndex(raster, goal.x, goal.z);
  if (goalCell < 0) return null;
  const source = nearest(goalCell, GOAL_SEARCH, cells, (n) => raster.open[n] === 1);
  if (source < 0) return null;
  const fieldKey = `${rasterKey}|${source}`;
  const field = recall(memo.fields, fieldKey);
  if (field) return field;
  const grown = yield* growSteps(raster, source);
  memo.built.fields++;
  return remember(memo.fields, fieldKey, grown, win.fields);
}

export const fieldFor = (world: World<Entity>, win: Window, floor: number, reach: number, goal: Vec3): Field | null => finish(fieldSteps(world, win, floor, reach, goal), memoOf(world, win).built);

/**
 * How many rasters of the wide window a world made and fields it grew so far, and the units of
 * work (cells gone through) they took (G-625, G-643: their cost is what a step pays).
 */
export const wideBuilds = (world: World<Entity>): { readonly rasters: number; readonly fields: number; readonly units: number } => ({ ...memoOf(world, WIDE_WINDOW).built });
/** The same of the near window (G-644: a raster pushed out of its memo is made again). */
export const nearBuilds = (world: World<Entity>): { readonly rasters: number; readonly fields: number; readonly units: number } => ({ ...memoOf(world, NEAR_WINDOW).built });

/** A way round obstacles to one goal: the distance field the walker follows. */
export interface Detour {
  readonly goal: Vec3;
  readonly field: Field;
}

/**
 * Is `from` a cell or more outside the window round `goal`? Its way would start off the field
 * (`followDetour` null) whatever the raster: a ganger left 400 m behind by a player who ran on
 * built a wide raster of empty land for nothing, once per goal and again after a load.
 */
export const outsideWindow = (win: Window, from: Vec3, goal: Vec3): boolean => {
  const cx = Math.round(goal.x / win.snap) * win.snap;
  const cz = Math.round(goal.z / win.snap) * win.snap;
  return Math.max(Math.abs(from.x - cx), Math.abs(from.z - cz)) > win.half + NAV_CELL;
};

/** The next cell down the field from `c` towards its goal, or -1 at the bottom. */
export const downhill = (field: Field, c: number): number => {
  const { raster, dist } = field;
  let next = -1;
  let best = dist[c] ?? FAR;
  for (const [dx, dz] of STEPS) {
    const n = passable(raster, c, dx, dz, true);
    if (n >= 0 && (dist[n] ?? FAR) < best) {
      next = n;
      best = dist[n] ?? FAR;
    }
  }
  return next;
};
