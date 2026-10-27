import type { Vec3 } from "../math/vec3";
import type { DomainState } from "../state/domain-state";

/**
 * v9: Tessen's standing in the reputation (the docks, ADR-0024), after the inventory, weapons
 * and loot of v8 (ADR-0015).
 */
export const SAVE_SCHEMA_VERSION = 9;

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
  readonly domain: DomainState;
  /** Serialized ink story state (inkjs JSON). */
  readonly narrative: string | null;
  readonly meta: { readonly label: string; readonly objective: string };
}
