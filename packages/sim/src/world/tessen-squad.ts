import { type DomainState, type GameClock, SECONDS_PER_HOUR, TESSEN_HUNT, gameDayOf, secondOfDay, tessenHuntActive, tessenSquadDue } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";

/**
 * A squad of Tessen's hunt gone back from where no way led to her (G-922): it comes in where one
 * does, with no new warning, as the one on its way (it was, and she was told). A flag, so a load
 * keeps it waiting: `<size>@<day>:<stretch>`, the stretch of the day it went back in; a save from
 * before the stretch was kept has the size alone.
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
 * Is a squad of Tessen's hunt after her (ADR-0082, after the playtest of 17.11)? On its way, or in
 * the city on its feet; gone back to wait for her where a way leads (G-922) only in the stretch of
 * the day it went back in (the user's decision of 17.11, round 2): past it she may wait. Waiting is
 * refused then: she does not sit the hours out with a squad on her trail. Over with the hunt.
 */
export const tessenSquadAfterHer = (world: World<Entity>, domain: Pick<DomainState, "flags" | "clock">): boolean => {
  if (!tessenHuntActive(domain.flags, domain.clock)) return false;
  const back = tessenSquadBack(domain.flags);
  return tessenSquadDue(domain.flags) !== null || back?.stretch === tessenHuntStretch(domain.clock) || tessenSquadOut(world);
};
