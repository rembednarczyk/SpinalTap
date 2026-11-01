import type { Vec3 } from "../math/vec3";
import type { DifficultyProfile } from "../difficulty/difficulty";
import type { DomainState } from "../state/domain-state";
import type { Contract } from "../contracts/contracts";
import type { EnemyTypeId } from "../items/enemies";

/**
 * v24: an AI pinned in the world while its chunk sleeps (G-188) is marked with its time outside
 * every loaded chunk; an older save has none marked, its pinned AIs loaded by their alert as before.
 * v23: the heat's reinforcements (G-179), who are in no content table, with how many came in and
 * the wait for the next one; an older save has none, its reinforcements gone on loading as before.
 * v22: the contract whose people are still in the world after it ended (G-178), failed or paid,
 * until the next is taken, and the jobs replaced by a newer one while some of their people are
 * still about; an older save has none, their guards gone on loading as before.
 * v21: how sure a guard is that it saw someone (G-174), while it is not sure yet; an older save
 * has every guard calm.
 * v20: a difficulty profile asked for in a fight, waiting for its end (G-171); an older save has
 * none waiting.
 * v19: bodies (ADR-0065): the knocked out and the dead of a takedown lie where they were left,
 * carried by the player or hidden; an older save has none.
 * v18: the difficulty profile (ADR-0066); older saves play on "normal".
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
export const SAVE_SCHEMA_VERSION = 24;

/** Serializable state of one dynamic entity. Static level geometry is rebuilt from content. */
export interface EntitySnapshot {
  readonly key: string;
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly hp: number | null;
  /**
   * The maximum health of an enemy toughened by the difficulty (ADR-0066), when it differs from
   * the content's own; loaded, the enemy keeps the same share of its maximum then.
   */
  readonly maxHp?: number;
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
  /**
   * How sure a guard is that it saw the player (or saw through her disguise), 0..1 (G-174): it
   * fills over several steps, so a load must not start it from 0. Absent when 0.
   */
  readonly suspicion?: number;
  /**
   * An AI in the world while its chunk sleeps (G-188): seconds it has spent outside every loaded
   * chunk, 0 in a loaded one. Absent for everyone else, so a loaded game tells it from a sleeper.
   */
  readonly away?: number;
  /** Knocked out, or killed in a takedown and left lying (ADR-0065). Absent for everyone else. */
  readonly downed?: BodySnapshot;
}

/** A body (ADR-0065): what the street knows of it and where the player put it. */
export interface BodySnapshot {
  /** Where the player stood when she took it down. */
  readonly playerAt: Vec3;
  /** It was fighting her: its body sends the security looking, no report. */
  readonly fought: boolean;
  /** Somebody noticed it already; the security was told. */
  readonly found: boolean;
  readonly reported: boolean;
  /** Dead, not knocked out: nobody wakes it. */
  readonly dead: boolean;
  /** On the player's shoulder. */
  readonly carried: boolean;
  /** In a hiding place: out of everybody's sight. */
  readonly hidden: boolean;
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

/**
 * A contract as its targets were made (G-178): with the count of jobs done at the time, which
 * toughens them, so a job paid since (one more done) rebuilds them as they were.
 */
export interface ContractOnSite {
  readonly contract: Contract;
  readonly completed: number;
}

/** One of the heat's reinforcements (G-179): sent in at run time, so made again from this. */
export interface ReinforcementSnapshot {
  /** Which of the heat's it is, from 1: what spreads the searchers and picks the enforcers. */
  readonly n: number;
  readonly type: EnemyTypeId;
  /** The entry it came in by. */
  readonly home: Vec3;
  /** Its state, keyed `security:<n>`. */
  readonly state: EntitySnapshot;
}

/**
 * The heat's reinforcements (G-179): those in the world, how many came in since the heat came up
 * (the next is one more) and the seconds until the next may come.
 */
export interface ReinforcementsSnapshot {
  readonly sent: number;
  readonly wait: number;
  readonly people: readonly ReinforcementSnapshot[];
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
  /**
   * A profile asked for in a fight (ADR-0066): it takes effect when the fight is over, after
   * loading too. Absent when none is waiting.
   */
  readonly pendingDifficulty?: DifficultyProfile;
  /**
   * The contract that ended (failed, or paid) while no other was taken since (G-178): its targets
   * are rebuilt from it on loading, so the guards of an alarm fight on. Absent while a contract
   * is in the log, running or cleared (its targets come from there), and before the first is taken.
   * A paid one (no failed flag) has its site cleared (G-195): only its people saved return, and
   * those of them asleep in an older save are left out.
   */
  readonly endedContract?: ContractOnSite;
  /**
   * Jobs replaced by a newer one while some of their people are still in the world (G-178), in
   * the order taken: no chunk brings them back, so only those saved return. Who of them falls
   * asleep with a chunk is gone for good, and the job with him once nobody is left. Absent when none.
   */
  readonly formerContracts?: readonly ContractOnSite[];
  /** The heat's reinforcements (G-179). Absent with none about and none due. */
  readonly reinforcements?: ReinforcementsSnapshot;
  /** Serialized ink story state (inkjs JSON). */
  readonly narrative: string | null;
  readonly meta: { readonly label: string; readonly objective: string };
}
