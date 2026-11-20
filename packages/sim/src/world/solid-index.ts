import { SpatialHash, type Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Aabb } from "./collision";
import type { Entity } from "./components";
import { type Collider, type SolidEntity, collidersOf } from "./solids";

/** Edge of a bucket of the index, metres. */
const CELL = 16;
/** Spare round a segment's cells (m), far over the rounding of where it meets a box. */
const ALONG_PAD = 1e-3;

/**
 * A uniform grid over the static solids of a world (ADR-0043), core's `SpatialHash`: who might
 * be near a point or a ray, so a city of hundreds of prisms costs what a street of a few dozen
 * boxes did. Kinematic solids (lifts, gates, sliding doors) are few and move: every query
 * returns all of them. Rebuilt lazily when a solid enters or leaves the world (streaming).
 * Colliders come back in creation order, the order the movement system has always pushed out in.
 */
export class SolidIndex {
  private dirty = true;
  private readonly grid = new SpatialHash<SolidEntity>(CELL);
  private kinematic: SolidEntity[] = [];
  private readonly parts = new WeakMap<SolidEntity, readonly Collider[]>();
  /** Queries answered and solids handed back, and of `collidersNear` its queries and colliders, for the cost checks in tests (ADR-0046). */
  readonly stats = { queries: 0, candidates: 0, colliderQueries: 0, colliders: 0 };

  constructor(private readonly world: World<Entity>) {
    const solids = world.with("solid");
    solids.onEntityAdded.subscribe(() => {
      this.dirty = true;
    });
    solids.onEntityRemoved.subscribe(() => {
      this.dirty = true;
    });
  }

  private rebuild(): void {
    this.dirty = false;
    this.grid.clear();
    this.kinematic = [];
    for (const e of this.world.with("solid")) {
      if (e.velocity) this.kinematic.push(e);
      else this.grid.insert(e, e.solid.min.x, e.solid.min.z, e.solid.max.x, e.solid.max.z);
    }
  }

  /** Solids whose box may overlap the rectangle on the XZ plane (static ones only when `staticOnly`): the static ones in the world's order, then the kinematic. */
  near(minX: number, minZ: number, maxX: number, maxZ: number, staticOnly = false): SolidEntity[] {
    if (this.dirty) this.rebuild();
    const out = this.grid.query(minX, minZ, maxX, maxZ);
    if (!staticOnly) out.push(...this.kinematic);
    this.stats.queries++;
    this.stats.candidates += out.length;
    return out;
  }

  /** Solids a segment from `a` to `b` may cross, in the order of `near`. */
  alongSegment(a: Vec3, b: Vec3): SolidEntity[] {
    return this.near(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
  }

  /**
   * Is there a solid the segment from `a` to `b` may cross that `hit` takes? Those of the index's
   * cells the segment crosses, from `a`'s end, then the kinematic: every solid of `alongSegment`
   * the segment passes through the box of, without the rest of its box (G-884).
   */
  someAlongSegment(a: Vec3, b: Vec3, hit: (e: SolidEntity) => boolean): boolean {
    if (this.dirty) this.rebuild();
    this.stats.queries++;
    const take = (e: SolidEntity): boolean => {
      this.stats.candidates++;
      return hit(e);
    };
    return this.grid.someAlong(a.x, a.z, b.x, b.z, ALONG_PAD, take) || this.kinematic.some(take);
  }

  /**
   * Colliders whose own boxes meet the rectangle, in creation order (static parts cached,
   * kinematic boxes fresh). The grid hands back the solids whose boxes meet it; a building of
   * prisms is one solid, its box round all of them, so each part is checked on its own box too
   * (Ericson, "Real-Time Collision Detection", 7.1 and 6.1: the grid's cell, then the object's
   * bounding volume, then its parts'). Every part of those solids stays at hand for a point off
   * the rectangle (`collidersAt`): the colliders of before, in their order.
   */
  collidersNear(minX: number, minZ: number, maxX: number, maxZ: number): Collider[] {
    const solids = this.near(minX, minZ, maxX, maxZ).sort((p, q) => p.id - q.id);
    const each: (readonly Collider[])[] = [];
    const out: Collider[] = [];
    for (const s of solids) {
      if (s.velocity) {
        const c = { box: s.solid, slope: s.slope, prism: null };
        each.push([c]);
        if (meets(c.box, minX, minZ, maxX, maxZ)) out.push(c);
        continue;
      }
      let parts = this.parts.get(s);
      if (!parts) {
        parts = collidersOf([s]);
        this.parts.set(s, parts);
      }
      each.push(parts);
      for (const c of parts) if (meets(c.box, minX, minZ, maxX, maxZ)) out.push(c);
    }
    (out as Near)[NEARBY] = { minX, minZ, maxX, maxZ, each, all: null };
    this.stats.colliderQueries++;
    this.stats.colliders += out.length;
    return out;
  }
}

const meets = (b: Aabb, minX: number, minZ: number, maxX: number, maxZ: number): boolean => b.max.x >= minX && b.min.x <= maxX && b.max.z >= minZ && b.min.z <= maxZ;

/** The rectangle a list of `collidersNear` was asked for, the colliders of each of its solids, and all of them once asked for. */
interface Nearby {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly each: readonly (readonly Collider[])[];
  all: readonly Collider[] | null;
}
const NEARBY = Symbol("nearby");
/** A list of `collidersNear`, with what it was gathered for. */
type Near = readonly Collider[] & { [NEARBY]?: Nearby };

/**
 * The colliders of `solids` that may be over the point (x, z), `margin` round: `solids` itself
 * when that is within the rectangle it was gathered for (or it is no list of `collidersNear`),
 * else every part of its solids, in the same order. A foothold felt for beside a thin top
 * (`supported`, G-372) goes down a flight tread by tread, off the rectangle of the body.
 */
export const collidersAt = (solids: readonly Collider[], x: number, z: number, margin: number): readonly Collider[] => {
  const n = (solids as Near)[NEARBY];
  if (!n || (x - margin >= n.minX && x + margin <= n.maxX && z - margin >= n.minZ && z + margin <= n.maxZ)) return solids;
  n.all ??= n.each.flat();
  return n.all;
};

const indices = new WeakMap<World<Entity>, SolidIndex>();

/** The solid index of a world, made on first use. */
export const solidIndexOf = (world: World<Entity>): SolidIndex => {
  let index = indices.get(world);
  if (!index) {
    index = new SolidIndex(world);
    indices.set(world, index);
  }
  return index;
};
