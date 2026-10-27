import { type Contract, type EntityId, type EntitySnapshot, type Vec3, contractTag } from "@seki/core";
import type { World } from "miniplex";
import { CONTRACT_SITE_SPAWNS } from "../content/district-m0";
import { type ChunkDef, type DistrictId, WORLD_CHUNKS, chunkAt, distanceToRect } from "../content/world-map";
import type { Entity } from "./components";
import {
  type IdAllocator,
  actorEntity,
  applyEntitySnapshot,
  contractGangerHp,
  entitySnapshotOf,
  gangerEntity,
  isDead,
  propEntity,
} from "./factory";
import { inCreationOrder } from "./ordering";

/**
 * Hysteresis: a chunk loads once the player is within `loadRadius` of its bounds and unloads
 * only beyond `unloadRadius`, so walking along a boundary never makes it flicker.
 */
export interface StreamingRadii {
  readonly loadRadius: number;
  readonly unloadRadius: number;
}

export const STREAMING_RADII: StreamingRadii = { loadRadius: 30, unloadRadius: 44 };

/** A recipe for one entity with an id reserved up front, so reloading gives it the same id. */
interface Template {
  readonly id: EntityId;
  readonly chunk: string;
  /** Keyed entities carry state across unloads and saves; static props do not. */
  readonly key: string | null;
  readonly make: () => Entity;
}

export interface StreamingChange {
  readonly loaded: readonly string[];
  readonly unloaded: readonly string[];
}

const NO_CHANGE: StreamingChange = { loaded: [], unloaded: [] };

/**
 * World streaming (plan §6): keeps the chunks around the player resident and puts the rest to
 * sleep. Unloading removes a chunk's entities from the ECS world; keyed ones (NPCs, gangers)
 * leave their state behind as a dormant snapshot that is applied again when the chunk returns
 * and is written to saves. Two exceptions keep the rules honest: dead entities (`dead:<key>`)
 * never come back, and an alerted AI is pinned: it keeps chasing instead of vanishing with
 * its chunk. Deterministic: chunks are visited in table order and nothing here is random.
 */
export class WorldStreamer {
  private readonly content = new Map<string, Template[]>();
  private readonly byKey = new Map<string, Template>();
  private contract: Template[] = [];
  private readonly resident = new Set<string>();
  private readonly dormant = new Map<string, EntitySnapshot>();
  /** Ids of entities currently asleep in an unloaded chunk (lets the renderer skip exit animations). */
  readonly streamedOut = new Set<EntityId>();

  constructor(
    private readonly ids: IdAllocator,
    readonly chunks: readonly ChunkDef[] = WORLD_CHUNKS,
    readonly radii: StreamingRadii = STREAMING_RADII,
  ) {
    for (const chunk of chunks) {
      const list: Template[] = [];
      for (const prop of chunk.props) {
        const id = ids.take();
        list.push({ id, chunk: chunk.id, key: null, make: () => propEntity(id, prop, chunk.id) });
      }
      for (const def of chunk.actors) {
        const id = ids.take();
        const t: Template = { id, chunk: chunk.id, key: def.spawn.key, make: () => actorEntity(id, def, chunk.id) };
        list.push(t);
        this.byKey.set(def.spawn.key, t);
      }
      this.content.set(chunk.id, list);
    }
  }

  /** A fresh entity id, for things spawned at run time (bags). */
  takeId(): EntityId {
    return this.ids.take();
  }

  /** Chunk containing the point, or "" outside every chunk. */
  chunkIdAt(p: Vec3): string {
    return chunkAt(p.x, p.z, this.chunks)?.id ?? "";
  }

  /** Resident chunks, in table order. */
  get loadedChunks(): string[] {
    return this.chunks.filter((c) => this.resident.has(c.id)).map((c) => c.id);
  }

  isLoaded(chunkId: string): boolean {
    return this.resident.has(chunkId);
  }

  districtAt(p: Vec3): DistrictId | null {
    return chunkAt(p.x, p.z, this.chunks)?.district ?? null;
  }

