import type { ContractKind } from "../contracts/kinds";
import type { EnemyTypeId } from "../items/enemies";
import { CURVE_EXPONENT, MAX_LEVEL, MIN_LEVEL } from "./curve";
import { killXpShare } from "./bands";

/**
 * Where experience comes from (ADR-0059). Every amount here is the value at level XP_BASE_LEVEL:
 * a contract's level and a kill's enemy scale it (`xpLevelScale`), an enemy's level against the
 * player's scales a kill. Quest steps carry their own XP in the quest definitions. The numbers are
 * tuned so that each district's main thread with its contracts gives about 7 levels, 6 to 9 (the
 * pace of the passage in `sim/test/balance.test.ts`, Krakowskie also in `core/test/progression.test.ts`).
 */
export type XpSource = "quest" | "contract" | "kill" | "hack" | "stealth";

export const XP_SOURCES: readonly XpSource[] = ["quest", "contract", "kill", "hack", "stealth"];

/**
 * How the XP of a source grows with its level (ADR-0059 stage 8): as the cost of a level does,
 * `(level / XP_BASE_LEVEL)^1.6` with the exponent of the curve, so a job or a kill teaches about
 * the same share of a level at every level, below XP_BASE_LEVEL too (a job of level 1 gives 6% of
 * its base, as level 1 costs 6% of level 6). The balance test of the passage set it. With +4% a
 * level, as the pay grows, Stare Miasto gave 4 levels and the docks 3. With the growth only from
 * level 6 and the base below it (round 1, 7.11), Krakowskie gave 8 levels even without any XP of
 * its quests, since its first jobs gave several cheap levels each; the user's aim is about 7.
 */
export const XP_BASE_LEVEL = 6;

export const xpLevelScale = (level: number): number => {
  const l = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
  return (l / XP_BASE_LEVEL) ** CURVE_EXPONENT;
};

/**
 * A contract's base by template, at level XP_BASE_LEVEL. The men a job sends add to it
 * (`CONTRACT_XP_PER_TARGET`), so a job that fights more teaches more. The bases are set by the
 * balance test for each giver's district, since each district's jobs make most of its pace:
 * Kaito's (delivery and elimination: Krakowskie, Stare Miasto), Hana's (retrieval, protection:
 * the market, which also has act II) and Genzō's (the docks). Hana's and Genzō's jobs send big
 * crews (four men from level 10, five for a docks infiltration or hack, Tessen's guards worth
 * more than a Hebi), so their bases are below a delivery's, which fights nobody. A delivery is
 * Kaito's job and takes the level of Krakowskie, not of Hana's stall (the user's decision of 7.11).
 */
export const CONTRACT_XP_BASE: Readonly<Record<ContractKind, number>> = {
  delivery: 500,
  eliminate: 500,
  retrieve: 350,
  protect: 400,
  escort: 350,
  infiltrate: 400,
  hack: 350,
};

/** What each man the contract sends against the player adds. */
export const CONTRACT_XP_PER_TARGET = 120;

/**
 * XP of a finished contract, from its difficulty: the template and the number of targets, grown
 * by the contract's level (`xpLevelScale`).
 */
export const contractXp = (kind: ContractKind, targets: number, level: number = MIN_LEVEL): number =>
  Math.round((CONTRACT_XP_BASE[kind] + Math.max(0, Math.floor(targets)) * CONTRACT_XP_PER_TARGET) * xpLevelScale(level));

/** An enemy the player took down, by type, at level XP_BASE_LEVEL: tougher and better armed is worth more. */
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
