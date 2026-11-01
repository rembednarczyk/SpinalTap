import type { CrimeKind, CrowdState, EntityId, Vec3 } from "@seki/core";
import type { CharacterBody } from "./body";

/**
 * What the street knows about a body (ADR-0065), next to its `unconscious`: someone knocked out,
 * or killed in a takedown and left lying. Saved with the entity (`BodySnapshot`) but for the
 * finder and the waking, which start again after a load.
 */
export interface DownedBody {
  /** Where the player stood when she took it down: what it knows once woken. */
  readonly playerAt: Vec3;
  /** It was fighting her (ADR-0029: no crime): its body sends the security looking, with no report and no heat. */
  readonly fought: boolean;
  /** Somebody (an NPC, a camera) has noticed it: the street around it took fright once. */
  found: boolean;
  /** The district's security has been told (a guard of its or a camera saw it). */
  reported: boolean;
  /** The NPC walking over to wake it, null when nobody is. */
  finder: EntityId | null;
  /** Seconds the finder has spent at its side; at `WAKE_TIME` it wakes. */
  wake: number;
  /** Killed, not knocked out: nobody wakes it, the finder only looks and starts the search. */
  dead: boolean;
  /**
   * Who has looked at it dead already (an NPC walks over only once): the others still may, so a
   * passer-by does not keep the security from finding it. Not saved.
   */
  lookedBy: readonly EntityId[];
  /** On the player's shoulder (stage 3): it follows her and nobody sees it lie. */
  carried: boolean;
  /** In a hiding place: out of everybody's sight for good. */
  hidden: boolean;
  /** Its own body while carried or hidden (it pushes nobody then), put back when it is dropped. */
  frame: CharacterBody | null;
}

/** What a hiding place for bodies is (ADR-0065); one body fits in each. */
export type HideKind = "container" | "dumpster" | "locker";

export interface GangerAi {
  readonly home: Vec3;
  readonly aggroRange: number;
  readonly attackRange: number;
  /**
   * Set once the ganger has decided to fight the player; never resets. Gangers friendly to
   * the player only set it when provoked (gunfire nearby or a hit).
   */
  alerted: boolean;
  /**
   * Key of the NPC this ganger was sent to kill (a protection job's wave, an escort's ambush).
   * It goes for the victim, and turns on the player only once alerted and with the player in
   * sight and range.
   */
  readonly victim?: string;
  /**
   * Corporate guard (ADR-0024): sees only in front of it, notices a crouching player late and
   * needs a moment of looking before it raises the alarm. Without it the ganger sees all round
   * and decides at once, as before.
   */
  readonly cone?: true;
  /** How sure the guard is that it saw someone, 0..1; at 1 it is alerted. Saved while above 0 (G-174). */
  suspicion?: number;
  /** A guard on a post looks around: its facing sweeps around `yaw` (ADR-0024). */
  readonly watch?: { readonly yaw: number; readonly phase: number; readonly period?: number };
  /**
   * Where it last saw the player, or a lead it was given (a noise, a camera, a trace) (ADR-0029).
   * An alerted AI chases it once the player is out of sight; an unalerted one walks there to
   * look. Saved with the entity.
   */
  lastKnown?: Vec3 | null;
  /** Seconds it still looks around `lastKnown` before going back to its post. Saved. */
  search?: number;
  /** Seconds the player has been out of its sight while alerted. Saved (`EntitySnapshot.lost`, since v11). */
  lost?: number;
  /**
   * It saw the player this step (read by the heat after the AI ran). Transient: perception sets it
   * every step before it is read, so it is not saved.
   */
  sees?: boolean;
  /**
   * Sees through disguises (ADR-0033): a Tessen shift boss, every third Hebi. Fixed at spawn
   * from the key, so it needs no saving.
   */
  readonly enforcer?: true;
  /**
   * A street patrol on its own ground (ADR-0048): Hebi walking the Old Town among the people
   * who live there. Neutral to the player, it keeps an eye on her instead of attacking; a hostile
   * standing, the heat's hunt, a blown disguise of its faction or a provocation alert it like
   * any ganger. Fixed by content, so it needs no saving.
   */
  readonly patrol?: true;
}

/**
 * A sniper (ADR-0024): no behaviour tree, a small state machine. It keeps to a perch high up,
 * aims for `AIM_TIME` with the laser on (the telegraph), fires, waits, and walks to the perch
 * farthest from the player once the player gets close. Transient like the melee state: a game
 * loaded mid-aim starts idle on its saved position.
 */
export interface SniperState {
  readonly perches: readonly Vec3[];
  phase: "idle" | "aim" | "rest" | "move";
  /** Seconds left of the aim or the rest. */
  timer: number;
  /** Perch it holds or walks to (index into `perches`). */
  perch: number;
}

/** A defector walked to the boat (ADR-0024): follows `route` while the player is close. */
export interface EscortAi {
  readonly route: readonly [Vec3, ...Vec3[]];
}

/**
 * A bystander that keeps to its spot (or its daily plan), runs from a player the street fears
 * and reacts to disturbances (ADR-0029). `crowd` is transient: a loaded game starts calm.
 */
export interface CivilianAi {
  readonly home: Vec3;
  crowd?: CrowdMind;
}

/** A bystander's reaction to the street (ADR-0029). Transient, not saved. */
export interface CrowdMind {
  state: CrowdState;
  /** Seconds left of the state; at 0 it calms down one step (cowering, then fleeing, then calm). */
  timer: number;
  /** What it reacts to (runs away from it, looks at it). */
  from: Vec3;
  /** A call to the security in progress. */
  call: WitnessCall | null;
  /** Seconds left of being too scared to phone (the player aimed at it). */
  scared: number;
}

export interface WitnessCall {
  readonly crime: CrimeKind;
  readonly at: Vec3;
  /** The incident it saw; several witnesses of one incident make one report. */
  readonly incident: number;
  /** Someone knocked out in it (ADR-0065), marked reported when the call goes through. */
  readonly body?: EntityId;
  left: number;
}
