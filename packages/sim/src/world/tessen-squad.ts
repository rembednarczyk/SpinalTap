import { type DomainState, tessenHuntActive, tessenSquadDue } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";

/**
 * A squad of Tessen's hunt gone back from where no way led to her (G-922): it comes in where one
 * does, with no new warning, as the one on its way (it was, and she was told). A flag, so a load
 * keeps it waiting.
 */
export const TESSEN_SQUAD_BACK_PREFIX = "tessen-hunt-back:";

/** The squad gone back, from the flags; null without one. */
export const tessenSquadBack = (flags: readonly string[]): { flag: string; size: number } | null => {
  const flag = flags.find((f) => f.startsWith(TESSEN_SQUAD_BACK_PREFIX));
  return flag ? { flag, size: Number(flag.slice(TESSEN_SQUAD_BACK_PREFIX.length)) } : null;
};

/** A squad of the hunt still on its feet in the world? */
export const tessenSquadOut = (world: World<Entity>): boolean =>
  world.with("security").entities.some((e) => !!e.ai && !e.downed && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);

/**
 * Is a squad of Tessen's hunt after her (ADR-0082, after the playtest of 17.11)? On its way, gone
 * back to wait for her where a way leads (G-922), or in the city on its feet. Waiting is refused
 * then: she does not sit the hours out with a squad on her trail. Over with the hunt.
 */
export const tessenSquadAfterHer = (world: World<Entity>, domain: Pick<DomainState, "flags" | "clock">): boolean =>
  tessenHuntActive(domain.flags, domain.clock) && (tessenSquadDue(domain.flags) !== null || tessenSquadBack(domain.flags) !== null || tessenSquadOut(world));
