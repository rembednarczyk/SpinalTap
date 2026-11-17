import { type GameClock, SECONDS_PER_DAY, SECONDS_PER_HOUR, secondOfDay } from "../time/game-clock";

/**
 * W-3's loud way (ADR-0082 §1 "Droga głośna", stage 3b): the charges taken from armoury S (that
 * always raises the alarm), three of them planted on the line's stations S1-S4, the fuse, the blast
 * and the way out; then Tessen hunts Seki in the city for three days. Pure numbers and rules; the
 * simulation runs them.
 */
export const SABOTAGE_LOUD = {
  /** Charges in the armoury's case and how many of the four stations they must take down. */
  charges: 3,
  /** Seconds of planting one charge; a hit on Seki starts it over. */
  plantSeconds: 2.5,
  /** Planting counts within this of the station (horizontally) and on its level. */
  plantRange: 1.8,
  /** The fuse runs this long after the third charge, unless Seki leaves the hall first. */
  fuseSeconds: 60,
  /** The blast: this much damage at a charge, falling to nothing at `blastRadius`, only in clear line. */
  blastDamage: 60,
  blastRadius: 10,
  /** The second wave comes in from the pickup yard this long after the alarm. */
  secondWaveSeconds: 60,
  /**
   * Pay at level 1 before the giver's standing (the user's decision of 16.11: the armoury's loot
   * counts in the income, the rate goes down). With the bonus (nobody killed, +300), Genzō's style
   * for it (6%) and the armoury chest sold (`armouryLootValue` in `w3-armoury.ts`, 472) some 8 minutes of the loud way
   * make 222 €$ a minute, and with both his badges 230, in the band of ADR-0018 and ADR-0024
   * (215-235). The ADR's table had 1400 without the loot.
   */
  loudReward: 950,
  /** Tessen's standing after the loud way: at most this (ADR-0082 balance: min(now, -60)). */
  tessenAfter: -60,
} as const;

/** The line's stations a charge goes on (ADR-0082 §2, picture 03): S1 and S2 by belt L1, S3 and S4 by L2. */
export const W3_STATIONS = ["S1", "S2", "S3", "S4"] as const;
export type W3StationId = (typeof W3_STATIONS)[number];

export const isW3Station = (s: unknown): s is W3StationId => typeof s === "string" && (W3_STATIONS as readonly string[]).includes(s);

/** Raised for good when a charge on the station went off: the content puts its wreck there. */
export const stationDownFlag = (station: W3StationId): string => `w3:station:${station}:down`;

/** Raised 60 s after the job's alarm: the second wave comes in from the pickup yard. */
export const secondWaveFlag = (contractId: string): string => `alarm:${contractId}:wave2`;

/** Key of the armoury's charges case and of a station's charge spot of the running job. */
export const contractChargesKey = (contractId: string): string => `${contractId}-charges`;
export const contractStationKey = (contractId: string, station: W3StationId): string => `${contractId}-station-${station}`;

/** What the loud way's rules read of a contract (its fields, without importing the contract's module). */
interface LoudJob {
  readonly route?: "quiet" | "loud";
  readonly charges?: readonly W3StationId[];
  readonly fuseTick?: number;
  readonly detonated?: true;
}

/** Has she the charges (taken from the armoury), and how many are still in her bag? */
export const chargesTaken = (c: LoudJob): boolean => c.charges !== undefined;
export const chargesLeft = (c: LoudJob): number => (c.charges ? SABOTAGE_LOUD.charges - c.charges.length : 0);

/** The blast's damage at `distance` from a charge: falling linearly from `blastDamage` to 0 at the radius. */
export const blastDamageAt = (distance: number): number =>
  distance >= SABOTAGE_LOUD.blastRadius ? 0 : Math.round(SABOTAGE_LOUD.blastDamage * (1 - Math.max(0, distance) / SABOTAGE_LOUD.blastRadius));

