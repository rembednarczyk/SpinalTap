import { SECONDS_PER_HOUR, dayOf, formatClock } from "@seki/core";

/** The hours the window offers: one to a whole day, an hour by default. */
export const WAIT_MIN_HOURS = 1;
export const WAIT_MAX_HOURS = 24;
export const WAIT_DEFAULT_HOURS = 1;

/** Whole hours in the window's range; anything else (NaN, a fraction) is rounded and clamped. */
export const clampWaitHours = (hours: number): number =>
  Number.isFinite(hours) ? Math.min(WAIT_MAX_HOURS, Math.max(WAIT_MIN_HOURS, Math.round(hours))) : WAIT_DEFAULT_HOURS;

/** A game time as the window shows it: "HH:MM" and the day. */
export const clockAt = (seconds: number): { readonly time: string; readonly day: number } => {
  const clock = { seconds };
  return { time: formatClock(clock), day: dayOf(clock) };
};

/** The game time `hours` (whole, 1 to 24) after `clockSeconds`, past midnight onto the next day. */
export const waitEnd = (clockSeconds: number, hours: number): { readonly time: string; readonly day: number } =>
  clockAt(clockSeconds + clampWaitHours(hours) * SECONDS_PER_HOUR);
