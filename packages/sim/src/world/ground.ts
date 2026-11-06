import { type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import type { World } from "miniplex";
import type { Rect } from "../content/builders";
import type { Entity } from "./components";
import { type GroundDeck, deckCeiling, flightGradientAt, flightsIn, groundOver, onFlight } from "./deck";

/** What the ground needs of a chunk: where it is and, optionally, its terrain (ADR-0043). */
export interface GroundChunk {
  readonly bounds: Rect;
  readonly terrain?: TerrainGrid;
  /** Bridge decks over its terrain (ADR-0053). */
  readonly decks?: readonly GroundDeck[];
}

/** Steepest ground a character walks on, as rise over run: tan 35° (ADR-0043). */
export const MAX_WALK_SLOPE = Math.tan((35 * Math.PI) / 180);
/** Half the span the slope is measured over (0.5 m in all): small bumps of a 1 m lidar grid do not count. */
const SLOPE_HALF_SPAN = 0.25;
/** Edge of a bucket of the chunk index, metres. */
const BUCKET = 64;

/**
 * A shaft dug into the ground (ADR-0071: the stairs and the hall under a metro pavilion): inside
 * `bounds` the ground lies at `floor`, under what stands in it, and the terrain around is the
 * shaft's wall. Axis-aligned like a chunk; the solids in it are what feet walk on.
 */
export interface GroundCut {
  readonly bounds: Rect;
  readonly floor: number;
}

/** A cut as a chunk of its own: a level grid at its floor over its bounds. */
const cutChunk = (c: GroundCut): GroundChunk => {
  const cell = Math.max(c.bounds.maxX - c.bounds.minX, c.bounds.maxZ - c.bounds.minZ, 2);
  return { bounds: c.bounds, terrain: { originX: c.bounds.minX, originZ: c.bounds.minZ, cell, cols: 2, rows: 2, heights: [c.floor, c.floor, c.floor, c.floor] } };
};

const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const distanceTo = (r: Rect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** The step a character walks up without noticing (the movement's `STEP_HEIGHT`): a seam beside a flight no higher is no bank (G-255). */
export const SEAM_STEP = 0.45;

/**
 * The decks over a chunk's bounds, edges included: its own, then those of the other chunks whose
 * box reaches them (each once), or undefined with none. A deck cut at a seam reaches no further.
 */
const decksReaching = (chunks: readonly GroundChunk[], chunk: GroundChunk): readonly GroundDeck[] | undefined => {
  const b = chunk.bounds;
  const own = chunk.decks ?? [];
  const seen = new Set(own);
  const out = [...own];
  for (const c of chunks) {
    for (const d of c.decks ?? []) {
      if (seen.has(d) || d.box.minX > b.maxX || d.box.maxX < b.minX || d.box.minZ > b.maxZ || d.box.maxZ < b.minZ) continue;
      seen.add(d);
      out.push(d);
    }
  }
  if (out.length === 0) return undefined;
  return out.length === own.length ? chunk.decks : out;
};

/** The four samples of the gradient, in half spans: east, west, north, south. */
const AROUND: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * The ground of the world (ADR-0043): the terrain of the chunk a point lies in (the first one in
 * table order, like `chunkAt`), or the street plane y = 0 in a chunk without terrain. Outside
 * every chunk, the nearest chunk's ground. Pure content, never saved; a lookup is a bucket of a
 * fixed grid and a bilinear sample, without allocation.
 */
export class GroundField {
  /** Some chunk has terrain; without it every query is the old flat street. */
  readonly hasTerrain: boolean;
  /** Highest terrain point anywhere: rays above it skip the terrain. */
  readonly maxHeight: number;
  /** Ray marching step: half the finest terrain cell, so no ridge is stepped over. */
  readonly rayStep: number;
  private readonly chunks: readonly GroundChunk[];
  /** The first `cuts` of `chunks` are the shafts (`GroundCut`): they win where they are and never stand in for a far chunk. */
  private readonly cuts: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: readonly (readonly number[])[];
  /** The boxes of the flights of steps hung off a bridge (G-255) in the chunks' decks: almost everywhere none is near. */
  private readonly flightBoxes: readonly GroundDeck["box"][];
  /** All of them in one box: a query far from it (almost all) is answered by one test. */
  private readonly flightsBox: GroundDeck["box"];
  /** The boxes of the bridges' own decks, not the flights' (a few dozen in the city). */
  private readonly deckBoxes: readonly GroundDeck["box"][];
  /** The flights among each chunk's decks, found once: a height then costs what it did without them. */
  private readonly chunkFlights: readonly (readonly GroundDeck[])[];
  /**
   * The decks each chunk's ground looks in: its own and its neighbours' that reach its edge (G-278).
   * A point on a seam belongs to the first chunk in the table, and a deck cut at the seam belongs
   * to the chunk on its side: without them that point was the terrain under the bridge.
   */
  private readonly chunkDecks: readonly (readonly GroundDeck[] | undefined)[];

  constructor(world: readonly GroundChunk[], cuts: readonly GroundCut[] = []) {
    const chunks = cuts.length > 0 ? [...cuts.map(cutChunk), ...world] : world;
    this.chunks = chunks;
    this.cuts = cuts.length;
    const grids = chunks.flatMap((c) => (c.terrain ? [c.terrain] : []));
    this.hasTerrain = grids.length > 0;
    this.maxHeight = grids.reduce((m, g) => g.heights.reduce((a, h) => Math.max(a, h), m), 0);
    this.rayStep = grids.reduce((s, g) => Math.min(s, g.cell / 2), 1);
    const minX = Math.min(...chunks.map((c) => c.bounds.minX), 0);
    const minZ = Math.min(...chunks.map((c) => c.bounds.minZ), 0);
    const maxX = Math.max(...chunks.map((c) => c.bounds.maxX), 0);
    const maxZ = Math.max(...chunks.map((c) => c.bounds.maxZ), 0);
    this.x0 = minX;
    this.z0 = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / BUCKET) + 1);
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / BUCKET) + 1);
    const buckets: number[][] = Array.from({ length: this.cols * this.rows }, () => []);
    if (this.hasTerrain) {
      chunks.forEach((c, i) => {
        const [c0, c1] = [Math.floor((c.bounds.minX - minX) / BUCKET), Math.floor((c.bounds.maxX - minX) / BUCKET)];
        const [r0, r1] = [Math.floor((c.bounds.minZ - minZ) / BUCKET), Math.floor((c.bounds.maxZ - minZ) / BUCKET)];
        for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) buckets[r * this.cols + col]?.push(i);
      });
    }
    this.buckets = buckets;
    this.flightBoxes = [...new Set(chunks.flatMap((c) => (c.decks ?? []).filter((d) => d.flight === true)))].map((d) => d.box);
    this.chunkDecks = chunks.map((c) => decksReaching(chunks, c));
    this.deckBoxes = [...new Set(chunks.flatMap((c) => (c.decks ?? []).filter((d) => d.flight !== true)))].map((d) => d.box);
    this.chunkFlights = this.chunkDecks.map((d) => flightsIn(d ?? []));
    const boxes = this.flightBoxes;
    this.flightsBox = {
      minX: Math.min(...boxes.map((b) => b.minX)),
      maxX: Math.max(...boxes.map((b) => b.maxX)),
      minZ: Math.min(...boxes.map((b) => b.minZ)),
      maxZ: Math.max(...boxes.map((b) => b.maxZ)),
    };
  }

  /** Is a flight of steps hung off a bridge (G-255) within `margin` of the box (`maxX`, `maxZ` default to the point)? */
  nearFlight(minX: number, minZ: number, margin: number, maxX = minX, maxZ = minZ): boolean {
    const all = this.flightsBox;
    if (minX > all.maxX + margin || maxX < all.minX - margin || minZ > all.maxZ + margin || maxZ < all.minZ - margin) return false;
    for (const b of this.flightBoxes) if (minX <= b.maxX + margin && maxX >= b.minX - margin && minZ <= b.maxZ + margin && maxZ >= b.minZ - margin) return true;
    return false;
  }

  /** The boxes of the bridges' decks (not the flights') overlapping the box: almost everywhere none. */
  decksNear(minX: number, minZ: number, maxX: number, maxZ: number): GroundDeck["box"][] {
    return this.deckBoxes.filter((b) => minX <= b.maxX && maxX >= b.minX && minZ <= b.maxZ && maxZ >= b.minZ);
  }

  /** Index of the chunk whose ground is used at (x, z), or -1 with no chunks. */
  private chunkIndex(x: number, z: number): number {
    const col = Math.floor((x - this.x0) / BUCKET);
    const row = Math.floor((z - this.z0) / BUCKET);
    if (col >= 0 && row >= 0 && col < this.cols && row < this.rows) {
      for (const i of this.buckets[row * this.cols + col] ?? []) if (inside((this.chunks[i] as GroundChunk).bounds, x, z)) return i;
    }
    let best = -1;
    let bestD = Infinity;
    for (let i = this.cuts; i < this.chunks.length; i++) {
      const d = distanceTo((this.chunks[i] as GroundChunk).bounds, x, z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** The terrain grid under (x, z), or null where the ground is the street plane. */
  gridAt(x: number, z: number): TerrainGrid | null {
    if (!this.hasTerrain) return null;
    return this.chunks[this.chunkIndex(x, z)]?.terrain ?? null;
  }

  /**
   * Ground height at (x, z): the terrain, or a bridge's deck over it (ADR-0053) or a flight of
   * steps hung off one (G-255), or 0. For feet reaching up to `reach`, a deck high over the
   * terrain and above the reach is overhead: under it the ground is the terrain (G-062).
   */
  heightAt(x: number, z: number, reach = Infinity): number {
    if (!this.hasTerrain) return 0;
    const i = this.chunkIndex(x, z);
    const grid = this.chunks[i]?.terrain;
    const h = grid ? terrainHeightAt(grid, x, z) : 0;
    const decks = this.chunkDecks[i];
    return decks ? groundOver(decks, x, z, h, reach, this.chunkFlights[i]) : h;
  }

  /** The lowest underside of a bridge's deck over (x, z) at or above `head`, or Infinity (G-062). */
  ceilingAt(x: number, z: number, head: number): number {
    if (!this.hasTerrain) return Infinity;
    const i = this.chunkIndex(x, z);
    const decks = this.chunkDecks[i];
    if (!decks) return Infinity;
    const grid = this.chunks[i]?.terrain;
    return deckCeiling(decks, x, z, head, grid ? terrainHeightAt(grid, x, z) : 0);
  }

  /**
   * Gradient of the ground at (x, z), written into `out`: central differences over 0.5 m, a
   * smoothed normal that ignores bumps finer than that. Zero on the street plane. `reach` as in
   * `heightAt`. On a flight of steps hung off a bridge in reach, the flight's own grade (G-255);
   * and beside one, where a sample lies on it, when no sample is more than a step off the point:
   * its seam with the terrain is no bank, but a wall above a step past the flight still is.
   */
  gradientAt(x: number, z: number, out: { x: number; z: number }, reach = Infinity): { x: number; z: number } {
    if (!this.hasTerrain || !this.gridAt(x, z)) {
      out.x = 0;
      out.z = 0;
      return out;
    }
    const h = SLOPE_HALF_SPAN;
    const decks = this.nearFlight(x, z, h) ? this.chunkDecks[this.chunkIndex(x, z)] : undefined;
    if (decks && flightGradientAt(decks, x, z, reach, out)) return out;
    if (this.cuts > 0 && this.nearCut(x, z, h)) return this.besideCut(x, z, h, reach, out);
    const east = this.heightAt(x + h, z, reach);
    const west = this.heightAt(x - h, z, reach);
    const north = this.heightAt(x, z + h, reach);
    const south = this.heightAt(x, z - h, reach);
    if (decks) {
      const here = this.heightAt(x, z, reach);
      const seam = Math.max(Math.abs(east - here), Math.abs(west - here), Math.abs(north - here), Math.abs(south - here)) <= SEAM_STEP;
      if (seam) for (const [dx, dz] of AROUND) if (flightGradientAt(decks, x + dx * h, z + dz * h, reach, out)) return out;
    }
    out.x = (east - west) / (2 * h);
    out.z = (north - south) / (2 * h);
    return out;
  }

  /** Index of the cut holding (x, z), or -1 (they come first among the chunks). */
  private cutAt(x: number, z: number): number {
    for (let i = 0; i < this.cuts; i++) if (inside((this.chunks[i] as GroundChunk).bounds, x, z)) return i;
    return -1;
  }

  private nearCut(x: number, z: number, margin: number): boolean {
    for (let i = 0; i < this.cuts; i++) if (distanceTo((this.chunks[i] as GroundChunk).bounds, x, z) <= margin) return true;
    return false;
  }

  /**
   * The gradient by a cut's edge: the samples on the other side of the edge left out (one-sided
   * differences), so the shaft's drop is no bank to feet walking out of it onto the street, nor
   * to feet on the street beside it. The shaft's walls are solids.
   */
  private besideCut(x: number, z: number, h: number, reach: number, out: { x: number; z: number }): { x: number; z: number } {
    const own = this.cutAt(x, z);
    const here = this.heightAt(x, z, reach);
    const side = (dx: number, dz: number): number | null => (this.cutAt(x + dx, z + dz) === own ? this.heightAt(x + dx, z + dz, reach) : null);
    const axis = (plus: number | null, minus: number | null): number => (plus !== null && minus !== null ? (plus - minus) / (2 * h) : plus !== null ? (plus - here) / h : minus !== null ? (here - minus) / h : 0);
    out.x = axis(side(h, 0), side(-h, 0));
    out.z = axis(side(0, h), side(0, -h));
    return out;
  }

  /** Steepness at (x, z) as rise over run. */
  slopeAt(x: number, z: number, reach = Infinity): number {
    const g = this.gradientAt(x, z, gradScratch, reach);
    return Math.hypot(g.x, g.z);
  }

  /** Is (x, z) on a flight of steps hung off a bridge (G-255)? */
  onFlight(x: number, z: number): boolean {
    const decks = this.hasTerrain && this.nearFlight(x, z, 0) ? this.chunkDecks[this.chunkIndex(x, z)] : undefined;
    return !!decks && onFlight(decks, x, z);
  }

  /**
   * Is the ground at (x, z) a bridge's deck over the terrain with no room under it (G-062), by its
   * abutments: ground for all feet, whose edge is a wall to the feet beside it more than a step low?
   */
  onLowDeck(x: number, z: number): boolean {
    if (!this.hasTerrain) return false;
    const i = this.chunkIndex(x, z);
    const decks = this.chunkDecks[i];
    if (!decks) return false;
    const grid = this.chunks[i]?.terrain;
    const h = grid ? terrainHeightAt(grid, x, z) : 0;
    return groundOver(decks, x, z, h, -Infinity) > h;
  }

  /** Too steep to walk on (a bank, ADR-0043)? */
  steepAt(x: number, z: number, reach = Infinity): boolean {
    if (!this.hasTerrain) return false;
    // By a flight hung off a bridge, ground more than a step over the feet (the reach) is a wall
    // however level it is there: a dash of 0.23 m a step reaches past the samples of the slope,
    // onto the flight's side or the deck over its landing (G-255).
    if (Number.isFinite(reach) && this.nearFlight(x, z, SLOPE_HALF_SPAN) && this.heightAt(x, z, reach) > reach) return true;
    return this.slopeAt(x, z, reach) > MAX_WALK_SLOPE;
  }

  /** Height of the ray above the ground at distance t (the street plane counts as -Infinity below). */
  private clearance(origin: Vec3, dir: Vec3, t: number, grid: TerrainGrid): number {
    return origin.y + dir.y * t - terrainHeightAt(grid, origin.x + dir.x * t, origin.z + dir.z * t);
  }

  /**
   * Distance along a ray (normalised direction) to where it goes into the terrain, or null.
   * Walks the ray cell by cell through the grids (DDA): inside one cell the bilinear ground
   * along a straight line is a quadratic, fitted exactly from three samples, so no ridge between
   * grid points is ever stepped over, however fine the grid. Only terrain stops rays: the street
   * plane never did.
   */
  rayHit(origin: Vec3, dir: Vec3, maxDist: number): number | null {
    if (!this.hasTerrain || Math.min(origin.y, origin.y + dir.y * maxDist) > this.maxHeight) return null;
    let t = 0;
    for (let guard = 0; guard < 100_000 && t < maxDist; guard++) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const chunk = this.chunks[this.chunkIndex(x, z)];
      if (!chunk) return null;
      const out = rectExit(chunk.bounds, x, z, dir);
      const grid = chunk.terrain;
      if (out < 0) {
        // Outside every chunk (the nearest one's ground): short plain steps.
        const end = Math.min(maxDist, t + this.rayStep);
        if (grid && this.clearance(origin, dir, end, grid) < 0) return end;
        t = end;
        continue;
      }
      if (!grid) {
        t = Math.min(maxDist, t + out + 1e-6);
        continue;
      }
      const fx = (x - grid.originX) / grid.cell;
      const fz = (z - grid.originZ) / grid.cell;
      const step = Math.min(out, nextLine(fx, dir.x / grid.cell, grid.cols - 1), nextLine(fz, dir.z / grid.cell, grid.rows - 1));
      const end = Math.min(maxDist, t + Math.max(step, 1e-6));
      const hit = firstBelow(this.clearance(origin, dir, t, grid), this.clearance(origin, dir, (t + end) / 2, grid), this.clearance(origin, dir, end, grid));
      if (hit !== null) return t + (end - t) * hit;
      t = end;
    }
    return null;
  }
}

/** Distance along the ray (XZ part of `dir`) from (x, z) to where it leaves the rectangle; -1 when outside. */
const rectExit = (r: Rect, x: number, z: number, dir: Vec3): number => {
  if (!inside(r, x, z)) return -1;
  const tx = dir.x > 1e-12 ? (r.maxX - x) / dir.x : dir.x < -1e-12 ? (r.minX - x) / dir.x : Infinity;
  const tz = dir.z > 1e-12 ? (r.maxZ - z) / dir.z : dir.z < -1e-12 ? (r.minZ - z) / dir.z : Infinity;
  return Math.min(tx, tz);
};

/**
 * Ray distance to the next grid line of a coordinate `f` (in cells) moving at `df` cells per
 * metre, among the lines 0..last (outside them the grid is clamped: the height does not change
 * along that axis). Infinity when there is none ahead.
 */
const nextLine = (f: number, df: number, last: number): number => {
  if (Math.abs(df) < 1e-12) return Infinity;
  if (df > 0) {
    if (f >= last) return Infinity;
    const target = f < 0 ? 0 : Math.floor(f + 1e-9) + 1;
    return (Math.min(target, last) - f) / df;
  }
  if (f <= 0) return Infinity;
  const target = f > last ? last : Math.ceil(f - 1e-9) - 1;
  return (Math.max(target, 0) - f) / df;
};

/**
 * First u in [0, 1] where the quadratic through (0, f0), (½, fm), (1, f1) goes below zero, or
 * null. Inside one grid cell the ray's height above the terrain is exactly such a quadratic.
 */
const firstBelow = (f0: number, fm: number, f1: number): number | null => {
  if (f0 < 0) return 0;
  const a = 2 * f0 - 4 * fm + 2 * f1;
  const b = -3 * f0 + 4 * fm - f1;
  if (Math.abs(a) < 1e-12) {
    if (b >= 0) return null;
    const r = -f0 / b;
    return r <= 1 ? r : null;
  }
  const disc = b * b - 4 * a * f0;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const lo = Math.min((-b - s) / (2 * a), (-b + s) / (2 * a));
  const hi = Math.max((-b - s) / (2 * a), (-b + s) / (2 * a));
  // f0 >= 0: a dip (a > 0) goes below between the roots, an arch (a < 0) after the second.
  const r = a > 0 ? lo : hi;
  return r >= 0 && r <= 1 ? r : null;
};

const gradScratch = { x: 0, z: 0 };

/** The flat street everywhere: what a world without a ground of its own gets. */
export const FLAT_GROUND = new GroundField([]);

const grounds = new WeakMap<World<Entity>, GroundField>();

/** Ties the content's ground to an ECS world (the simulation does it once, at creation). */
export const bindGround = (world: World<Entity>, ground: GroundField): void => {
  grounds.set(world, ground);
};

/** The ground of a world; the flat street when none was bound. */
export const groundOf = (world: World<Entity>): GroundField => grounds.get(world) ?? FLAT_GROUND;

/** A point this little under a bridge's deck still stands on it; lower down, under the bridge, it does not (G-062). */
const ON_DECK = 0.5;

/** Height of a point above the ground under it (ADR-0043); its y without terrain. */
export const aboveGround = (world: World<Entity>, p: Vec3): number => p.y - groundOf(world).heightAt(p.x, p.z, p.y + ON_DECK);

/**
 * How far apart in height two points are as floors go (ADR-0043): on terrain, each is measured
 * from the ground under it, so two people on one hillside stand on the same floor. Without
 * terrain it is the plain difference of y, as before.
 */
export const heightApart = (world: World<Entity>, a: Vec3, b: Vec3): number => {
  const g = groundOf(world);
  if (!g.hasTerrain) return Math.abs(a.y - b.y);
  return Math.abs(a.y - g.heightAt(a.x, a.z, a.y + ON_DECK) - (b.y - g.heightAt(b.x, b.z, b.y + ON_DECK)));
};

/**
 * Largest height difference between two chunks' terrain along the stretch where their bounds
 * touch or overlap, sampled every metre (ADR-0043: shared edges must agree). For content tests.
 */
export const terrainSeamGap = (a: GroundChunk, b: GroundChunk): number => {
  if (!a.terrain || !b.terrain) return 0;
  const minX = Math.max(a.bounds.minX, b.bounds.minX);
  const maxX = Math.min(a.bounds.maxX, b.bounds.maxX);
  const minZ = Math.max(a.bounds.minZ, b.bounds.minZ);
  const maxZ = Math.min(a.bounds.maxZ, b.bounds.maxZ);
  if (minX > maxX || minZ > maxZ) return 0;
  let gap = 0;
  for (let x = minX; x <= maxX + 1e-9; x += Math.max(1, (maxX - minX) / 512)) {
    for (let z = minZ; z <= maxZ + 1e-9; z += Math.max(1, (maxZ - minZ) / 512)) {
      gap = Math.max(gap, Math.abs(terrainHeightAt(a.terrain, x, z) - terrainHeightAt(b.terrain, x, z)));
      if (maxZ === minZ) break;
    }
    if (maxX === minX) break;
  }
  return gap;
};
