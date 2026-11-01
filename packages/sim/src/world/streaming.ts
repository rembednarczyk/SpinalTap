import type { Contract, ContractOnSite, EntityId, EntitySnapshot, GameClock, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import { type ChunkDef, type DistrictId, WORLD_CHUNKS, WORLD_DEVICES, WORLD_METRO, chunkAt, distanceToRect } from "../content/world-map";
import type { DeviceDef } from "../content/devices";
import type { MetroStationDef } from "../content/metro";
import type { Entity } from "./components";
import type { IdAllocator } from "./factory";
import { GroundField } from "./ground";
import { ActorSpawner, type StreamState } from "./actor-spawner";
import { unloadChunks } from "./chunk-unload";
import { contractTemplates } from "./contract-templates";
import { restoreEntities } from "./dormant-restore";
import { syncPresence } from "./presence-sync";
import { StreamCatalog } from "./stream-catalog";

export { STREET_ID_BASE, STREET_IDS_PER_CHUNK } from "./stream-catalog";

/**
 * Hysteresis: a chunk loads once the player is within `loadRadius` of its bounds and unloads
 * only beyond `unloadRadius`, so walking along a boundary never makes it flicker.
 */
export interface StreamingRadii {
  readonly loadRadius: number;
  readonly unloadRadius: number;
}

export const STREAMING_RADII: StreamingRadii = { loadRadius: 30, unloadRadius: 44 };

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
 *
 * Characters with a daily plan do not freeze while asleep: whenever one is spawned (a chunk
 * loading, a new game) it is put where its plan says for the current time, so Oyaji left at
 * his stall in the evening is found at home after midnight (ADR-0017).
 *
 * A facade (ADR-0031): the templates live in `StreamCatalog`, the contract's are built by
 * `contractTemplates`, spawning is `ActorSpawner`'s, sleeping `unloadChunks`', the flags'
 * presence `syncPresence`'s and saved state `restoreEntities`'.
 */
export class WorldStreamer {
  private readonly catalog: StreamCatalog;
  private readonly state: StreamState = { resident: new Set(), dormant: new Map(), streamedOut: new Set() };
  private readonly spawner: ActorSpawner;
  /** Flags the presence of conditional actors was last checked against (compared by reference). */
  private presenceFlags: readonly string[] | null = null;
  /**
   * The contract whose targets the catalog holds: the last one registered. They stay after the
   * job ends (failed, cleared or paid) until the next is taken, alarmed guards fighting on (G-178).
   */
  private contract: ContractOnSite | null = null;
  /** Ids of entities currently asleep in an unloaded chunk (lets the renderer skip exit animations). */
  readonly streamedOut: Set<EntityId>;
  /** Ids reserved for each chunk's background passers-by (ADR-0040); the passer-by system spawns them. */
  readonly passerbyIds: Map<string, readonly EntityId[]>;
  /** The ground of these chunks (ADR-0043): their terrain, or the street plane. */
  readonly ground: GroundField;
  /** The difficulty's `npcHealth` (ADR-0066), read when a character appears; the simulation sets it. */
  enemyHealth: () => number = () => 1;

  constructor(
    private readonly ids: IdAllocator,
    readonly chunks: readonly ChunkDef[] = WORLD_CHUNKS,
    readonly radii: StreamingRadii = STREAMING_RADII,
    devices: readonly DeviceDef[] = WORLD_DEVICES,
    metro: readonly MetroStationDef[] = WORLD_METRO,
  ) {
    this.ground = new GroundField(chunks);
    this.catalog = new StreamCatalog(ids, chunks, devices, metro);
    this.passerbyIds = this.catalog.passerbyIds;
    this.streamedOut = this.state.streamedOut;
    this.spawner = new ActorSpawner(this.state, this.catalog, this.ground, (p) => this.chunkIdAt(p), () => this.enemyHealth());
  }

  /** A fresh entity id, for things spawned at run time (bags). */
  takeId(): EntityId {
    return this.ids.take();
  }

  /** Chunk containing the point, or "" outside every chunk. */
  chunkIdAt(p: Vec3): string {
    return chunkAt(p.x, p.z, this.chunks)?.id ?? "";
  }

  /** Is the point within `margin` metres of a chunk other than `except` (a seam between districts)? */
  nearOtherChunk(p: Vec3, margin: number, except: string): boolean {
    return this.chunks.some((c) => c.id !== except && distanceToRect(p.x, p.z, c.bounds) <= margin);
  }

  /** Resident chunks, in table order. */
  get loadedChunks(): string[] {
    return this.chunks.filter((c) => this.state.resident.has(c.id)).map((c) => c.id);
  }

  isLoaded(chunkId: string): boolean {
    return this.state.resident.has(chunkId);
  }

  /**
   * District named for the point. Streaming bounds overlap at the seams (Kanałowa runs on
   * under the market gate), so the last chunk in table order wins: a later district is laid
   * over its neighbour's margin.
   */
  districtAt(p: Vec3): DistrictId | null {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      if (c && distanceToRect(p.x, p.z, c.bounds) === 0) return c.district;
    }
    return null;
  }

  /** State of keyed entities asleep in unloaded chunks, sorted by key. */
  dormantSnapshots(): EntitySnapshot[] {
    return [...this.state.dormant.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Registers the targets of a newly accepted (or loaded) contract and spawns them when their
   * site is resident. Ids are reserved for every target, in index order.
   */
  registerContract(world: World<Entity>, flags: readonly string[], completed: number, contract: Contract): void {
    this.contract = { contract, completed };
    this.catalog.setContract(contractTemplates(this.ids, this.chunks, completed, contract));
    // Variation extras may stand in a neighbouring chunk (ADR-0034): each spawns with its own.
    this.spawner.spawnActors(world, flags, this.catalog.contractIn((c) => this.state.resident.has(c)), null);
  }

  /** The contract whose targets are in the world, from its registration on (G-178). */
  get registeredContract(): ContractOnSite | null {
    return this.contract;
  }

  /** Spawns the contract's characters that were waiting for a flag that is now up (ADR-0024). */
  spawnWaiting(world: World<Entity>, flags: readonly string[]): void {
    const waiting = this.catalog.contractIn((c) => this.state.resident.has(c)).filter((t) => t.when !== undefined);
    this.spawner.spawnActors(world, flags, waiting, null);
  }

  /**
   * Loads every chunk in `initial` plus those within the load radius of `focus`, in table
   * order: all props first, then `between` (the player), then the characters. This keeps the
   * creation order of a fresh M0 world, which the reference frame depends on.
   */
  loadInitial(world: World<Entity>, flags: readonly string[], focus: Vec3, initial: readonly string[], clock: GameClock, between: () => void): void {
    const wanted = new Set(initial);
    const chunks = this.chunks.filter((c) => wanted.has(c.id) || distanceToRect(focus.x, focus.z, c.bounds) <= this.radii.loadRadius);
    for (const c of chunks) {
      this.state.resident.add(c.id);
      this.spawner.spawnProps(world, c.id);
    }
    between();
    for (const c of chunks) this.spawner.spawnActors(world, flags, this.catalog.actorsOf(c.id), clock);
    this.presenceFlags = flags;
  }

  /** Re-applies saved entity state: live entities directly, the rest as pinned or dormant. */
  restoreEntities(world: World<Entity>, flags: readonly string[], saved: readonly EntitySnapshot[]): void {
    restoreEntities(world, flags, saved, { state: this.state, catalog: this.catalog, spawner: this.spawner, chunkIdAt: (p) => this.chunkIdAt(p) });
  }

  /** Loads and unloads chunks around `focus`. Unloads first, so ids never collide. */
  update(world: World<Entity>, flags: readonly string[], focus: Vec3, clock: GameClock): StreamingChange {
    if (flags !== this.presenceFlags) {
      this.presenceFlags = flags;
      syncPresence(world, flags, clock, { state: this.state, catalog: this.catalog, spawner: this.spawner, chunks: this.chunks });
    }
    const resident = this.state.resident;
    let unloaded: string[] | null = null;
    let loaded: string[] | null = null;
    for (const c of this.chunks) {
      const d = distanceToRect(focus.x, focus.z, c.bounds);
      if (resident.has(c.id) && d > this.radii.unloadRadius) (unloaded ??= []).push(c.id);
      else if (!resident.has(c.id) && d <= this.radii.loadRadius) (loaded ??= []).push(c.id);
    }
    if (!unloaded && !loaded) return NO_CHANGE;
    if (unloaded) unloadChunks(world, this.state, new Set(unloaded), (p) => this.chunkIdAt(p));
    for (const id of loaded ?? []) {
      resident.add(id);
      this.spawner.spawnProps(world, id);
    }
    for (const id of loaded ?? []) this.spawner.spawnActors(world, flags, this.catalog.actorsOf(id), clock);
    if (loaded) this.spawner.wakeBodies(world, flags, new Set(loaded), clock);
    return { loaded: loaded ?? [], unloaded: unloaded ?? [] };
  }
}
