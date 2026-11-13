import { type GroundField, MAX_WALK_SLOPE } from "../../world/ground";
import { type Collider, closestXZ, colliderTop, overCollider } from "../../world/solids";
import { SNAP_DOWN, STEP_HEIGHT, offTheBank } from "../movement-system";

/*
 * The raster of a window of the steering (ADR-0025): which 0.5 m cells a body stands in, made from
 * the static solids and the terrain. Made in slices (G-643): the builders yield the cells they
 * went through as they go, about a row's worth at a time, so that the wide window's raster, some
 * 37 ms whole, is spread over steps; `finish` makes one at once. The result is the same either way.
 */

/** Cell edge, metres. Narrow enough that the 2.4 m gap past the market stairs has open cells. */
export const NAV_CELL = 0.5;
/** Body radius (0.38) plus a margin: the way keeps off walls instead of scraping along them. */
export const CLEARANCE = 0.48;
const BODY_HEIGHT = 1.8;

/** Work in slices: each yield the cells gone through since the last one, the result at the end. */
export type Slices<T> = Generator<number, T, void>;

/** Runs `steps` to the end at once: the units of work it took added to `spent`. */
export const finish = <T>(steps: Slices<T>, spent: { units: number } = { units: 0 }): T => {
  for (;;) {
    const s = steps.next();
    if (s.done) return s.value;
    spent.units += s.value;
  }
};

export interface Raster {
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
  /** With `base`, `ON_LEDGE` where a cell tops the edge of a bridge's deck with no room under it (`ledgesOf`), else 0; null when none is in the window. A wall to walk up, as the movement has it (G-741). */
  readonly ledges: Uint8Array | null;
  /** With `base`, where the way from a cell to a straight neighbour goes up a wall (`wallsAt`, G-740, bits `WALL_TO`); null off the ground floor. */
  readonly walls: Uint8Array | null;
  /** The ground it was made on: the walk's first steps are checked on it, as the movement has them (G-738). */
  readonly ground: GroundField;
}

export const cellRange = (lo: number, hi: number, origin: number, cells: number): [number, number] => [
  Math.max(0, Math.ceil((lo - origin) / NAV_CELL - 0.5)),
  Math.min(cells - 1, Math.floor((hi - origin) / NAV_CELL - 0.5)),
];

const centre = (i: number, origin: number) => origin + (i + 0.5) * NAV_CELL;

/** The cell of the raster holding (x, z), or -1 outside its window. */
export const cellIndex = (r: Pick<Raster, "x0" | "z0" | "cells">, x: number, z: number): number => {
  const ix = Math.floor((x - r.x0) / NAV_CELL);
  const iz = Math.floor((z - r.z0) / NAV_CELL);
  return ix < 0 || iz < 0 || ix >= r.cells || iz >= r.cells ? -1 : iz * r.cells + ix;
};

/** The middle of cell `c`, at height `y`. */
export const cellCentre = (r: Pick<Raster, "x0" | "z0" | "cells">, c: number, y: number): { x: number; y: number; z: number } => {
  const ix = c % r.cells;
  const iz = (c - ix) / r.cells;
  return { x: r.x0 + (ix + 0.5) * NAV_CELL, y, z: r.z0 + (iz + 0.5) * NAV_CELL };
};

/** Neighbour offsets in a fixed order (straight ones first); integer costs, a diagonal 3/2 of a straight step (√2 ≈ 1.41). */
export const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 2],
  [-1, 0, 2],
  [0, 1, 2],
  [0, -1, 2],
  [1, 1, 3],
  [-1, 1, 3],
  [1, -1, 3],
  [-1, -1, 3],
];

/** Terrain height at every cell centre of the window, or null where the world has no terrain. */
function* terrainOf(ground: GroundField, x0: number, z0: number, reach: number, cells: number): Slices<Float64Array | null> {
  if (!ground.hasTerrain) return null;
  const base = new Float64Array(cells * cells);
  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) base[iz * cells + ix] = ground.heightAt(centre(ix, x0), centre(iz, z0), reach);
    yield cells;
  }
  return base;
}

