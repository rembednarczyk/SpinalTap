import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import { type Collider, type SolidEntity, collidersOf } from "./solids";

/** Edge of a bucket of the index, metres. */
const CELL = 16;
const key = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768);

/**
 * A uniform grid over the static solids of a world (ADR-0043): who might be near a point or a
 * ray, so a city of hundreds of prisms costs what a street of a few dozen boxes did. Kinematic
 * solids (lifts, gates, sliding doors) are few and move: every query returns all of them.
 * Rebuilt lazily when a solid enters or leaves the world (streaming). Queries come back in
 * creation order, the order the movement system has always pushed out in.
 */
export class SolidIndex {
  private dirty = true;
  private readonly buckets = new Map<number, SolidEntity[]>();
  private kinematic: SolidEntity[] = [];
  private readonly parts = new WeakMap<SolidEntity, readonly Collider[]>();
  private stamp = 0;
  private readonly seen = new WeakMap<SolidEntity, number>();

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
    this.buckets.clear();
    this.kinematic = [];
    for (const e of this.world.with("solid")) {
      if (e.velocity) {
        this.kinematic.push(e);
        continue;
      }
      const b = e.solid;
      for (let ix = Math.floor(b.min.x / CELL); ix <= Math.floor(b.max.x / CELL); ix++) {
        for (let iz = Math.floor(b.min.z / CELL); iz <= Math.floor(b.max.z / CELL); iz++) {
          const k = key(ix, iz);
          const list = this.buckets.get(k);
          if (list) list.push(e);
          else this.buckets.set(k, [e]);
        }
      }
    }
  }

  /** Solids whose box may overlap the rectangle on the XZ plane (static ones only when `staticOnly`), unordered. */
  near(minX: number, minZ: number, maxX: number, maxZ: number, staticOnly = false): SolidEntity[] {
    if (this.dirty) this.rebuild();
    const stamp = ++this.stamp;
    const out: SolidEntity[] = [];
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) {
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
        for (const e of this.buckets.get(key(ix, iz)) ?? []) {
          if (this.seen.get(e) === stamp) continue;
          this.seen.set(e, stamp);
          const b = e.solid;
          if (b.max.x < minX || b.min.x > maxX || b.max.z < minZ || b.min.z > maxZ) continue;
          out.push(e);
        }
      }
    }
    if (!staticOnly) out.push(...this.kinematic);
    return out;
  }

  /** Solids a segment from `a` to `b` may cross, unordered. */
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