/** Tessen's change of standing after the loud way: down to `tessenAfter`, never up. */
export const loudTessenDelta = (tessen: number): number => Math.min(0, SABOTAGE_LOUD.tessenAfter - tessen);

/**
 * Tessen's hunt in the city (ADR-0082 §3.7): three game days from the loud way's end; on entering a
 * district and every 6 game hours in it a squad of 2-3 Tessen guards, at least 45 m from Seki and out
 * of her view, never nearer than 60 m to the clinic, one squad at a time. The roll warns her and the
 * squad comes in 20-40 s later (G-911): on her trail it came in a second after she entered.
 */
export const TESSEN_HUNT = {
  days: 3,
  everyHours: 6,
  squadMin: 2,
  squadMax: 3,
  minDistance: 45,
  clinicClear: 60,
  delayMinSeconds: 20,
  delayMaxSeconds: 40,
} as const;

const HUNT_PREFIX = "tessen-hunt:";
const HUNT_ROLL_PREFIX = "tessen-hunt-roll:";
const HUNT_SQUAD_PREFIX = "tessen-hunt-squad:";

/** The hunt's flag: the game day (from 0) it ends on. */
export const tessenHuntFlag = (untilDay: number): string => `${HUNT_PREFIX}${untilDay}`;

export const gameDayOf = (clock: GameClock): number => Math.floor(clock.seconds / SECONDS_PER_DAY);

/** The day the hunt ends, from the flags; null without one. */
export const tessenHuntUntil = (flags: readonly string[]): number | null => {
  for (const f of flags) if (f.startsWith(HUNT_PREFIX)) return Number(f.slice(HUNT_PREFIX.length));
  return null;
};

/** Is Tessen hunting her on this day? */
export const tessenHuntActive = (flags: readonly string[], clock: GameClock): boolean => {
  const until = tessenHuntUntil(flags);
  return until !== null && gameDayOf(clock) < until;
};

/** Which roll of the hunt this moment is: the district and the 6-hour stretch of the day. */
export const tessenHuntRollFlag = (district: string, clock: GameClock): string =>
  `${HUNT_ROLL_PREFIX}${district}@${gameDayOf(clock)}:${Math.floor(secondOfDay(clock) / (TESSEN_HUNT.everyHours * SECONDS_PER_HOUR))}`;

export const isTessenHuntRollFlag = (flag: string): boolean => flag.startsWith(HUNT_ROLL_PREFIX);

/** The squad's size from a draw in [0, 1). */
export const tessenSquadSize = (draw: number): number => TESSEN_HUNT.squadMin + Math.min(TESSEN_HUNT.squadMax - TESSEN_HUNT.squadMin, Math.floor(draw * (TESSEN_HUNT.squadMax - TESSEN_HUNT.squadMin + 1)));

/** The seconds between the roll and the squad coming in, from a draw in [0, 1). */
export const tessenSquadDelaySeconds = (draw: number): number =>
  TESSEN_HUNT.delayMinSeconds + Math.floor(draw * (TESSEN_HUNT.delayMaxSeconds - TESSEN_HUNT.delayMinSeconds + 1));

/** A squad on its way: a flag, so a load keeps it, with its size and the tick it comes in on. */
export interface TessenSquadDue {
  readonly flag: string;
  readonly size: number;
  readonly tick: number;
}

export const tessenSquadFlag = (size: number, tick: number): string => `${HUNT_SQUAD_PREFIX}${size}@${tick}`;

export const isTessenSquadFlag = (flag: string): boolean => flag.startsWith(HUNT_SQUAD_PREFIX);

/** The squad on its way, from the flags; null without one. */
export const tessenSquadDue = (flags: readonly string[]): TessenSquadDue | null => {
  const flag = flags.find(isTessenSquadFlag);
  if (!flag) return null;
  const [size = 0, tick = 0] = flag.slice(HUNT_SQUAD_PREFIX.length).split("@").map(Number);
  return { flag, size, tick };
};
