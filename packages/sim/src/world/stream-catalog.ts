import type { EntityId } from "@seki/core";
import type { ChunkDef } from "../content/world-map";
import type { DeviceDef } from "../content/devices";
import { MAX_PASSERSBY_PER_CHUNK, PASSERSBY } from "../content/activity-spots";
import type { MetroStationDef } from "../content/metro";
import { type Presence, isPresent } from "../content/builders";
import type { Entity } from "./components";
import { type IdAllocator, actorEntity, deviceEntity, propEntity } from "./factory";
import { metroPieces } from "./metro-pieces";

/**
 * Ids of the street's solids (ADR-0050): the furniture and the parked cars of each chunk, from
 * here up, `STREET_IDS_PER_CHUNK` per chunk in table order. Outside the allocator, so adding them
 * moved no id of the content; above the residents' (1 000 000 + 1 000 per chunk), below the
 * scenery's (5 000 000).
 */
export const STREET_ID_BASE = 2_000_000;
export const STREET_IDS_PER_CHUNK = 4_000;

/** A recipe for one entity with an id reserved up front, so reloading gives it the same id. */
export interface Template {
  readonly id: EntityId;
  readonly chunk: string;
  /** Keyed entities carry state across unloads and saves; static props do not. */
  readonly key: string | null;
  readonly make: () => Entity;
  /** Flags that decide whether the actor is in the world at all (ADR-0023). */
  readonly when?: Presence;
}

/**
 * What the streamed world is made of: every chunk's templates, reserved up front in a fixed
 * order (the ids of the reference world depend on it), and the current contract's targets.
 */
export class StreamCatalog {
  private readonly content = new Map<string, Template[]>();
  private readonly byKey = new Map<string, Template>();
  /** Every place of a keyed actor of the content; one key can have one per condition (ADR-0038). */
  private readonly places = new Map<string, Template[]>();
  private contract: readonly Template[] = [];
  /** Templates of replaced jobs, known by key only to bring their saved people back (G-178). */
  private readonly former = new Map<string, Template>();
  /** Ids reserved for each chunk's background passers-by (ADR-0040); the passer-by system spawns them. */
  readonly passerbyIds = new Map<string, readonly EntityId[]>();

  constructor(ids: IdAllocator, chunks: readonly ChunkDef[], devices: readonly DeviceDef[], metro: readonly MetroStationDef[]) {
    chunks.forEach((chunk, order) => {
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
      (chunk.street ?? []).slice(0, STREET_IDS_PER_CHUNK).forEach((prop, i) => {
        const id = STREET_ID_BASE + order * STREET_IDS_PER_CHUNK + i;
        list.push({ id, chunk: chunk.id, key: null, make: () => propEntity(id, prop, chunk.id) });
      });
      this.content.set(chunk.id, list);
    });
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

  /** Replaces the contract's targets; the old ones are forgotten by key, the new ones known by it. */
  setContract(templates: readonly Template[]): void {
    for (const old of this.contract) this.byKey.delete(old.key ?? "");
    this.contract = templates;
    for (const t of templates) if (t.key) this.byKey.set(t.key, t);
  }

  /** Templates of a replaced job (G-178): never spawned with a chunk, only found for a saved key. */
  addFormer(templates: readonly Template[]): void {
    for (const t of templates) if (t.key) this.former.set(t.key, t);
  }

  /** Forgets the replaced jobs' templates but those of `keys` (G-188): nobody else of them is about. */
  keepFormer(keys: ReadonlySet<string>): void {
    for (const k of [...this.former.keys()]) if (!keys.has(k)) this.former.delete(k);
  }

  /**
   * The contract's site cleared (G-195): its people are known by key only from now on, as a
   * replaced job's, so no chunk brings them back and only those saved in the world return.
   */
  closeContract(): void {
    this.addFormer(this.contract);
    this.setContract([]);
  }

  /** The template of a replaced job's person, by key. */
  formerOf(key: string): Template | undefined {
    return this.former.get(key);
  }

  /** The contract's targets that stand in a chunk accepted by `inChunk`. */
  contractIn(inChunk: (chunkId: string) => boolean): Template[] {
    return this.contract.filter((t) => inChunk(t.chunk));
  }

  /** A chunk's static props, in table order. */
  propsOf(chunkId: string): Template[] {
    return (this.content.get(chunkId) ?? []).filter((t) => t.key === null);
  }

  /** A chunk's keyed characters, then the contract's targets standing in it. */
  actorsOf(chunkId: string): Template[] {
    const own = (this.content.get(chunkId) ?? []).filter((t) => t.key !== null);
    return [...own, ...this.contract.filter((t) => t.chunk === chunkId)];
  }

  /** The place a key has under these flags (ADR-0038), or its only one. */
  placeOf(key: string, flags: readonly string[]): Template | undefined {
    return (this.places.get(key) ?? []).find((x) => isPresent(x.when, flags)) ?? this.byKey.get(key);
  }

  /** Keyed actors with a condition, chunk by chunk in table order, the contract's with their chunk. */
  conditional(chunks: readonly ChunkDef[]): Template[] {
    return chunks.flatMap((chunk) =>
      [...(this.content.get(chunk.id) ?? []), ...this.contract.filter((c) => c.chunk === chunk.id)].filter((t) => t.when && t.key !== null),
    );
  }
}
