import { type GameClock, SECONDS_PER_HOUR, dayOf } from "../time/game-clock";
import { type MicroEventKind, MICRO_EVENT_REWARD } from "./encounters";

/*
 * The street's crimes in progress (ADR-0091 §3, stage 5): every 4 game hours a board of 1–2 crimes
 * per district, drawn from the seed and the slot (the simulation's `crimeBoard`), with a marker on
 * the map. Tessen, the game's police (§3a), pays for one foiled; the first 6 of a game day pay in
 * full, the rest a quarter, so waiting out the board earns little. The save keeps the slot, the
 * crimes done in it, the day's count and the one the player follows.
 */

/** Game hours of one board. */
export const STREET_CRIME_SLOT_HOURS = 4;

/** Crimes of a game day paid in full; past them each pays `LATE_SHARE`. */
export const DAILY_FULL_REWARDS = 6;
export const LATE_SHARE = 0.25;

/** Tessen does not pay a player it holds at or below this (§3a: the police pays nobody wanted). */
export const TESSEN_PAYS_ABOVE = -50;

/** Standing with Tessen for each crime foiled. */
export const TESSEN_FOIL_STANDING = 3;

export interface StreetCrimeLog {
  /** The board the log is of. */
  readonly slot: number;
  /** Crimes of this board over (foiled, failed): they do not come back before the next. */
  readonly done: readonly string[];
  /** The game day of `paidToday`. */
  readonly day: number;
  readonly paidToday: number;
  /** The crime the map follows, or none. */
  readonly tracked: string | null;
}

export const crimeSlot = (clock: GameClock): number => Math.floor(clock.seconds / (STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR));

export const streetCrimesAt = (clock: GameClock): StreetCrimeLog => ({ slot: crimeSlot(clock), done: [], day: dayOf(clock), paidToday: 0, tracked: null });

/** The log at `clock`: a new board forgets the old one's done and its follow; a new day its count. */
export const advanceStreetCrimes = (log: StreetCrimeLog, clock: GameClock): StreetCrimeLog => {
  const slot = crimeSlot(clock);
  const day = dayOf(clock);
  if (slot === log.slot && day === log.day) return log;
  return { ...log, ...(slot === log.slot ? {} : { slot, done: [], tracked: null }), ...(day === log.day ? {} : { day, paidToday: 0 }) };
};

/** What a foiled crime pays: its kind's stake grown with the district's level, the day's late share, nothing from Tessen to the wanted. */
export const streetCrimePay = (kind: MicroEventKind, level: number, paidToday: number, tessen: number): number => {
  if (tessen <= TESSEN_PAYS_ABOVE) return 0;
  const full = Math.round(MICRO_EVENT_REWARD[kind].eddies * (1 + 0.1 * (Math.max(1, level) - 1)));
  return paidToday < DAILY_FULL_REWARDS ? full : Math.round(full * LATE_SHARE);
};

/** The log once `id` is over, paid (`paid`) or not. */
export const closeStreetCrime = (log: StreetCrimeLog, id: string, paid: boolean): StreetCrimeLog => ({
  ...log,
  done: log.done.includes(id) ? log.done : [...log.done, id].sort(),
  paidToday: log.paidToday + (paid ? 1 : 0),
  tracked: log.tracked === id ? null : log.tracked,
});
