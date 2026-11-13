import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Aabb } from "../../world/collision";
import type { Entity } from "../../world/components";
import { DECK_HEADROOM } from "../../world/deck";
import { type GroundField, groundOf, heightApart } from "../../world/ground";
import { lineOfSight } from "../../world/hitscan";
import { solidIndexOf } from "../../world/solid-index";
import { collidersOf } from "../../world/solids";
import { SNAP_DOWN, STEP_HEIGHT, offTheBank } from "../movement-system";
import { type NavMemo, heldRaster, recall, remember } from "./nav-memo";
import { CLEARANCE, LEDGE, NAV_CELL, ON_FLIGHT, ON_LEDGE, type Raster, STEPS, type Slices, WALL_DIAGONAL, byLedge, cellCentre, cellIndex, cellRange, finish, rasterWork, rasterise } from "./nav-raster";
import { wallOnWay } from "./nav-walls";

export { NAV_CELL } from "./nav-raster";

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

interface Field {
  readonly raster: Raster;
  /** Walking distance to the goal in half cells (a straight step 2, a diagonal 3), `FAR` where unreachable. */
  readonly dist: Int32Array;
  readonly source: number;
}

type Memo = NavMemo<Raster, Field>;

const memos = new WeakMap<World<Entity>, Map<string, Memo>>();

const memoOf = (world: World<Entity>, win: Window): Memo => {
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

/** Distance of a cell the field does not reach. */
const FAR = 0x3fffffff;

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

const grow = (raster: Raster, source: number): Field => finish(growSteps(raster, source));

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
 * w294098693 (0.56 m), and one under the viaduct at its eastern one; nor a smaller rise there
 * where the movement's slope is too steep, the terrain falling along the edge (by the west end of
 * the footbridge of podzamcze-2-0 the walk cut its corner, G-741). On terrain, the feet not
 * stopped by a bank in the skipped metres either (`bankNear`, G-738), nor the way up a wall
 * between cells (`wallOnWay`, G-740).
 */