/** A diagonal neighbour more than this higher is a wall: a step, or the steepest walkable slope over the diagonal if more. */
export const WALL_DIAGONAL = Math.max(STEP_HEIGHT, MAX_WALK_SLOPE * NAV_CELL * Math.SQRT2);

const NEAR_FLIGHT = 1;
export const ON_FLIGHT = 2;
/**
 * How far from a flight the walls in the ground round it are walls to the AI too (m): its sides,
 * the bridge's deck over its edge and by its landings (G-274). Elsewhere a bridge's edges are
 * walls only where they rise more than a walkable slope (`ledgesOf`, G-741): one flight in the city.
 */
const FLIGHT_MARGIN = 4;

const nearFlight = (ground: GroundField, x0: number, z0: number, cells: number): boolean => ground.nearFlight(x0, z0, FLIGHT_MARGIN, x0 + cells * NAV_CELL, z0 + cells * NAV_CELL);

/** Which cells of the window lie on or near a flight of steps hung off a bridge (G-255), or null when none is near it. */
function* flightsOf(ground: GroundField, x0: number, z0: number, cells: number): Slices<Uint8Array | null> {
  if (!nearFlight(ground, x0, z0, cells)) return null;
  const out = new Uint8Array(cells * cells);
  for (let iz = 0; iz < cells; iz++) {
    const z = centre(iz, z0);
    for (let ix = 0; ix < cells; ix++) {
      const x = centre(ix, x0);
      if (ground.nearFlight(x, z, FLIGHT_MARGIN)) out[iz * cells + ix] = ground.onFlight(x, z) ? ON_FLIGHT : NEAR_FLIGHT;
    }
    yield cells;
  }
  return out;
}

/**
 * The steepest rise from a cell to its neighbour that a walker climbs (m): the movement's slope
 * over the half metre it measures (ADR-0043). Onto a bridge's deck over its edge, by its
 * abutments, a rise more than that is a wall, a step of 0.44 m too.
 */
export const LEDGE = MAX_WALK_SLOPE * NAV_CELL;
export const ON_LEDGE = 1;

/** Does a bridge's deck lie in the window? Almost everywhere none: no raster pays for `ledgesOf`. */
const decksIn = (ground: GroundField, x0: number, z0: number, cells: number): boolean => ground.decksNear(x0, z0, x0 + cells * NAV_CELL, z0 + cells * NAV_CELL).length > 0;

/**
 * Which cells of the window top the edge of a bridge's deck over the terrain with no room under
 * it (G-062), more than `LEDGE` (`LEDGE` · √2 diagonally) over a neighbour (`ON_LEDGE`), or null
 * when none is: by the abutments of the viaduct of Zamkowa (G-255), along the sides of every deck
 * over lower ground (G-741: beside the footbridge of podzamcze-2-0, its deck level with the
 * street, the field led straight up its side and the walker stood at its foot). The field and the
 * walk do not climb onto them; down off them, over the edge, they go (Mełgiewska, G-068). The
 * cells at their foot stay open. The deck is looked up only at such a rise.
 */
function* ledgesOf(base: Float64Array, ground: GroundField, x0: number, z0: number, cells: number): Slices<Uint8Array | null> {
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
    yield cells;
  }
  return out;
}

/** Is cell `n` of the raster or a neighbour of it on the edge of a bridge's deck over lower ground (`ledgesOf`)? */
export const byLedge = (r: Raster, n: number): boolean => {
  const ix = n % r.cells;
  const iz = (n - ix) / r.cells;
  if (r.ledges?.[n] === ON_LEDGE) return true;
  for (const [dx, dz] of STEPS) {
    const [nx, nz] = [ix + dx, iz + dz];
    if (nx >= 0 && nz >= 0 && nx < r.cells && nz < r.cells && r.ledges?.[nz * r.cells + nx] === ON_LEDGE) return true;
  }
  return false;
};

/**
 * Cells of the ground floor on a bank too steep to walk (ADR-0043) are closed, and so are those
 * at the foot of a flight of steps hung off a bridge (G-255) more than a step over them: its side
 * is a wall on one line, which the slope at the cells' middles, either side of it, does not see.
 * The edges of a bridge's deck keep the headroom rule (G-062).
 */
