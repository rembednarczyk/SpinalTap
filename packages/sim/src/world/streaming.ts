import type { Contract, ContractOnSite, EntityId, EntitySnapshot, GameClock, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import { type ChunkDef, type DistrictId, WORLD_CHUNKS, WORLD_DEVICES, WORLD_METRO, chunkAt, distanceToRect } from "../content/world-map";
import type { DeviceDef } from "../content/devices";
import type { MetroStationDef } from "../content/metro";
import type { Entity } from "./components";
import type { IdAllocator } from "./factory";
import { GroundField } from "./ground";
import { ActorSpawner, type StreamState } from "./actor-spawner";
import { type NearPlayer, sleepPinned, unloadChunks } from "./chunk-unload";
import { contractTemplates } from "./contract-templates";
import { restoreEntities } from "./dormant-restore";
import { syncPresence } from "./presence-sync";
import { StreamCatalog, type Template } from "./stream-catalog";

export { STREET_ID_BASE, STREET_IDS_PER_CHUNK } from "./stream-catalog";
export { PINNED_AWAY_SECONDS } from "./chunk-unload";

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
 * its chunk, until it gives up outside every loaded chunk (G-188, `sleepPinned`). Deterministic: chunks are visited in table order and nothing here is random.
 *
 * Characters with a daily plan do not freeze while asleep: whenever one is spawned (a chunk
 * loading, a new game) it is put where its plan says for the current time, so Oyaji left at
 * his stall in the evening is found at home after midnight (ADR-0017).
 *
 * A facade (ADR-0031): the templates live in `StreamCatalog`, the contract's are built by
 * `contractTemplates`, spawning is `ActorSpawner`'s, sleeping `unloadChunks`', the flags'
 * presence `syncPresence`'s and saved state `restoreEntities`'.
 */
const keysOf = (templates: readonly Template[]): string[] => templates.flatMap((t) => (t.key ? [t.key] : []));

const liveKeys = (world: World<Entity>): Set<string> => {
  const live = new Set<string>();
  for (const e of world) if (e.key) live.add(e.key);
  return live;
};

export class WorldStreamer {
  private readonly catalog: StreamCatalog;
  private readonly state: StreamState = { resident: new Set(), dormant: new Map(), streamedOut: new Set() };
  private readonly spawner: ActorSpawner;
  /** Flags the presence of conditional actors was last checked against (compared by reference). */
  private presenceFlags: readonly string[] | null = null;
  /**
   * The contract whose targets the catalog holds: the last one registered. They stay after the
   * job ends (failed, cleared or paid) until the next is taken, alarmed guards fighting on (G-178);
   * once it is paid no chunk brings them back (G-195, `clearSite`).
   */
  private contract: ContractOnSite | null = null;
  private contractKeys: readonly string[] = [];
  /** The registered contract was paid (G-195): its site is cleared, its people known by key only. */
  private siteCleared = false;
  /**
   * Jobs replaced by a newer one while some of their people are still in the world (G-178), with
   * their keys: those people (alerted guards fighting on) are saved with them. No chunk brings
   * them back, so one who falls asleep with his chunk is forgotten, not kept dormant.
   */
  private former: { readonly site: ContractOnSite; readonly keys: readonly string[] }[] = [];
  private readonly formerKeys = new Set<string>();
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
    if (this.contract) this.retire(world, { site: this.contract, keys: this.contractKeys });
    this.contract = { contract, completed };
    this.siteCleared = false;
    const templates = contractTemplates(this.ids, this.chunks, completed, contract);
    this.contractKeys = keysOf(templates);
    this.catalog.setContract(templates);
    // Variation extras may stand in a neighbouring chunk (ADR-0034): each spawns with its own.
    this.spawner.spawnActors(world, flags, this.catalog.contractIn((c) => this.state.resident.has(c)), null);
  }

  /** The contract whose targets are in the world, from its registration on (G-178). */
  get registeredContract(): ContractOnSite | null {
    return this.contract;
  }

  /**
   * The registered job is paid (G-195): its site is cleared, as gigs and outposts are. Its
   * sleepers are forgotten at once and those still about when their chunk falls asleep, so
   * nobody of it comes back; new people come only with the next job taken there.
   */
  clearSite(): void {
    if (!this.contract || this.siteCleared) return;
    this.siteCleared = true;
    this.catalog.closeContract();
    for (const k of this.contractKeys) {
      this.formerKeys.add(k);
      this.state.dormant.delete(k);
    }
  }

  /**
   * A job replaced (G-178): its sleepers are forgotten, as no chunk wakes them any more, and so
   * are the replaced jobs with nobody left in the world.
   */
  private retire(world: World<Entity>, job: { readonly site: ContractOnSite; readonly keys: readonly string[] }): void {
    const live = liveKeys(world);
    this.former = [...this.former, job].filter((f) => f.keys.some((k) => live.has(k)));
    this.formerKeys.clear();
    for (const f of this.former) for (const k of f.keys) this.formerKeys.add(k);
    this.catalog.keepFormer(this.formerKeys);
    for (const k of job.keys) this.state.dormant.delete(k);
  }

  /** A replaced job of the save being loaded (G-178): its templates, so its saved people come back. */
  restoreFormer(site: ContractOnSite): void {
    const templates = contractTemplates(this.ids, this.chunks, site.completed, site.contract);
    this.catalog.addFormer(templates);
    const keys = keysOf(templates);
    this.former.push({ site, keys });
    for (const k of keys) this.formerKeys.add(k);
  }

  /** The replaced jobs with some of their people still in the world (G-178). */
  formerSnapshots(world: World<Entity>): ContractOnSite[] {
    const live = liveKeys(world);
    return this.former.filter((f) => f.keys.some((k) => live.has(k))).map((f) => f.site);
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
    const cleared = new Set(this.siteCleared ? this.contractKeys : []);
    restoreEntities(world, flags, saved, { state: this.state, catalog: this.catalog, spawner: this.spawner, chunkIdAt: (p) => this.chunkIdAt(p), cleared });
  }

  /**
   * Loads and unloads chunks around `focus`, `dt` seconds after the last time. Unloads first, so
   * ids never collide; then the AIs pinned outside the loaded chunks may fall asleep (G-188).
   */
  update(world: World<Entity>, flags: readonly string[], focus: Vec3, clock: GameClock, dt: number): StreamingChange {
    const change = this.stream(world, flags, focus, clock);
    sleepPinned(world, this.state, (p) => this.chunkIdAt(p), this.formerKeys, this.nearFocus(focus), dt);
    return change;
  }

  /** Within the load radius of `focus` (G-201): near the player, inside the chunks or outside them. */
  private nearFocus(focus: Vec3): NearPlayer {
    const r = this.radii.loadRadius;
    return (p) => (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2 <= r * r;
  }

  private stream(world: World<Entity>, flags: readonly string[], focus: Vec3, clock: GameClock): StreamingChange {
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
    if (unloaded) unloadChunks(world, this.state, new Set(unloaded), (p) => this.chunkIdAt(p), this.formerKeys, this.nearFocus(focus));
    for (const id of loaded ?? []) {
      resident.add(id);
      this.spawner.spawnProps(world, id);
    }
    for (const id of loaded ?? []) this.spawner.spawnActors(world, flags, this.catalog.actorsOf(id), clock);
    if (loaded) this.spawner.wakeBodies(world, flags, new Set(loaded), clock);
    return { loaded: loaded ?? [], unloaded: unloaded ?? [] };
  }
}
