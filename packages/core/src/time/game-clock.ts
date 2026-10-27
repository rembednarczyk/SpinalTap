/**
 * Game time (plan §6, "Spawn / schedule"): a day clock in whole game seconds, advanced by the
 * simulation one fixed step at a time. Never derived from wall time, so a replay, a load and
 * a headless test all see the same hour at the same tick.
 */

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
export const MINUTES_PER_DAY = 1_440;

/** Game seconds per real second: one real minute is one game hour. */
export const GAME_SECONDS_PER_REAL_SECOND = 60;

/** Game seconds since 00:00 of day 1. */
export interface GameClock {
  readonly seconds: number;
}

/** A new game starts at 21:00 of day 1: Shinsekai at night, as in M0. */
export const START_HOUR = 21;
export const START_CLOCK: GameClock = { seconds: START_HOUR * SECONDS_PER_HOUR };

export const advanceClock = (clock: GameClock, gameSeconds: number): GameClock => ({ seconds: clock.seconds + gameSeconds });

/** Minute of the day for an hour and minute, e.g. `hm(22, 30)` = 1350. */
export const hm = (hour: number, minute = 0): number => hour * 60 + minute;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Seconds since midnight of the current day, 0–86399. */
export const secondOfDay = (clock: GameClock): number => mod(clock.seconds, SECONDS_PER_DAY);

/** Minutes since midnight of the current day, 0–1439. */
export const minuteOfDay = (clock: GameClock): number => Math.floor(secondOfDay(clock) / SECONDS_PER_MINUTE);

export const hourOf = (clock: GameClock): number => Math.floor(secondOfDay(clock) / SECONDS_PER_HOUR);

/** Day number, starting at 1. */
export const dayOf = (clock: GameClock): number => Math.floor(clock.seconds / SECONDS_PER_DAY) + 1;

/** "HH:MM", 24-hour. */
export const formatClock = (clock: GameClock): string => {
  const m = minuteOfDay(clock);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Seconds from minute-of-day `from` forward to the clock's time, wrapping past midnight. */
export const secondsSince = (clock: GameClock, from: number): number => mod(secondOfDay(clock) - from * SECONDS_PER_MINUTE, SECONDS_PER_DAY);

export type DayPhase = "night" | "dawn" | "day" | "dusk";

/** Light curve, as minutes of the day: dawn 05:00–07:00, dusk 18:00–20:00. */
export const DAY_PHASES = { dawn: hm(5), day: hm(7), dusk: hm(18), night: hm(20) } as const;

export const dayPhase = (clock: GameClock): DayPhase => {
  const m = minuteOfDay(clock);
  if (m >= DAY_PHASES.night || m < DAY_PHASES.dawn) return "night";
  if (m < DAY_PHASES.day) return "dawn";
  if (m < DAY_PHASES.dusk) return "day";
  return "dusk";
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * How much daylight there is: 0 at night, 1 by day, eased through dawn and dusk.
 * Exactly 0 for the whole night, so night scenes look as they always did.
 */
export const daylight = (clock: GameClock): number => {
  const s = secondOfDay(clock) / SECONDS_PER_MINUTE;
  const { dawn, day, dusk, night } = DAY_PHASES;
  if (s < dawn || s >= night) return 0;
  if (s < day) return smoothstep((s - dawn) / (day - dawn));
  if (s < dusk) return 1;
  return smoothstep(1 - (s - dusk) / (night - dusk));
};

/** True when minute-of-day `m` falls in [from, to), wrapping past midnight when to < from. */
export const inHours = (m: number, from: number, to: number): boolean => (from <= to ? m >= from && m < to : m >= from || m < to);
