import type { DomainEvents, DomainState, EntityId, EventBus, InputFrame } from "@seki/core";
import type { World } from "miniplex";
import type { SeededRandom } from "../rng/seeded-random";
import type { Entity } from "./components";

/** Transient per-session flags that are not part of the domain model. */
export interface SessionState {
  dialogueActive: boolean;
  gameOver: boolean;
  focusId: EntityId | null;
}

/** Mutable holder for the immutable domain state, plus a dirty marker for quest evaluation. */
export interface DomainHolder {
  domain: DomainState;
  flagsDirty: boolean;
}

export interface SimContext {
  readonly world: World<Entity>;
  readonly state: DomainHolder;
  readonly session: SessionState;
  readonly rng: SeededRandom;
  readonly bus: EventBus<DomainEvents>;
  readonly dt: number;
  readonly tick: number;
  input: InputFrame;
}

export interface System {
  readonly name: string;
  run(ctx: SimContext): void;
}
