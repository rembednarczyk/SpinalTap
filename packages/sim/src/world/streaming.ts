import {
  type Contract,
  ENEMY_TYPES,
  type EnemyTypeId,
  type EntityId,
  type EntitySnapshot,
  type GameClock,
  PROTECTEE_KEY,
  type Vec3,
  contractAlarmFlag,
  contractEscortKey,
  contractItemKey,
  contractKind,
  contractTag,
  contractTerminalKey,
  takenFlag,
} from "@seki/core";
import type { World } from "miniplex";
import { CONTRACT_SITE_SPAWNS, contractSpawnYaw } from "../content/district-m0";
import { CONTRACT_ITEM_SPOTS } from "../content/district-targ";
import { DOKI_CONTRACT_POSTS, DOKI_ITEM_SPOTS, DOKI_TERMINAL_SPOTS, ESCORT_ROUTE } from "../content/district-doki";
import { type ChunkDef, type DistrictId, WORLD_CHUNKS, WORLD_DEVICES, WORLD_METRO, chunkAt, distanceToRect } from "../content/world-map";
import type { DeviceDef } from "../content/devices";
import { MAX_PASSERSBY_PER_CHUNK, PASSERSBY } from "../content/activity-spots";
import type { MetroStationDef } from "../content/metro";
import { metroPieces } from "./metro-pieces";
import { decorateTarget, planExtras, targetPresence, targetSpot, targetType } from "./contract-plan";
import { type Presence, isPresent } from "../content/builders";
import type { Entity } from "./components";
import {
  type IdAllocator,
  actorEntity,
  applyEntitySnapshot,
  deviceEntity,
  contractGangerHp,
  entitySnapshotOf,
  escortEntity,
  gangerEntity,
  isDead,
  pickupEntity,
  propEntity,
  sniperEntity,
  terminalEntity,
} from "./factory";
import { inCreationOrder } from "./ordering";
import { placeOnSchedule } from "./schedule";
import { GroundField } from "./ground";
import { settle } from "./placement";

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
  /** Flags that decide whether the actor is in the world at all (ADR-0023). */
  readonly when?: Presence;
}

/** Docks guards get tougher with experience, from their own type's health (ADR-0024). */
const docksGuardHp = (type: EnemyTypeId, completed: number): number => ENEMY_TYPES[type].hp + Math.min(40, completed * 5);

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
 */
export class WorldStreamer {
  private readonly content = new Map<string, Template[]>();
  private readonly byKey = new Map<string, Template>();
  /** Every place of a keyed actor of the content; one key can have one per condition (ADR-0038). */
  private readonly places = new Map<string, Template[]>();
  private contract: Template[] = [];
  private readonly resident = new Set<string>();
  private readonly dormant = new Map<string, EntitySnapshot>();
  /** Flags the presence of conditional actors was last checked against (compared by reference). */
  private presenceFlags: readonly string[] | null = null;
  /** Ids of entities currently asleep in an unloaded chunk (lets the renderer skip exit animations). */
  readonly streamedOut = new Set<EntityId>();
  /** Ids reserved for each chunk's background passers-by (ADR-0040); the passer-by system spawns them. */
  readonly passerbyIds = new Map<string, readonly EntityId[]>();
  /** The ground of these chunks (ADR-0043): their terrain, or the street plane. */
  readonly ground: GroundField;