function* closeBanks(open: Uint8Array, walls: Uint8Array, base: Float64Array, flight: Uint8Array | null, ground: GroundField, x0: number, z0: number, reach: number, cells: number): Slices<void> {
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
      wallsAt(walls, base, flight, ground, x0, z0, ix, iz, cells, rough);
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
    yield cells;
  }
}

/** Bits of `Raster.walls`: the way from the cell to its neighbour in +x, -x, +z, -z goes up a wall. */
const WALL_TO = { east: 1, west: 2, north: 4, south: 8 } as const;

/**
 * Does the way from cell `from` to its straight neighbour `to` go up a wall (`Raster.walls`)?
 */
export const walled = (r: Pick<Raster, "walls">, from: number, to: number, cells: number): boolean => {
  const d = to - from;
  const bit = d === 1 ? WALL_TO.east : d === -1 ? WALL_TO.west : d === cells ? WALL_TO.north : WALL_TO.south;
  return ((r.walls?.[from] ?? 0) & bit) !== 0;
};

/**
 * Where the way from cell (`ix`, `iz`) of the ground floor to its neighbour in +x or +z, or back,
 * goes up a wall: the feet on the lower one's middle, more than a little lower (`rough`), do not
 * get to the higher one's by the movement's own rule (`stepsAcross`). A wall sheer to its foot, of
 * the terrain or of a low deck, is steep only on a strip narrower than a cell, which the slope at
 * the cells' middles either side of it does not show: by the deck's edge over the abutment's ramp
 * of Mełgiewska's lower bridge (G-740) the walk took the way up it, and the feet stayed at its
 * foot. Not by a flight, which has its own rule (`closeBanks`, `passable`).
 */
const wallsAt = (walls: Uint8Array, base: Float64Array, flight: Uint8Array | null, ground: GroundField, x0: number, z0: number, ix: number, iz: number, cells: number, rough: number): void => {
  const c = iz * cells + ix;
  const h = base[c] ?? 0;
  for (const [dx, dz, up, down] of [
    [1, 0, WALL_TO.east, WALL_TO.west],
    [0, 1, WALL_TO.north, WALL_TO.south],
  ] as const) {
    if (ix + dx >= cells || iz + dz >= cells) continue;
    const n = c + dx + dz * cells;
    const hn = base[n] ?? 0;
    if (Math.abs(hn - h) <= rough || (flight?.[c] ?? 0) > 0 || (flight?.[n] ?? 0) > 0) continue;
    const [x, z] = [centre(ix, x0), centre(iz, z0)];
    const [dir, bit, cell] = hn > h ? [1, up, c] : [-1, down, n];
    const from = { x: x + (dir < 0 ? dx * NAV_CELL : 0), y: Math.min(h, hn), z: z + (dir < 0 ? dz * NAV_CELL : 0) };
    if (!stepsAcross(ground, from, dir * dx, dir * dz)) walls[cell] = (walls[cell] ?? 0) | bit;
  }
};

/** A step of the movement walked across (m): about a ganger's run in a step of 60 Hz. */
const STEP = 0.06;

/**
 * Do the feet at `from` get a cell further along (`dx`, `dz`) by the movement's own rule
 * (`offTheBank`), within a few centimetres? A slide along the bank off the way does not count.
 * With no bank a quarter, a half and three quarters of the way they do: the movement's slope is
 * measured over half a metre, so a sheer edge between the middles is steep at one of them.
 */
const stepsAcross = (ground: GroundField, from: { x: number; y: number; z: number }, dx: number, dz: number): boolean => {
  let bank = false;
  for (let t = 0.25; t < 1 && !bank; t += 0.25) bank = ground.steepAt(from.x + dx * t * NAV_CELL, from.z + dz * t * NAV_CELL, from.y + STEP_HEIGHT);
  if (!bank) return true;
  const steps = Math.ceil(NAV_CELL / STEP);
  let at = from;
  for (let i = 1; i <= steps; i++) {
    const to = offTheBank(ground, at, at.x + dx * STEP, at.z + dz * STEP, at.y);
    const h = ground.heightAt(to.x, to.z, at.y + STEP_HEIGHT);
    at = { x: to.x, y: h > at.y || at.y - h <= SNAP_DOWN ? h : at.y, z: to.z };
    // Too little got on so far to make it with the steps left.
    if ((at.x - from.x) * dx + (at.z - from.z) * dz + (steps - i) * STEP <= NAV_CELL - 2 * STEP) return false;
  }
  return true;
};