const walkable = (r: Raster, a: Vec3, b: Vec3): boolean => {
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
const bankNear = (ground: GroundField, a: Vec3, b: Vec3): boolean => {
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

/** The window round `goal`: its centre, its corner and the static solids in it. */
const windowAt = (world: World<Entity>, win: Window, goal: Vec3) => {
  const { half, snap } = win;
  const cx = Math.round(goal.x / snap) * snap;
  const cz = Math.round(goal.z / snap) * snap;
  const x0 = cx - half;
  const z0 = cz - half;
  return { cx, cz, x0, z0, solids: staticSolidsIn(world, x0 - CLEARANCE, z0 - CLEARANCE, x0 + 2 * half + CLEARANCE, z0 + 2 * half + CLEARANCE) };
};

function* fieldSteps(world: World<Entity>, win: Window, floor: number, reach: number, goal: Vec3, at = windowAt(world, win, goal)): Slices<Field | null> {
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

const fieldFor = (world: World<Entity>, win: Window, floor: number, reach: number, goal: Vec3): Field | null => finish(fieldSteps(world, win, floor, reach, goal), memoOf(world, win).built);

/**
 * How many rasters of the wide window a world made and fields it grew so far, and the units of
 * work (cells gone through) they took (G-625, G-643: their cost is what a step pays).
 */
export const wideBuilds = (world: World<Entity>): { readonly rasters: number; readonly fields: number; readonly units: number } => ({ ...memoOf(world, WIDE_WINDOW).built });
/** The same of the near window (G-644: a raster pushed out of its memo is made again). */
export const nearBuilds = (world: World<Entity>): { readonly rasters: number; readonly fields: number; readonly units: number } => ({ ...memoOf(world, NEAR_WINDOW).built });

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
 * Is `from` a cell or more outside the window round `goal`? Its way would start off the field
 * (`followDetour` null) whatever the raster: a ganger left 400 m behind by a player who ran on
 * built a wide raster of empty land for nothing, once per goal and again after a load.
 */
const outsideWindow = (win: Window, from: Vec3, goal: Vec3): boolean => {
  const cx = Math.round(goal.x / win.snap) * win.snap;
  const cz = Math.round(goal.z / win.snap) * win.snap;
  return Math.max(Math.abs(from.x - cx), Math.abs(from.z - cz)) > win.half + NAV_CELL;
};

/** The wide ways of the chases, kept with their goals: by the floor and the decks' reach they were made for. */
const chases = new WeakMap<Vec3, { readonly key: string; readonly detour: Detour | null }>();

/** The floor and the decks' reach of a walker at `from` after `goal`: what its wide way is kept by. */
const chaseKey = (world: World<Entity>, from: Vec3, goal: Vec3) => {
  const ground = groundOf(world);
  const floor = floorOf(from.y, ground.heightAt(from.x, from.z, from.y + STEP_HEIGHT));
  const reach = deckReach(ground, from, goal);
  return { floor, reach, key: `${floor}|${reach}` };
};

/** A wide way being made a slice a step (G-643), for its goal and key. */
interface WideJob {
  readonly goal: Vec3;
  readonly key: string;
  readonly steps: Slices<Field | null>;
}

/** The wide ways started in a world and not made yet, in the order they were started. */
const jobs = new WeakMap<World<Entity>, WideJob[]>();

const keep = (goal: Vec3, key: string, field: Field | null): Detour | null => {
  const detour = field ? { goal, field } : null;
  chases.set(goal, { key, detour });
  return detour;
};

/**
 * The way round to the goal of a chase in `WIDE_WINDOW` (G-625), or null when it has none from
 * this floor. Kept with the goal object itself, not only in the memo: a ganger holds its goal
 * (`WalkProgress.chase`) for many steps, and a few of them round a corner of the window grid
 * would otherwise push each other's rasters out of the memo and make them again every step. A
 * pure function of the static solids, the floor and the goal, as `planDetour`; one started by
 * `startChaseDetour` and not made yet is finished now.
 */
export const chaseDetour = (world: World<Entity>, from: Vec3, goal: Vec3): Detour | null => {
  if (heightApart(world, goal, from) > SAME_FLOOR || outsideWindow(WIDE_WINDOW, from, goal)) return null;
  const { floor, reach, key } = chaseKey(world, from, goal);
  const held = chases.get(goal);
  if (held?.key === key) return held.detour;
  const started = jobs.get(world) ?? [];
  const i = started.findIndex((j) => j.goal === goal && j.key === key);
  const job = started[i];
  if (job) {
    started.splice(i, 1);
    return keep(goal, key, finish(job.steps, memoOf(world, WIDE_WINDOW).built));
  }
  return keep(goal, key, fieldFor(world, WIDE_WINDOW, floor, reach, goal));
};

/**
 * At most how many units of work the wide way of a chase to `goal` for a walker at `from` takes
 * (G-643): its field's, and with `raster` its raster's; 0 when it has nothing to make
 * (`chaseDetour` null at no cost). A pure function of the static solids, the floor and the goal,
 * whatever the memo holds.
 */
export const chaseWork = (world: World<Entity>, from: Vec3, goal: Vec3, raster: boolean): number => {
  if (heightApart(world, goal, from) > SAME_FLOOR || outsideWindow(WIDE_WINDOW, from, goal)) return 0;
  const { cells } = WIDE_WINDOW;
  if (!raster) return cells * cells;
  const at = windowAt(world, WIDE_WINDOW, goal);
  return rasterWork(collidersOf(at.solids), chaseKey(world, from, goal).floor, at.x0, at.z0, groundOf(world), cells) + cells * cells;
};

/**
 * Starts making the wide way of a chase to `goal` for a walker at `from` (G-643), which
 * `advanceChaseDetours` goes on with a slice a step; `chaseDetour` asked for it before it is made
 * makes the rest at once. Before the first started one that `before` holds for (G-694), else last.
 */
export const startChaseDetour = (world: World<Entity>, from: Vec3, goal: Vec3, before: (goal: Vec3) => boolean = () => false): void => {
  const { floor, reach, key } = chaseKey(world, from, goal);
  let started = jobs.get(world);
  if (!started) jobs.set(world, (started = []));
  const at = started.findIndex((j) => before(j.goal));
  started.splice(at < 0 ? started.length : at, 0, { goal, key, steps: fieldSteps(world, WIDE_WINDOW, floor, reach, goal) });
};

/** Would walkers at `a` and at `b` after `goal` share its wide way (the floor and the decks' reach it is kept by)? */
export const sameChaseKey = (world: World<Entity>, a: Vec3, b: Vec3, goal: Vec3): boolean => chaseKey(world, a, goal).key === chaseKey(world, b, goal).key;

/**
 * Makes up to about `budget` units of the wide ways started (G-643), the first started first, two
 * rows past it at most; those no walker waits for any more (`wanted` false) are dropped.
 */
export const advanceChaseDetours = (world: World<Entity>, budget: number, wanted: (goal: Vec3) => boolean): void => {
  const started = jobs.get(world);
  const built = memoOf(world, WIDE_WINDOW).built;
  let spent = 0;
  while (started && started.length > 0 && spent < budget) {
    const job = started[0] as WideJob;
    const s = wanted(job.goal) ? job.steps.next() : null;
    if (!s || s.done) {
      started.shift();
      if (s) keep(job.goal, job.key, s.value);
    } else {
      spent += s.value;
      built.units += s.value;
    }
  }
};

/** Do two goals share the window of their wide ways (one raster)? */
export const sameWideWindow = (a: Vec3, b: Vec3): boolean => {
  const { snap } = WIDE_WINDOW;
  return Math.round(a.x / snap) === Math.round(b.x / snap) && Math.round(a.z / snap) === Math.round(b.z / snap);
};

/** The next cell down the field from `c` towards its goal, or -1 at the bottom. */
const downhill = (field: Field, c: number): number => {
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
  return cellCentre(raster, way[1] ?? start, from.y);
};

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
