import { CONTRACT_KINDS, type ContractKind } from "./kinds";
import { type BonusCondition, CONTRACT_BADGES, type ContractBadge, type ContractRank, FIXER_STYLE } from "./debrief";

/**
 * Scoring of a contract (ADR-0029, on the contracts of ADR-0028): the counters the simulation
 * keeps while a job runs, the badges they give, the rank and the extra pay. Pure functions.
 */

/** What happened during the job so far. Lives in the contract, so it is saved with it. */
export interface ContractTally {
  /** Simulation tick of the acceptance. */
  readonly startTick: number;
  /** Tick the job itself was done (status "cleared"); the clock of `swift` stops there. */
  readonly clearedTick?: number;
  /** An enemy or a camera noticed the player (alerted, or a camera's spot). */
  readonly detected: boolean;
  /** A crime was reported or a camera raised the alarm (the job's own scripted phase is not one). */
  readonly alarm: boolean;
  /** People the player killed who were not the job's targets (bystanders, other guards). */
  readonly extraKills: number;
  /** The player lost health. */
  readonly damaged: boolean;
  /** A quickhack landed or a terminal was breached. */
  readonly hacked: boolean;
  /** The bonus condition can no longer be met (ContractBonusChanged went out with `kept: false`). */
  readonly bonusLost: boolean;
}

export const freshTally = (startTick: number): ContractTally => ({
  startTick,
  detected: false,
  alarm: false,
  extraKills: 0,
  damaged: false,
  hacked: false,
  bonusLost: false,
});

/** The one optional condition of each template and what meeting it pays. */
export const CONTRACT_BONUS: Readonly<Record<ContractKind, BonusCondition>> = {
  eliminate: { badge: "clean", label: "Tylko cele, nikt więcej", bonus: 90 },
  delivery: { badge: "no_alarm", label: "Bez alarmu i bez heat", bonus: 60 },
  retrieve: { badge: "ghost", label: "Nie daj się zauważyć", bonus: 100 },
  protect: { badge: "untouched", label: "Wyjdź bez draśnięcia", bonus: 100 },
  escort: { badge: "clean", label: "Tylko zasadzka, nikt więcej", bonus: 110 },
  infiltrate: { badge: "netrunner", label: "Użyj quickhacka", bonus: 110 },
  hack: { badge: "no_alarm", label: "Bez heat i bez kamer", bonus: 120 },
};

/** Par time of each template, in seconds from acceptance to the job being done (`swift`). */
export const CONTRACT_PAR_SECONDS: Readonly<Record<ContractKind, number>> = {
  eliminate: 120,
  delivery: 35,
  retrieve: 120,
  protect: 120,
  escort: 150,
  infiltrate: 150,
  hack: 110,
};

/** Share of the reward a fixer adds for each badge of their style, rounded to 5 €$. */
export const STYLE_SHARE = 0.06;

/** Is the badge still possible (or earned) given the counters and the seconds so far? */
export const badgeHolds = (badge: ContractBadge, t: ContractTally, seconds: number, kind: ContractKind): boolean => {
  switch (badge) {
    case "ghost":
      return !t.detected;
    case "no_alarm":
      return !t.alarm;
    case "clean":
      return t.extraKills === 0;
    case "untouched":
      return !t.damaged;
    case "swift":
      return seconds <= CONTRACT_PAR_SECONDS[kind];
    case "netrunner":
      // Still possible until the end: it is earned, not kept.
      return true;
  }
};

/** Badges earned at the end of the job, in `CONTRACT_BADGES` order. */
export const earnedBadges = (t: ContractTally, seconds: number, kind: ContractKind): ContractBadge[] =>
  CONTRACT_BADGES.filter((b) => (b === "netrunner" ? t.hacked : badgeHolds(b, t, seconds, kind)));

/** Rank on the card (ADR-0028): S for 4+ badges with the bonus met, A for 3 or more, B for 1-2, C for none. */
export const contractRank = (badges: readonly ContractBadge[], bonusMet: boolean): ContractRank => {
  if (badges.length >= 4 && bonusMet) return "S";
  if (badges.length >= 3) return "A";
  if (badges.length >= 1) return "B";
  return "C";
};

/** Extra pay of the giver's style: `STYLE_SHARE` of the reward per matching badge. */
export const styleBonusOf = (kind: ContractKind, badges: readonly ContractBadge[], reward: number): number => {
  const style = FIXER_STYLE[CONTRACT_KINDS[kind].giver];
  const matching = badges.filter((b) => style.includes(b)).length;
  return Math.round((reward * STYLE_SHARE * matching) / 5) * 5;
};

export interface Debrief {
  readonly badges: readonly ContractBadge[];
  readonly rank: ContractRank;
  readonly bonus: number;
  readonly styleBonus: number;
  readonly seconds: number;
}

/** The end-of-job card from the counters: badges, rank, the condition's bonus and the style bonus. */
export const debriefOf = (kind: ContractKind, t: ContractTally, reward: number, endTick: number, ticksPerSecond: number): Debrief => {
  const seconds = Math.max(0, Math.round(((t.clearedTick ?? endTick) - t.startTick) / ticksPerSecond));
  const badges = earnedBadges(t, seconds, kind);
  const condition = CONTRACT_BONUS[kind];
  const met = badges.includes(condition.badge);
  return { badges, rank: contractRank(badges, met), bonus: met ? condition.bonus : 0, styleBonus: styleBonusOf(kind, badges, reward), seconds };
};