const near = { x: 0, z: 0 };

/** The cells of a box widened by `margin` in the window, a row: what the raster goes through for a solid. */
const boxCells = (c: Collider, margin: number, x0: number, z0: number, cells: number): number => {
  const [ix0, ix1] = cellRange(c.box.min.x - margin, c.box.max.x + margin, x0, cells);
  const [iz0, iz1] = cellRange(c.box.min.z - margin, c.box.max.z + margin, z0, cells);
  return Math.max(0, ix1 - ix0 + 1) * Math.max(0, iz1 - iz0 + 1);
};

/**
 * At most how many units of work `rasterise` takes (G-643), known before it starts: a row a pass
 * over the terrain, and the cells round each solid. A pure function of what the raster is made of.
 */
export const rasterWork = (solids: readonly Collider[], floor: number, x0: number, z0: number, ground: GroundField, cells: number): number => {
  const all = cells * cells;
  const terrain = ground.hasTerrain ? 2 * all : 0;
  const flights = terrain > 0 && floor === 0 && nearFlight(ground, x0, z0, cells) ? 2 * all : 0;
  const ledges = terrain > 0 && floor === 0 && flights === 0 && decksIn(ground, x0, z0, cells) ? all : 0;
  let boxes = 0;
  for (const c of solids) boxes += (floor === 0 ? 1 : 2) * boxCells(c, CLEARANCE, x0, z0, cells);
  return terrain + flights + ledges + boxes;
};

/** Above the street only tops at about this height are floor; everything else is a drop. */
function* openFloor(open: Uint8Array, solids: readonly Collider[], base: Float64Array | null, floor: number, x0: number, z0: number, cells: number): Slices<void> {
  let done = 0;
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
      done += Math.max(0, ix1 - ix0 + 1);
      if (done >= cells) {
        yield done;
        done = 0;
      }
    }
  }
  if (done > 0) yield done;
  // A hillside at the height of a roof or a deck is floor too.
  if (!base) return;
  for (let iz = 0; iz < cells; iz++) {
    for (let i = iz * cells; i < (iz + 1) * cells; i++) if ((base[i] ?? 0) >= floor - SNAP_DOWN && (base[i] ?? 0) <= floor + STEP_HEIGHT) open[i] = 1;
    yield cells;
  }
}

/** Closed where the body would touch a solid it cannot step onto (movementSystem's rule, a wider body). */
function* closeSolids(open: Uint8Array, solids: readonly Collider[], base: Float64Array | null, floor: number, x0: number, z0: number, cells: number): Slices<void> {
  const r2 = CLEARANCE * CLEARANCE;
  const relative = floor === 0 && base !== null;
  let done = 0;
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
      done += Math.max(0, ix1 - ix0 + 1);
      if (done >= cells) {
        yield done;
        done = 0;
      }
    }
  }
  if (done > 0) yield done;
}

export function* rasterise(solids: readonly Collider[], floor: number, reach: number, x0: number, z0: number, ground: GroundField, cells: number): Slices<Raster> {
  const open = new Uint8Array(cells * cells);
  const base = yield* terrainOf(ground, x0, z0, reach, cells);
  const flight = base && floor === 0 ? yield* flightsOf(ground, x0, z0, cells) : null;
  const ledges = base && floor === 0 && (flight || decksIn(ground, x0, z0, cells)) ? yield* ledgesOf(base, ground, x0, z0, cells) : null;
  const walls = floor === 0 && base ? new Uint8Array(cells * cells) : null;
  if (floor === 0) {
    open.fill(1);
    if (base && walls) yield* closeBanks(open, walls, base, flight, ground, x0, z0, reach, cells);
  } else yield* openFloor(open, solids, base, floor, x0, z0, cells);
  yield* closeSolids(open, solids, base, floor, x0, z0, cells);
  const relative = floor === 0 && base !== null;
  return { cells, x0, z0, floor, reach, open, base: relative ? base : null, flight: relative ? flight : null, ledges: relative ? ledges : null, walls, ground };
}
