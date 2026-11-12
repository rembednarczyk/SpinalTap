import { SpatialHash, type Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import { type Collider, type SolidEntity, collidersOf } from "./solids";

/** Edge of a bucket of the index, metres. */
const CELL = 16;

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
  /** Queries answered and solids handed back, for the cost check in tests (ADR-0046). */
  readonly stats = { queries: 0, candidates: 0 };

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

  /** Colliders of the solids near the rectangle, in creation order (static parts cached, kinematic boxes fresh). */
  collidersNear(minX: number, minZ: number, maxX: number, maxZ: number): Collider[] {
    const solids = this.near(minX, minZ, maxX, maxZ).sort((p, q) => p.id - q.id);
    const out: Collider[] = [];
    for (const s of solids) {
      if (s.velocity) {
        out.push({ box: s.solid, slope: s.slope, prism: null });
        continue;
      }
      let parts = this.parts.get(s);
      if (!parts) {
        parts = collidersOf([s]);
        this.parts.set(s, parts);
      }
      for (const c of parts) out.push(c);
    }
    return out;
  }
}

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
