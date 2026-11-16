import { type GameClock, GAME_SECONDS_PER_REAL_SECOND, SECONDS_PER_DAY, SECONDS_PER_HOUR, secondOfDay } from "../time/game-clock";
import type { Contract } from "./contracts";

/**
 * W-3's job "Odbiór partii" (ADR-0082 §1): spoil the army's batch of twelve drones before it is
 * taken at 06:00. The silent way uploads a virus into the calibration core in server room N; the
 * upload counts while Seki stands by the terminal and pauses while she is away (unlike a hack, it
 * never drops). Pure numbers and rules; the simulation runs them.
 */
export const SABOTAGE = {
  /** Seconds of upload, and with the terminal breached (ICEpick, ADR-0029). */
  uploadSeconds: 40,
  breachUploadSeconds: 25,
  /** The upload counts within this of the terminal (horizontally) and on its level. */
  range: 3,
  reachY: 1.6,
  /** The batch leaves at this hour, and the job always gives at least this many hours to it. */
  shipHour: 6,
  minHours: 6,
  /** Pay at level 1 before the giver's standing: out unseen, out seen (ADR-0082 balance). */
  quietReward: 2400,
  seenReward: 1700,
  /** The guards of the hall, the mezzanine, the wagon airlock and armoury S. */
  crew: 4,
} as const;

/** Raised for good once the virus is in the core: the line's screens show it from then on. */
export const W3_VIRUS_FLAG = "w3:calibration-virus";

/** Key of the core's terminal the virus goes into. */
export const contractVirusKey = (contractId: string): string => `${contractId}-virus`;

/** The upload's length in seconds: shorter once the terminal is breached with ICEpick. */
export const sabotageUploadSeconds = (c: Contract): number => ((c.breach ?? []).includes("icepick") ? SABOTAGE.breachUploadSeconds : SABOTAGE.uploadSeconds);

/** Is the virus in: the upload has run its whole length? */
export const virusUploaded = (c: Contract, ticksPerSecond: number): boolean => c.progress !== undefined && c.progress >= sabotageUploadSeconds(c) * ticksPerSecond;

/**
 * The tick the batch ships: the next 06:00 with at least `minHours` of game time left to it, so 6
 * to 30 game hours, 6 to 30 real minutes (a minute is an hour, ADR-0017).
 */
export const sabotageDeadlineTick = (tick: number, clock: GameClock, ticksPerSecond: number): number => {
  const ship = SABOTAGE.shipHour * SECONDS_PER_HOUR;
  let game = (((ship - secondOfDay(clock)) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  if (game < SABOTAGE.minHours * SECONDS_PER_HOUR) game += SECONDS_PER_DAY;
  return tick + Math.round((game / GAME_SECONDS_PER_REAL_SECOND) * ticksPerSecond);
};

/** The pay once Seki is out, by whether she was seen leaving (the agreed reward is the unseen one). */
export const sabotagePay = (c: Contract): number => (c.seenLeaving ? Math.round((c.reward * SABOTAGE.seenReward) / SABOTAGE.quietReward) : c.reward);
