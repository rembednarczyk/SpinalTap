import { type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import type { World } from "miniplex";
import type { Rect } from "../content/builders";
import type { Entity } from "./components";
import { type GroundDeck, deckAt } from "./deck";

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

const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const distanceTo = (r: Rect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

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
  private readonly x0: number;
  private readonly z0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: readonly (readonly number[])[];

  constructor(chunks: readonly GroundChunk[]) {
    this.chunks = chunks;
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
    for (let i = 0; i < this.chunks.length; i++) {
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

  /** Ground height at (x, z): the terrain, or a bridge's deck over it (ADR-0053), or 0. */
  heightAt(x: number, z: number): number {
    if (!this.hasTerrain) return 0;
    const chunk = this.chunks[this.chunkIndex(x, z)];
    const grid = chunk?.terrain;
    const h = grid ? terrainHeightAt(grid, x, z) : 0;
    const deck = chunk?.decks ? deckAt(chunk.decks, x, z) : null;
    return deck !== null && deck > h ? deck : h;
  }

  /**
   * Gradient of the ground at (x, z), written into `out`: central differences over 0.5 m, a
   * smoothed normal that ignores bumps finer than that. Zero on the street plane.
   */
  gradientAt(x: number, z: number, out: { x: number; z: number }): { x: number; z: number } {
    if (!this.hasTerrain || !this.gridAt(x, z)) {
      out.x = 0;
      out.z = 0;
      return out;
    }
    const h = SLOPE_HALF_SPAN;
    out.x = (this.heightAt(x + h, z) - this.heightAt(x - h, z)) / (2 * h);
    out.z = (this.heightAt(x, z + h) - this.heightAt(x, z - h)) / (2 * h);
    return out;
  }

  /** Steepness at (x, z) as rise over run. */
  slopeAt(x: number, z: number): number {
    const g = this.gradientAt(x, z, gradScratch);
    return Math.hypot(g.x, g.z);
  }

  /** Too steep to walk on (a bank, ADR-0043)? */
  steepAt(x: number, z: number): boolean {
    return this.hasTerrain && this.slopeAt(x, z) > MAX_WALK_SLOPE;
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

/** Height of a point above the ground under it (ADR-0043); its y without terrain. */
export const aboveGround = (world: World<Entity>, p: Vec3): number => p.y - groundOf(world).heightAt(p.x, p.z);

/**
 * How far apart in height two points are as floors go (ADR-0043): on terrain, each is measured
 * from the ground under it, so two people on one hillside stand on the same floor. Without
 * terrain it is the plain difference of y, as before.
 */
export const heightApart = (world: World<Entity>, a: Vec3, b: Vec3): number => {
  const g = groundOf(world);
  if (!g.hasTerrain) return Math.abs(a.y - b.y);
  return Math.abs(a.y - g.heightAt(a.x, a.z) - (b.y - g.heightAt(b.x, b.z)));
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
