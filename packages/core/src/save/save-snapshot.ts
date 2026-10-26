import type { Vec3 } from "../math/vec3";
import type { DomainState } from "../state/domain-state";

export const SAVE_SCHEMA_VERSION = 3;

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

export interface SaveSnapshot {
  readonly version: typeof SAVE_SCHEMA_VERSION;
  readonly seed: number;
  /** Internal RNG state, so a loaded game continues the same random stream. */
  readonly rngState: number;
  readonly tick: number;
  readonly entities: readonly EntitySnapshot[];
  readonly domain: DomainState;
  /** Serialized ink story state (inkjs JSON). */
  readonly narrative: string | null;
  readonly meta: { readonly label: string; readonly objective: string };
}
