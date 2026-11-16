import { type GameClock, GAME_SECONDS_PER_REAL_SECOND, SECONDS_PER_DAY, SECONDS_PER_HOUR, secondOfDay } from "../time/game-clock";
import { SABOTAGE_LOUD } from "./sabotage-loud";

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
  /**
   * Pay at level 1 before the giver's standing: out unseen, out seen. The ADR's 2400 and 1700 were
   * set without the bonus (+300) and Genzō's style (2 x 6%): with them a perfect run of some 11
   * minutes made 272 €$ a minute, so the rates come down to keep the whole of it at 231 (the band
   * of ADR-0018 and ADR-0024, 215-235); the seen one keeps its share of the unseen.
   */
  quietReward: 2000,
  seenReward: 1420,
  /** `reboot_optics` blinds the server room's camera this long during the job (the table's 10 s elsewhere). */
  cameraRebootSeconds: 30,
  /** The guards of the hall, the mezzanine, the wagon airlock and armoury S. */
  crew: 4,
} as const;

/** What the sabotage's rules read of a contract (its fields, without importing the contract's module). */
interface SabotageJob {
  readonly reward: number;
  readonly progress?: number;
  readonly breach?: readonly string[];
  readonly seenLeaving?: true;
  readonly route?: "quiet" | "loud";
}

/** Raised for good once the virus is in the core: the line's screens show it from then on. */
export const W3_VIRUS_FLAG = "w3:calibration-virus";

/** Key of the core's terminal the virus goes into. */
export const contractVirusKey = (contractId: string): string => `${contractId}-virus`;

/** The upload's length in seconds: shorter once the terminal is breached with ICEpick. */
export const sabotageUploadSeconds = (c: SabotageJob): number => ((c.breach ?? []).includes("icepick") ? SABOTAGE.breachUploadSeconds : SABOTAGE.uploadSeconds);

/** Is the virus in: the upload has run its whole length? */
export const virusUploaded = (c: SabotageJob, ticksPerSecond: number): boolean => c.progress !== undefined && c.progress >= sabotageUploadSeconds(c) * ticksPerSecond;

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

/**
 * The pay once Seki is out: the loud way's rate (stage 3b, also after the switch from the quiet
 * one), else by whether she was seen leaving (the agreed reward is the unseen one).
 */
export const sabotagePay = (c: SabotageJob): number => {
  if (c.route === "loud") return Math.round((c.reward * SABOTAGE_LOUD.loudReward) / SABOTAGE.quietReward);
  return c.seenLeaving ? Math.round((c.reward * SABOTAGE.seenReward) / SABOTAGE.quietReward) : c.reward;
};
