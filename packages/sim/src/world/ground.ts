import { type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import type { World } from "miniplex";
import type { Rect } from "../content/builders";
import type { Entity } from "./components";

/** What the ground needs of a chunk: where it is and, optionally, its terrain (ADR-0043). */
export interface GroundChunk {
  readonly bounds: Rect;
  readonly terrain?: TerrainGrid;
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

  /** Ground height at (x, z): the terrain, or 0. */
  heightAt(x: number, z: number): number {
    if (!this.hasTerrain) return 0;
    const grid = this.gridAt(x, z);
    return grid ? terrainHeightAt(grid, x, z) : 0;
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

  /** Height of the ray above the terrain at distance t; +Infinity over the street plane. */
  private clearance(origin: Vec3, dir: Vec3, t: number): number {
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    const grid = this.gridAt(x, z);
    return grid ? origin.y + dir.y * t - terrainHeightAt(grid, x, z) : Infinity;
  }

  /**
   * Distance along a ray (normalised direction) to where it goes into the terrain, or null.
   * Marches in steps of half the finest cell, so a ridge between two samples is never missed,
   * then bisects. Only terrain stops rays: the street plane never did.
   */
  rayHit(origin: Vec3, dir: Vec3, maxDist: number): number | null {
    if (!this.hasTerrain || Math.min(origin.y, origin.y + dir.y * maxDist) > this.maxHeight) return null;
    if (this.clearance(origin, dir, 0) < 0) return 0;
    let prev = 0;
    for (let t = this.rayStep; ; t += this.rayStep) {
      const at = Math.min(t, maxDist);
      if (this.clearance(origin, dir, at) < 0) {
        let lo = prev;
        let hi = at;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (this.clearance(origin, dir, mid) < 0) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      if (at >= maxDist) return null;
      prev = at;
    }
  }
}

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
