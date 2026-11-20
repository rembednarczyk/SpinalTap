import { type GameClock, SECONDS_PER_HOUR, dayOf, inHours, minuteOfDay } from "../time/game-clock";
import type { EncounterDef } from "./wave2";

/**
 * Street encounters played so far (ADR-0034). A one-off goes into `used` when it starts and
 * never plays again; a nightly one remembers the night it last played in `nights`.
 */
export interface EncounterLog {
  readonly used: readonly string[];
  readonly nights: Readonly<Record<string, number>>;
}

export const NO_ENCOUNTERS: EncounterLog = { used: [], nights: {} };

/**
 * The night a moment belongs to: the day of its evening. 02:00 of day 3 is still the night of
 * day 2, so an encounter that played at 23:00 does not come back after midnight.
 */
export const nightOf = (clock: GameClock): number => dayOf({ seconds: Math.max(0, clock.seconds - 12 * SECONDS_PER_HOUR) });

/** Is the clock inside the encounter's hours (`toHour` may wrap past midnight)? */
export const encounterHours = (def: EncounterDef, clock: GameClock): boolean => inHours(minuteOfDay(clock), def.fromHour * 60, def.toHour * 60);

/** May the encounter start now: in its hours, and not played already (once, or this night)? */
export const encounterAvailable = (def: EncounterDef, clock: GameClock, log: EncounterLog): boolean => {
  if (!encounterHours(def, clock) || log.used.includes(def.id)) return false;
  return def.once || log.nights[def.id] !== nightOf(clock);
};

/** The log once `def` has started at `clock`. */
export const markEncounter = (log: EncounterLog, def: EncounterDef, clock: GameClock): EncounterLog =>
  def.once ? { ...log, used: [...log.used, def.id].sort() } : { ...log, nights: { ...log.nights, [def.id]: nightOf(clock) } };

/**
 * The street's crimes in progress (ADR-0034, ADR-0091): a single beat at a spot of the street,
 * off the board of every 4 game hours (`street-crimes.ts`). A mugging is a fight (the gang on a
 * passer-by), an aid a short help, the rest of stage 5 the gang round a thing of the street.
 */
export type MicroEventKind = "mugging" | "aid" | "extortion" | "deal" | "droneTheft" | "kidnap";

/**
 * While the street thinks badly of the player (civilians below this, wary or hostile) every
 * district's board holds two crimes instead of one or two: more chances to make it right
 * (ADR-0070, carried onto the board by ADR-0091 stage 5b in place of the entry roll's 25%).
 */
export const MICRO_EVENT_DISTRUST_BELOW = -10;

/** Does the street think badly enough of the player for the fuller board? */
export const streetDistrusts = (civilians: number): boolean => civilians < MICRO_EVENT_DISTRUST_BELOW;

/** What it pays: eddies and standing with the civilians. */
export const MICRO_EVENT_REWARD: Readonly<Record<MicroEventKind, { readonly eddies: number; readonly civilians: number }>> = {
  mugging: { eddies: 70, civilians: 3 },
  aid: { eddies: 25, civilians: 3 },
  // A gang squeezing a stall or a shop (ADR-0091 stage 5): three of them, so more.
  extortion: { eddies: 90, civilians: 3 },
  // ADR-0091 stage 5b: three of the gang dealing by a crate; two thieves at a delivery drone;
  // two kidnappers at a van with their victim.
  deal: { eddies: 110, civilians: 2 },
  droneTheft: { eddies: 80, civilians: 3 },
  kidnap: { eddies: 120, civilians: 4 },
};
