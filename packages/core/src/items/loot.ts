import type { Vec3 } from "../math/vec3";
import type { LootLine } from "./types";

/**
 * A bag in the world (ADR-0015). Domain state, not an ECS snapshot: the world factory spawns a
 * bag entity for every container in a resident chunk.
 */
export interface LootContainer {
  /** "loot:<enemy key>" or "drop:<n>". */
  readonly key: string;
  readonly position: Vec3;
  /** Streaming chunk it lies in; "" outside every chunk. */
  readonly chunk: string;
  /** Simulation tick after which it is gone, loaded or not. */
  readonly expiresAtTick: number;
  readonly lines: readonly LootLine[];
}

export interface LootState {
  /** Oldest first. */
  readonly containers: readonly LootContainer[];
  /** Number of the next player drop ("drop:<n>"). */
  readonly dropSeq: number;
}

export const EMPTY_LOOT: LootState = { containers: [], dropSeq: 0 };