  /** State of keyed entities asleep in unloaded chunks, sorted by key. */
  dormantSnapshots(): EntitySnapshot[] {
    return [...this.dormant.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Registers the targets of a newly accepted (or loaded) contract and spawns them when their
   * site is resident. Ids are reserved for every target, in index order.
   */
  registerContract(world: World<Entity>, flags: readonly string[], completed: number, contract: Contract): void {
    const points = CONTRACT_SITE_SPAWNS[contract.siteId];
    const first = points[0];
    const chunk = (first ? chunkAt(first.x, first.z, this.chunks) : null)?.id ?? this.chunks[0]?.id ?? "";
    for (const old of this.contract) this.byKey.delete(old.key ?? "");
    this.contract = [];
    for (let i = 0; i < contract.targets; i++) {
      const position = points[i % points.length];
      if (!position) continue;
      const id = this.ids.take();
      const key = `${contract.id}-g${i}`;
      // Face the street centre line.
      const spawn = { key, position, yaw: Math.atan2(-position.x, 0.001) };
      const t: Template = { id, chunk, key, make: () => gangerEntity(id, spawn, contractTag(contract.id), contractGangerHp(completed), chunk) };
      this.contract.push(t);
      this.byKey.set(key, t);
    }
    if (this.resident.has(chunk)) this.spawnActors(world, flags, this.contract);
  }

  /**
   * Loads every chunk in `initial` plus those within the load radius of `focus`, in table
   * order: all props first, then `between` (the player), then the characters. This keeps the
   * creation order of a fresh M0 world, which the reference frame depends on.
   */
  loadInitial(world: World<Entity>, flags: readonly string[], focus: Vec3, initial: readonly string[], between: () => void): void {
    const wanted = new Set(initial);
    const chunks = this.chunks.filter((c) => wanted.has(c.id) || distanceToRect(focus.x, focus.z, c.bounds) <= this.radii.loadRadius);
    for (const c of chunks) {
      this.resident.add(c.id);
      this.spawnProps(world, c.id);
    }
    between();
    for (const c of chunks) this.spawnActors(world, flags, this.actorsOf(c.id));
  }

  /** Re-applies saved entity state: live entities directly, the rest as pinned or dormant. */
  restoreEntities(world: World<Entity>, flags: readonly string[], saved: readonly EntitySnapshot[]): void {
    const live = new Map<string, Entity>();
    for (const e of world) if (e.key) live.set(e.key, e);
    for (const s of saved) {
      const e = live.get(s.key);
      if (e) {
        applyEntitySnapshot(e, s);
        continue;
      }
      const t = this.byKey.get(s.key);
      if (!t || isDead(flags, s.key)) continue;
      if (s.alerted) {
        // It was chasing the player when the save was made: pinned, alive outside its chunk.
        const pinned = t.make();
        applyEntitySnapshot(pinned, s);
        world.add(pinned);
      } else {
        this.dormant.set(s.key, s);
        this.streamedOut.add(t.id);
      }
    }
  }

  /** Loads and unloads chunks around `focus`. Unloads first, so ids never collide. */
  update(world: World<Entity>, flags: readonly string[], focus: Vec3): StreamingChange {
    let unloaded: string[] | null = null;
    let loaded: string[] | null = null;
    for (const c of this.chunks) {
      const d = distanceToRect(focus.x, focus.z, c.bounds);
      if (this.resident.has(c.id) && d > this.radii.unloadRadius) (unloaded ??= []).push(c.id);
      else if (!this.resident.has(c.id) && d <= this.radii.loadRadius) (loaded ??= []).push(c.id);
    }
    if (!unloaded && !loaded) return NO_CHANGE;
    if (unloaded) this.unload(world, new Set(unloaded));
    for (const id of loaded ?? []) {
      this.resident.add(id);
      this.spawnProps(world, id);
    }
    for (const id of loaded ?? []) this.spawnActors(world, flags, this.actorsOf(id));
    return { loaded: loaded ?? [], unloaded: unloaded ?? [] };
  }

  private actorsOf(chunkId: string): Template[] {
    const own = (this.content.get(chunkId) ?? []).filter((t) => t.key !== null);
    return [...own, ...this.contract.filter((t) => t.chunk === chunkId)];
  }

  private spawnProps(world: World<Entity>, chunkId: string): void {
    for (const t of this.content.get(chunkId) ?? []) {
      if (t.key !== null) continue;
      world.add(t.make());
      this.streamedOut.delete(t.id);
    }
  }

  private spawnActors(world: World<Entity>, flags: readonly string[], templates: readonly Template[]): void {
    if (templates.length === 0) return;
    const alive = new Set<string>();
    for (const e of world) if (e.key) alive.add(e.key);
    for (const t of templates) {
      if (t.key === null || isDead(flags, t.key) || alive.has(t.key)) continue;
      const e = t.make();
      const saved = this.dormant.get(t.key);
      if (saved) {
        applyEntitySnapshot(e, saved);
        this.dormant.delete(t.key);
      }
      world.add(e);
      this.streamedOut.delete(t.id);
    }
  }

  private unload(world: World<Entity>, chunkIds: ReadonlySet<string>): void {
    const leaving = inCreationOrder([...world].filter((e) => e.chunk !== undefined && chunkIds.has(e.chunk)));
    for (const e of leaving) {
      if (e.ai?.alerted) continue;
      if (e.key) this.dormant.set(e.key, entitySnapshotOf({ ...e, key: e.key }));
      world.remove(e);
      this.streamedOut.add(e.id);
    }
    for (const id of chunkIds) this.resident.delete(id);
  }
}
