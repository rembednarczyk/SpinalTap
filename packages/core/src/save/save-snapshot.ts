import type { Vec3 } from "../math/vec3";
import type { DomainState } from "../state/domain-state";

/**
 * v17: character progression (ADR-0059): XP, level, attributes, perks and the points to spend.
 * v16: Kaito is at the Neon Koi counter from the start (G-034): no new fields, but a save from
 * before the first conversation remembered him by the chair in the clinic.
 * v15: the world is Lublin (ADR-0045): no new fields, but every position of an older save is in
 * the old city's coordinates; the migration wakes the player in Mori's clinic again.
 * v14: automatic doors that are not shut and at rest (ADR-0038).
 * v13: buffs, capacity shards and the disguise (ADR-0033).
 * v12: a metro ride in progress, the street encounters played (ADR-0034); the contract's variation
 * and hooks found are optional fields of the contract log.
 * v11: heat, the cyberdeck (RAM, upload) and the contract's debrief counters (ADR-0029).
 * v10: Tessen's standing in the reputation (the docks, ADR-0024), after v9's act II state
 * (Kagami's standing and the act II ending, ADR-0023) and the inventory of v8 (ADR-0015).
 */
export const SAVE_SCHEMA_VERSION = 17;

/** Serializable state of one dynamic entity. Static level geometry is rebuilt from content. */
export interface EntitySnapshot {
  readonly key: string;
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly hp: number | null;
  readonly cooldown: number;
  /** AI alert state; false for non-AI entities. */
  readonly alerted: boolean;
  /**
   * Where an AI last saw the player and the seconds it still looks around there (ADR-0029).
   * Optional: absent for everyone who is not looking for the player.
   */
  readonly lastKnown?: Vec3;
  readonly search?: number;
  /** Seconds out of its sight while alerted. */
  readonly lost?: number;
}

/** An automatic door's leaf (ADR-0038): how far open (0..1) and seconds its sensor has been empty. */
export interface DoorSnapshot {
  /** `<door>#<leaf>`. */
  readonly key: string;
  readonly open: number;
  readonly idle: number;
}

/** World streaming state: which chunks are resident. Their content is rebuilt from the content tables. */
export interface StreamingSnapshot {
  /** Loaded chunk ids, in content-table order. Unknown ids are ignored on load. */
  readonly loadedChunks: readonly string[];
}

export interface SaveSnapshot {
  readonly version: typeof SAVE_SCHEMA_VERSION;
  readonly seed: number;
  /** Internal RNG state, so a loaded game continues the same random stream. */
  readonly rngState: number;
  readonly tick: number;
  /** Live keyed entities plus the ones asleep in unloaded chunks. */
  readonly entities: readonly EntitySnapshot[];
  readonly streaming: StreamingSnapshot;
  /** Leaves of resident doors that are moving or about to close; every other door is shut. */
  readonly doors: readonly DoorSnapshot[];
  readonly domain: DomainState;
  /** Serialized ink story state (inkjs JSON). */
  readonly narrative: string | null;
  readonly meta: { readonly label: string; readonly objective: string };
}
