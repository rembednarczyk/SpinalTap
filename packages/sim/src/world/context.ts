import type { CrimeKind, DisturbanceKind, DomainEvents, DomainState, EntityId, EventBus, InputFrame, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { SeededRandom } from "../rng/seeded-random";
import type { Entity } from "./components";
import type { WorldStreamer } from "./streaming";

/** Transient per-session flags that are not part of the domain model. */
export interface SessionState {
  dialogueActive: boolean;
  gameOver: boolean;
  focusId: EntityId | null;
  /** Prompt shown for the focused entity; it can change while focus stays (a stall closing). */
  focusPrompt: string | null;
  /** The last shot that hurt or nearly hit the player, or was fired close by; null if none. */
  lastThreat: { readonly tick: number; readonly sourceId: EntityId } | null;
  /** Noise and crimes of the current step, for the crime system at its end (ADR-0029). */
  street: StreetLog;
  /** Transient memory of the contract layer and the phone (ADR-0029). */
  watch: SessionWatch;
}

/** Something the street noticed this step (the payload of `Disturbance`). */
export interface StreetDisturbance {
  readonly kind: DisturbanceKind;
  readonly at: Vec3;
  readonly radius: number;
  readonly sourceId: EntityId;
}

/** Something the player did this step that is a crime if someone sees it (ADR-0029). */
export interface Offence {
  readonly crime: CrimeKind;
  readonly at: Vec3;
  readonly incident: number;
}

export interface StreetLog {
  disturbances: StreetDisturbance[];
  offences: Offence[];
  /** Incidents so far (ids of offences); transient, a loaded game counts from 0 again. */
  incidents: number;
}

export interface SessionWatch {
  /** District the player was in at the end of the last step (offers on entering). */
  district: string | null;
  /** The player's health at the end of the last step (the `untouched` badge). */
  playerHp: number | null;
  /** Scanner focus at the end of the last step. */
  focus: EntityId | null;
  /** Whole RAM last reported. */
  ram: number | null;
  /** Seconds until the next reinforcement may come in. */
  reinforce: number;
}

export const freshSession = (): SessionState => ({
  dialogueActive: false,
  gameOver: false,
  focusId: null,
  focusPrompt: null,
  lastThreat: null,
  street: { disturbances: [], offences: [], incidents: 0 },
  watch: { district: null, playerHp: null, focus: null, ram: null, reinforce: 0 },
});

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
  /** Game seed, for streams derived from it (loot). */
  readonly seed: number;
  readonly streamer: WorldStreamer;
  readonly bus: EventBus<DomainEvents>;
  readonly dt: number;
  readonly tick: number;
  input: InputFrame;
}

export interface System {
  readonly name: string;
  run(ctx: SimContext): void;
}
