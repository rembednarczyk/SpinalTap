import type { LootLine } from "../items/types";
import { sellPrice } from "../shop/trade";
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
   * for it (6%) and the armoury chest sold (`armouryLootValue`, 472) some 8 minutes of the loud way
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

/**
 * The chest of armoury S, opened with the charges' case (ADR-0082 §1 p. 2, cut to the band's
 * 450 €$ of loot): Tessen's AR-5, a belt of 5.56 for it and a medkit. The DMR and the Tessen vest
 * of the ADR's list stay for armoury N (with them the loot sells for some 1300 €$).
 */
export const W3_ARMOURY_LOOT: readonly LootLine[] = [
  { kind: "item", item: "tessen_ar5", rarity: "common", qty: 1 },
  { kind: "ammo", ammo: "556", qty: 90 },
  { kind: "stack", item: "medkit", qty: 1 },
];

/**
 * What the chest is worth to her at level 1: the AR-5 and the medkit sold to a trader at standard
 * terms. The ammunition is not counted: it goes on the waves (ADR-0082 balance, "minus ammo").
 */
export const armouryLootValue = (lines: readonly LootLine[] = W3_ARMOURY_LOOT): number =>
  lines.reduce((sum, l) => sum + (l.kind === "item" || l.kind === "stack" ? l.qty * sellPrice({ def: l.item, rarity: l.kind === "item" ? l.rarity : "common" }) : l.kind === "eddies" ? l.qty : 0), 0);

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
 * of her view, never nearer than 60 m to the clinic, one squad at a time.
 */
export const TESSEN_HUNT = {
  days: 3,
  everyHours: 6,
  squadMin: 2,
  squadMax: 3,
  minDistance: 45,
  clinicClear: 60,
} as const;

const HUNT_PREFIX = "tessen-hunt:";
const HUNT_ROLL_PREFIX = "tessen-hunt-roll:";

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
