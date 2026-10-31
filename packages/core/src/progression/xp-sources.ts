import type { ContractKind } from "../contracts/kinds";
import type { EnemyTypeId } from "../items/enemies";

/**
 * Where experience comes from (ADR-0059). Every amount here is the value at level 1: the level
 * of the enemy and of the contract scale it in stage 5. Quest steps carry their own XP in the
 * quest definitions. The numbers are tuned so that one district's main thread with its
 * contracts gives 8 to 10 levels (the pace test in `core/test/progression.test.ts`).
 */
export type XpSource = "quest" | "contract" | "kill" | "hack" | "stealth";

export const XP_SOURCES: readonly XpSource[] = ["quest", "contract", "kill", "hack", "stealth"];

/** A contract's base by template: the harder and longer the job, the more it teaches. */
export const CONTRACT_XP_BASE: Readonly<Record<ContractKind, number>> = {
  delivery: 500,
  eliminate: 550,
  retrieve: 600,
  protect: 650,
  escort: 800,
  infiltrate: 850,
  hack: 800,
};

/** What each man the contract sends against the player adds. */
export const CONTRACT_XP_PER_TARGET = 150;

/** XP of a finished contract, from its difficulty: the template and the number of targets. */
export const contractXp = (kind: ContractKind, targets: number): number => CONTRACT_XP_BASE[kind] + Math.max(0, Math.floor(targets)) * CONTRACT_XP_PER_TARGET;

/** An enemy the player took down, by type: tougher and better armed is worth more. */
export const ENEMY_XP: Readonly<Record<EnemyTypeId, number>> = {
  hebi_lookout: 50,
  hebi_ganger: 60,
  hebi_brawler: 70,
  hebi_enforcer: 120,
  kagami_cleaner: 140,
  tessen_guard: 130,
  tessen_sniper: 150,
};

/** XP of a kill. The level difference (ADR-0059: −5 levels 10%, +5 levels 150%) comes in stage 5. */
export const killXp = (type: EnemyTypeId): number => ENEMY_XP[type];

/** A quickhack that landed. */
export const QUICKHACK_XP = 25;

/** A terminal breach that won something, and each daemon won. */
export const BREACH_XP = 100;
export const BREACH_XP_PER_DAEMON = 25;

export const breachXp = (daemons: number): number => (daemons > 0 ? BREACH_XP + daemons * BREACH_XP_PER_DAEMON : 0);

/**
 * Stealth (ADR-0059): a contract finished without anyone noticing the player (the debrief's
 * `detected` stays false), on top of the contract's own XP. Takedowns without an alarm are a
 * separate feature; when they come, they report the same `stealth` source.
 */
export const UNDETECTED_CONTRACT_XP = 150;
