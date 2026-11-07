import type { ContractKind } from "../contracts/kinds";
import type { EnemyTypeId } from "../items/enemies";
import { CURVE_EXPONENT, MAX_LEVEL, MIN_LEVEL } from "./curve";
import { killXpShare } from "./bands";

/**
 * Where experience comes from (ADR-0059). Every amount here is the value up to level XP_CURVE_FROM:
 * a contract's level and a kill's enemy grow it (`xpLevelScale`), an enemy's level against the
 * player's scales a kill. Quest steps carry their own XP in the quest definitions. The numbers are
 * tuned so that one district's main thread with its contracts gives 8 to 10 levels (the pace of
 * the passage in `sim/test/balance.test.ts`, Krakowskie also in `core/test/progression.test.ts`).
 */
export type XpSource = "quest" | "contract" | "kill" | "hack" | "stealth";

export const XP_SOURCES: readonly XpSource[] = ["quest", "contract", "kill", "hack", "stealth"];

/**
 * How the XP of a source grows with its level (ADR-0059 stage 8). Up to XP_CURVE_FROM it stays at
 * its base; from there it grows as the cost of a level does (`(level / XP_CURVE_FROM)^1.6`, the
 * exponent of the curve), so a job or a kill in a later band teaches about the same share of a level
 * as one at the end of Krakowskie. The balance test of the passage (`sim/test/balance.test.ts`)
 * set it: with +4% a level, as the pay grows, Stare Miasto gave 4 levels and the docks 3, not 8 to 10.
 */
export const XP_CURVE_FROM = 6;

export const xpLevelScale = (level: number): number => {
  const l = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
  return Math.max(1, (l / XP_CURVE_FROM) ** CURVE_EXPONENT);
};

/**
 * A contract's base by template: the harder and longer the job, the more it teaches. A delivery
 * fights nobody and takes the level of Hana's stall in the market's band (10 at least), so its
 * base is 300 (500 before stage 8: with the growth of `xpLevelScale` it gave Krakowskie 11 levels
 * for some seeds of the balance test and left the docks 1).
 */
export const CONTRACT_XP_BASE: Readonly<Record<ContractKind, number>> = {
  delivery: 300,
  eliminate: 550,
  retrieve: 600,
  protect: 650,
  escort: 800,
  infiltrate: 850,
  hack: 800,
};

/** What each man the contract sends against the player adds. */
export const CONTRACT_XP_PER_TARGET = 150;

/**
 * XP of a finished contract, from its difficulty: the template and the number of targets, grown
 * by the contract's level (`xpLevelScale`).
 */
export const contractXp = (kind: ContractKind, targets: number, level: number = MIN_LEVEL): number =>
  Math.round((CONTRACT_XP_BASE[kind] + Math.max(0, Math.floor(targets)) * CONTRACT_XP_PER_TARGET) * xpLevelScale(level));

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

/**
 * XP of a kill: the type's, grown by the enemy's level as a job's is (`xpLevelScale`), and by its
 * level against the player's (−5 levels 10%, +5 levels 150%).
 */
export const killXp = (type: EnemyTypeId, enemy: number = MIN_LEVEL, player: number = enemy): number =>
  Math.round(ENEMY_XP[type] * xpLevelScale(enemy) * killXpShare(enemy, player));

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

/** The stealth bonus of a job of `level`, grown as the job's own XP is. */
export const undetectedXp = (level: number = MIN_LEVEL): number => Math.round(UNDETECTED_CONTRACT_XP * xpLevelScale(level));
