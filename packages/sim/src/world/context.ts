import type { TrafficDensity } from "../content/traffic";
import type { CrimeKind, DifficultyProfile, DisturbanceKind, DomainEvents, DomainState, EntityId, EventBus, InputFrame, Vec3 } from "@seki/core";
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
  /** The player while riding the metro, out of the world (ADR-0034); null on foot. */
  passenger: Entity | null;
  /** Street encounters and micro-events of this session (ADR-0034). */
  street2: StreetScenes;
  /**
   * The interior the player is in (ADR-0061): its id, null outside, undefined until the first
   * step of a new game has read it from the position; a load reads it from the saved one (G-174).
   * Not saved.
   */
  interior: string | null | undefined;
  /** The takedown under way (ADR-0065), null when none. Transient, not saved. */
  takedown: TakedownRun | null;
  /**
   * Whom the interact key would take down now, null when nobody. The takedown system names the
   * candidate; the interaction system keeps it only when the takedown holds the prompt (nothing
   * nearer to talk to, open or climb), so the HUD and the key agree.
   */
  takedownTarget: { readonly id: EntityId; readonly distance: number } | null;
  /**
   * The attack button held through the end of a takedown (ADR-0065): it fires nothing until it is
   * let go. Transient, not saved.
   */
  attackLock: boolean;
  /** The body on the player's shoulder (ADR-0065), null when none. Saved on the body (`downed.carried`). */
  carrying: EntityId | null;
  /**
   * The body the interact key would pick up now, null when none: named by the carry system, kept
   * by the interaction system only when it holds the prompt, like `takedownTarget`.
   */
  bodyTarget: { readonly id: EntityId; readonly distance: number } | null;
  /** The free hiding place in reach of the carried body, null when none: the key hides it there. */
  hideSpot: EntityId | null;
  /**
   * A difficulty asked for during a fight (ADR-0066): it takes effect when the fight is over.
   * Transient, not saved.
   */
  pendingDifficulty: DifficultyProfile | null;
}

/** A takedown in progress (ADR-0065): the player and `target` stand still until `left` runs out. */
export interface TakedownRun {
  readonly target: EntityId;
  /** Seconds left. */
  left: number;
  /** Asked for by the command; holding the attack button through most of it kills as well. */
  readonly lethal: boolean;
  /** Steps of the takedown so far, and how many of them with the attack button held. */
  steps: number;
  held: number;
  /** The player's health when it began: any damage below it breaks the hold. */
  readonly health: number;
}

/** A street encounter whose dialogue is open, and the micro-event under way (ADR-0034). */
export interface StreetScenes {
  encounter: string | null;
  /** Passers-by put at an encounter's point, by encounter id. */
  npcs: Readonly<Record<string, EntityId>>;
  micro: MicroEventRun | null;
  /** District at the end of the last step, for entries. */
  district: string | null;
}

/** A micro-event in progress: who is in it, where, and what ends it. Transient, not saved. */
export interface MicroEventRun {
  readonly id: string;
  readonly kind: "mugging" | "aid";
  readonly at: Vec3;
  /** The passer-by (the one robbed, or the one to help). */
  readonly victim: EntityId;
  /** The muggers of a mugging; empty for an aid. */
  readonly attackers: readonly EntityId[];
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
  /** Someone knocked out by it (ADR-0065): once reported, its body brings no second call. */
  readonly body?: EntityId;
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
  /** Reinforcements sent in since the heat came up (G-179): the last one's `n`; 0 once all have gone. */
  sent: number;
}

export const freshSession = (): SessionState => ({
  dialogueActive: false,
  gameOver: false,
  focusId: null,
  focusPrompt: null,
  lastThreat: null,
  street: { disturbances: [], offences: [], incidents: 0 },
  watch: { district: null, playerHp: null, focus: null, ram: null, reinforce: 0, sent: 0 },
  passenger: null,
  street2: { encounter: null, npcs: {}, micro: null, district: null },
  interior: undefined,
  takedown: null,
  takedownTarget: null,
  attackLock: false,
  carrying: null,
  bodyTarget: null,
  hideSpot: null,
  pendingDifficulty: null,
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
  /** Most residents of the crowd per chunk (ADR-0041): follows the graphics quality, 0 for none. */
  readonly crowdCap: number;
  /** How much traffic drives round the player (ADR-0050): follows the crowd's density unless set. */
  readonly traffic: TrafficDensity;
  readonly dt: number;
  readonly tick: number;
  input: InputFrame;
}

export interface System {
  readonly name: string;
  run(ctx: SimContext): void;
}