  constructor(
    private readonly ids: IdAllocator,
    readonly chunks: readonly ChunkDef[] = WORLD_CHUNKS,
    readonly radii: StreamingRadii = STREAMING_RADII,
    devices: readonly DeviceDef[] = WORLD_DEVICES,
    metro: readonly MetroStationDef[] = WORLD_METRO,
  ) {
    this.ground = new GroundField(chunks);
    for (const chunk of chunks) {
      const list: Template[] = [];
      for (const prop of chunk.props) {
        const id = ids.take();
        list.push({ id, chunk: chunk.id, key: null, make: () => propEntity(id, prop, chunk.id) });
      }
      for (const def of chunk.actors) {
        const id = ids.take();
        const t: Template = { id, chunk: chunk.id, key: def.spawn.key, make: () => actorEntity(id, def, chunk.id), ...(def.when ? { when: def.when } : {}) };
        list.push(t);
        this.byKey.set(def.spawn.key, t);
        this.places.set(def.spawn.key, [...(this.places.get(def.spawn.key) ?? []), t]);
      }
      this.content.set(chunk.id, list);
    }
    // Devices (ADR-0029) after every chunk's own content, so the ids above stay what they were.
    for (const def of devices) {
      const list = this.content.get(def.chunk);
      if (!list) continue;
      const id = ids.take();
      const t: Template = { id, chunk: def.chunk, key: def.key, make: () => deviceEntity(id, def) };
      list.push(t);
      this.byKey.set(def.key, t);
    }
    // Metro platforms (ADR-0034) after the devices, so every id above stays what it was.
    for (const station of metro) {
      const list = this.content.get(station.chunk);
      if (!list) continue;
      for (const make of metroPieces(station)) {
        const id = ids.take();
        list.push({ id, chunk: station.chunk, key: null, make: () => make(id) });
      }
    }
    // Passers-by (ADR-0040) last, so every id above stays what it was.
    for (const chunk of chunks) {
      const count = Math.min(MAX_PASSERSBY_PER_CHUNK, PASSERSBY[chunk.id] ?? 0);
      if (count > 0) this.passerbyIds.set(chunk.id, Array.from({ length: count }, () => ids.take()));
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

  /** Is the point within `margin` metres of a chunk other than `except` (a seam between districts)? */
  nearOtherChunk(p: Vec3, margin: number, except: string): boolean {
    return this.chunks.some((c) => c.id !== except && distanceToRect(p.x, p.z, c.bounds) <= margin);
  }

  /** Resident chunks, in table order. */
  get loadedChunks(): string[] {
    return this.chunks.filter((c) => this.resident.has(c.id)).map((c) => c.id);
  }

  isLoaded(chunkId: string): boolean {
    return this.resident.has(chunkId);
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
    const kind = contractKind(contract);
    // A protection wave is sent at Oyaji, an escort's ambush at the defector; everyone else holds the site.
    const victim = kind === "protect" ? PROTECTEE_KEY : kind === "escort" ? contractEscortKey(contract.id) : undefined;
    const posts = DOKI_CONTRACT_POSTS[contract.siteId];
    const tag = contractTag(contract.id);
    const add = (t: Template): void => {
      this.contract.push(t);
      if (t.key) this.byKey.set(t.key, t);
    };
    for (let i = 0; i < contract.targets; i++) {
      // The variation (ADR-0034) may move a target (the lookout, a swapped mark).
      const position = targetSpot(contract, i, points);
      if (!position) continue;
      const id = this.ids.take();
      const key = `${contract.id}-g${i}`;
      const post = posts?.[i % posts.length];
      if (post) {
        // A docks post (ADR-0024): its own facing and type; an alarm post waits for the alarm.
        // The extra guard of a lockdown stands at the site's lookout, not on a copy of a post.
        const spawn = { key, position: posts && i >= posts.length ? position : post.at, yaw: post.yaw };
        const hp = docksGuardHp(post.type, completed);
        const make = (): Entity => {
          if (post.type === "tessen_sniper") return sniperEntity(id, spawn, tag, hp, chunk);
          const g = gangerEntity(id, spawn, tag, hp, chunk, victim, post.type);
          // The hack's wave knows where Seki is; the office guards stand watch and look around.
          if (g.ai && kind === "hack") g.ai.alerted = true;
          if (g.ai && !post.onAlarm) g.ai = { ...g.ai, watch: { yaw: post.yaw, phase: i * 1.7 } };
          return decorateTarget(g, contract, i);
        };
        const when = targetPresence(contract, i, post.onAlarm ? { all: [contractAlarmFlag(contract.id)] } : undefined);
        add(when ? { id, chunk, key, make, when } : { id, chunk, key, make });
        continue;
      }
      // Face the way trouble comes from on this site (audit W11).
      const spawn = { key, position, yaw: contractSpawnYaw(contract.siteId, position) };
      // Every third ganger of a wave fights hand to hand (ADR-0019).
      const type = targetType(contract, i, i % 3 === 2 ? "hebi_brawler" : "hebi_ganger");
      const hp = type === "hebi_enforcer" ? ENEMY_TYPES.hebi_enforcer.hp : contractGangerHp(completed);
      const when = targetPresence(contract, i);
      const make = (): Entity => decorateTarget(gangerEntity(id, spawn, tag, hp, chunk, victim, type), contract, i);
      add(when ? { id, chunk, key, make, when } : { id, chunk, key, make });
    }
    const crate = kind === "retrieve" ? CONTRACT_ITEM_SPOTS[contract.siteId] : kind === "infiltrate" ? DOKI_ITEM_SPOTS[contract.siteId] : undefined;
    if (crate) {
      const id = this.ids.take();
      const key = contractItemKey(contract.id);
      add({ id, chunk, key, make: () => pickupEntity(id, key, crate, chunk, kind === "retrieve" ? "crate" : "data") });
    }
    if (kind === "escort") {
      const id = this.ids.take();
      const key = contractEscortKey(contract.id);
      add({ id, chunk, key, make: () => escortEntity(id, key, ESCORT_ROUTE, chunk) });
    }
    const terminal = kind === "hack" ? DOKI_TERMINAL_SPOTS[contract.siteId] : undefined;
    if (terminal) {
      const id = this.ids.take();
      const key = contractTerminalKey(contract.id);
      add({ id, chunk, key, make: () => terminalEntity(id, key, terminal, chunk) });
    }
    const docks = posts !== undefined;
    const extra = {
      chunk,
      hp: docks ? docksGuardHp("tessen_guard", completed) : contractGangerHp(completed),
      type: docks ? "tessen_guard" : "hebi_ganger",
      yawAt: (p: Vec3) => contractSpawnYaw(contract.siteId, p),
    } as const;
    for (const x of planExtras(contract, extra)) {
      const id = this.ids.take();
      const at = chunkAt(x.at.x, x.at.z, this.chunks)?.id ?? chunk;
      add({ id, chunk: at, key: x.key, make: () => x.make(id, at), ...(x.when ? { when: x.when } : {}) });
    }
    // Variation extras may stand in a neighbouring chunk (ADR-0034): each spawns with its own.
    this.spawnActors(world, flags, this.contract.filter((t) => this.resident.has(t.chunk)), null);
  }

  /** Spawns the contract's characters that were waiting for a flag that is now up (ADR-0024). */
  spawnWaiting(world: World<Entity>, flags: readonly string[]): void {
    const waiting = this.contract.filter((t) => t.when !== undefined && this.resident.has(t.chunk));
    this.spawnActors(world, flags, waiting, null);
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
      this.resident.add(c.id);
      this.spawnProps(world, c.id);
    }
    between();
    for (const c of chunks) this.spawnActors(world, flags, this.actorsOf(c.id), clock);
    this.presenceFlags = flags;
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
      const t = (this.places.get(s.key) ?? []).find((x) => isPresent(x.when, flags)) ?? this.byKey.get(s.key);
      if (!t || isDead(flags, s.key) || flags.includes(takenFlag(s.key)) || !isPresent(t.when, flags)) continue;
      if (s.alerted || s.lastKnown) {
        // It was chasing (or looking for) the player when the save was made: pinned, alive outside its chunk.
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
  update(world: World<Entity>, flags: readonly string[], focus: Vec3, clock: GameClock): StreamingChange {
    if (flags !== this.presenceFlags) this.syncPresence(world, flags, clock);
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
    for (const id of loaded ?? []) this.spawnActors(world, flags, this.actorsOf(id), clock);
    return { loaded: loaded ?? [], unloaded: unloaded ?? [] };
  }

  /**
   * Conditional actors follow the flags (ADR-0023): one whose condition starts to hold appears
   * in its resident chunk, one whose condition stops holding leaves the world and forgets its
   * sleeping state. Visits chunks in table order, so it stays deterministic.
   */
  private syncPresence(world: World<Entity>, flags: readonly string[], clock: GameClock): void {
    this.presenceFlags = flags;
    const live = new Map<string, Entity>();
    for (const e of world) if (e.key) live.set(e.key, e);
    // The contract's people too: a variation's targets come and go with the clock (ADR-0034).
    const conditional = this.chunks.flatMap((chunk) =>
      [...(this.content.get(chunk.id) ?? []), ...this.contract.filter((c) => c.chunk === chunk.id)].filter((t) => t.when && t.key !== null),
    );
    // Leaving first: one key may have a place per condition (Kaito in the clinic, then at the bar; ADR-0038).
    for (const t of conditional) {
      if (t.key === null || isPresent(t.when, flags)) continue;
      const e = live.get(t.key);
      if (e && e.id !== t.id) continue;
      this.dormant.delete(t.key);
      if (e) {
        world.remove(e);
        live.delete(t.key);
      }
    }
    for (const t of conditional) {
      if (t.key === null || !isPresent(t.when, flags)) continue;
      if (this.resident.has(t.chunk) && !live.has(t.key)) this.spawnActors(world, flags, [t], clock);
    }
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

  /** Spawns sleeping or new characters; with a clock, scheduled ones go where their plan says. */
  private spawnActors(world: World<Entity>, flags: readonly string[], templates: readonly Template[], clock: GameClock | null): void {
    if (templates.length === 0) return;
    const alive = new Set<string>();
    for (const e of world) if (e.key) alive.add(e.key);
    for (const t of templates) {
      if (t.key === null || isDead(flags, t.key) || flags.includes(takenFlag(t.key)) || alive.has(t.key) || !isPresent(t.when, flags)) continue;
      const e = t.make();
      const saved = this.dormant.get(t.key);
      if (saved) {
        applyEntitySnapshot(e, saved);
        this.dormant.delete(t.key);
      }
      if (clock && e.schedule) placeOnSchedule(e, e.schedule.def, clock);
      settle(world, this.ground, e);
      world.add(e);
      this.streamedOut.delete(t.id);
    }
  }

  private unload(world: World<Entity>, chunkIds: ReadonlySet<string>): void {
    const staying = (id: string | undefined): boolean => id !== undefined && this.resident.has(id) && !chunkIds.has(id);
    // A character on a daily plan walks out of its chunk (300 m down Grodzka in Lublin, ADR-0045):
    // it sleeps only once neither its own chunk nor the one it stands in stays loaded.
    const standing = (e: Entity): string | undefined => (e.schedule ? this.chunkIdAt(e.position) : undefined);
    const leaving = inCreationOrder(
      [...world].filter((e) => e.chunk !== undefined && (chunkIds.has(e.chunk) || chunkIds.has(standing(e) ?? "")) && !staying(e.chunk) && !staying(standing(e))),
    );
    for (const e of leaving) {
      // Chasing or looking for the player (ADR-0029): it stays.
      if (e.ai?.alerted || e.ai?.lastKnown) continue;
      if (e.key) this.dormant.set(e.key, entitySnapshotOf({ ...e, key: e.key }));
      world.remove(e);
      this.streamedOut.add(e.id);
    }
    for (const id of chunkIds) this.resident.delete(id);
  }
}
