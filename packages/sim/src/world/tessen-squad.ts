import { type DomainState, type GameClock, SECONDS_PER_HOUR, TESSEN_HUNT, gameDayOf, secondOfDay, tessenHuntActive, tessenSquadDue } from "@seki/core";
import type { World } from "miniplex";
import { SIM_HZ } from "../step-rate";
import type { Entity } from "./components";

/**
 * A squad of Tessen's hunt gone back from where no way led to her (G-922): it comes in where one
 * does, with no new warning, as the one on its way (it was, and she was told). A flag, so a load
 * keeps it waiting: `<size>@<day>:<stretch>`, the stretch of the day it went back in; a save from
 * before the stretch was kept has the size alone. Past its stretch it is gone, and the next roll
 * warns her (G-934; one with no stretch is of one past).
 */
export const TESSEN_SQUAD_BACK_PREFIX = "tessen-hunt-back:";

/** The stretch of the day the hunt rolls by, `<day>:<stretch>`, as in the roll's flag (6 game hours each). */
export const tessenHuntStretch = (clock: GameClock): string =>
  `${gameDayOf(clock)}:${Math.floor(secondOfDay(clock) / (TESSEN_HUNT.everyHours * SECONDS_PER_HOUR))}`;

/** The flag of a squad of `size` gone back at `clock`. */
export const tessenSquadBackFlag = (size: number, clock: GameClock): string => `${TESSEN_SQUAD_BACK_PREFIX}${size}@${tessenHuntStretch(clock)}`;

/** The squad gone back, from the flags, with the stretch it went back in (null in a flag from before it was kept); null without one. */
export const tessenSquadBack = (flags: readonly string[]): { flag: string; size: number; stretch: string | null } | null => {
  const flag = flags.find((f) => f.startsWith(TESSEN_SQUAD_BACK_PREFIX));
  if (!flag) return null;
  const [size = "", stretch] = flag.slice(TESSEN_SQUAD_BACK_PREFIX.length).split("@");
  return { flag, size: Number(size), stretch: stretch ?? null };
};

/** A squad of the hunt still on its feet in the world? */
export const tessenSquadOut = (world: World<Entity>): boolean =>
  world.with("security").entities.some((e) => !!e.ai && !e.downed && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);

/**
 * How long past its tick a squad on its way still counts as coming, in seconds (round 3 of 17.11):
 * the hunt's shortest warning, `TESSEN_HUNT.delayMinSeconds` (20 s). With an entry where she is it
 * comes in on the first look for one at its tick (once a second); later, none was there (the
 * clinic's 60 m, her view, no way to her) and its flag waits for one. The lateness lets such a
 * moment pass (she steps out of an entry's view) as long again as the shortest warning she gets,
 * and not more: in the clinic, with no entry for good, she may wait from 20 s past its tick, and
 * the squad is gone then (G-934), so it never comes in long after her warning.
 */
export const TESSEN_SQUAD_LATE_SECONDS = TESSEN_HUNT.delayMinSeconds;

/** Is the squad on its way still coming at `tick`: to its tick and the lateness past it? False without one. */
export const tessenSquadComing = (flags: readonly string[], tick: number): boolean => {
  const due = tessenSquadDue(flags);
  return due !== null && tick < due.tick + TESSEN_SQUAD_LATE_SECONDS * SIM_HZ;
};

/**
 * Is a squad of Tessen's hunt after her (ADR-0082, after the playtest of 17.11) at the step `tick`?
 * On its way to its tick and the lateness past it (round 3: one that has no way in where she is
 * does not keep her from waiting for good), or in the city on its feet; gone back to wait for her
 * where a way leads (G-922) only in the stretch of the day it went back in (round 2): past it she
 * may wait. Waiting is refused then: she does not sit the hours out with a squad on her trail. Over
 * with the hunt.
 */
export const tessenSquadAfterHer = (world: World<Entity>, domain: Pick<DomainState, "flags" | "clock">, tick: number): boolean => {
  if (!tessenHuntActive(domain.flags, domain.clock)) return false;
  const back = tessenSquadBack(domain.flags);
  return tessenSquadComing(domain.flags, tick) || back?.stretch === tessenHuntStretch(domain.clock) || tessenSquadOut(world);
};

/**
 * How many times a district's roll is tried in a stretch of the day (G-937). A squad on its way
 * that is gone with no entry it might come in at (G-934) leaves its roll, and the next try puts
 * another on its way, with its own warning, once an entry is there: a warning is not all the hunt
 * is (the user's decision of 17.11). Where none is (the clinic) no try comes. A left try takes
 * 40-60 s (a warning of 20-40 s and 20 s of lateness), so three take 3 min at most, half of the
 * stretch's 6 game hours (6 min): three warnings in it at most when she keeps stepping out of the
 * clinic and back in, against 9 with no bound; with two, a second glance at the only entry near
 * left the hunt empty again to the stretch's end.
 */
export const TESSEN_HUNT_TRIES = 3;

/** The roll `key` (`tessenHuntRollFlag`) on its try `n` from 0: the first is the key alone, as in a save of v44, so its draw stays. */
export const tessenHuntTryFlag = (key: string, n: number): string => (n === 0 ? key : `${key}#${n}`);

/** Is the flag of a roll that of a try left (G-937)? */
export const isTessenHuntLeftFlag = (flag: string): boolean => flag.includes("~");

/** A try of a roll, left with no squad come in: `<key>~<tries spent>`. */
export const tessenHuntLeftFlag = (flag: string): string => {
  const [key = flag, n = "0"] = flag.split("#");
  return `${key}~${Number(n) + 1}`;
};

/** The tries of the roll `key` from the flags: how many were spent and whether the last was left; null if it was not rolled. */
export const tessenHuntTries = (flags: readonly string[], key: string): { spent: number; left: boolean } | null => {
  for (const f of flags) {
    if (f === key) return { spent: 1, left: false };
    if (f.startsWith(`${key}#`)) return { spent: Number(f.slice(key.length + 1)) + 1, left: false };
    if (f.startsWith(`${key}~`)) return { spent: Number(f.slice(key.length + 1)), left: true };
  }
  return null;
};
