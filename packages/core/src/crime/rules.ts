import type { Vec3 } from "../math/vec3";
import type { FactionId } from "../reputation/reputation";
import type { EnemyTypeId } from "../items/enemies";
import { type CrimeKind, type HeatLevel, MAX_HEAT } from "./heat";

/**
 * Rules of the crime loop (ADR-0029, on the contracts of ADR-0028). Pure numbers and functions:
 * the simulation decides who saw what, these decide what it costs.
 */

/** The pursuit of the district's security. Saved in the domain state. */
export interface HeatState {
  readonly level: HeatLevel;
  /** Whose security hunts the player (the district's, at the first report); null at 0. */
  readonly faction: FactionId | null;
  /** Contact lost: the security looks around `lastKnown` and `searchLeft` runs down. */
  readonly searching: boolean;
  readonly lastKnown: Vec3 | null;
  /** Seconds of search left before the heat drops a level. */
  readonly searchLeft: number;
  /** Seconds before another report can raise the level again (several witnesses, one incident). */
  readonly cooldown: number;
}

export const NO_HEAT: HeatState = { level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 };

/** The level a fresh report of this crime brings the heat up to. Killing is worse than the rest. */
export const CRIME_HEAT: Readonly<Record<CrimeKind, HeatLevel>> = { trespass: 1, hacking: 1, gunfire: 1, assault: 1, murder: 2 };

/** Seconds of search (no contact) that drop the heat one level, per level. */
export const HEAT_SEARCH_SECONDS: Readonly<Record<HeatLevel, number>> = { 0: 0, 1: 20, 2: 30, 3: 40 };

/** After a report raised the level, further reports wait this long before raising it again. */
export const HEAT_REPORT_COOLDOWN = 8;

/** How many of the security's men come looking at each level (spawned out of sight). */
export const HEAT_REINFORCEMENTS: Readonly<Record<HeatLevel, number>> = { 0: 0, 1: 1, 2: 2, 3: 4 };

/** What the security of each faction sends as reinforcements. */
export const SECURITY_ENEMY: Readonly<Partial<Record<FactionId, EnemyTypeId>>> = { hebi: "hebi_ganger", tessen: "tessen_guard" };

const clampHeat = (n: number): HeatLevel => Math.max(0, Math.min(MAX_HEAT, n)) as HeatLevel;

/**
 * A crime reached the security. A fresh report brings the heat up to the crime's level; with the
 * heat already there, a report raises it one more level, once per `HEAT_REPORT_COOLDOWN`. Either
 * way the security knows where the player was: contact, search reset.
 */
export const reportCrime = (heat: HeatState, crime: CrimeKind, faction: FactionId, at: Vec3): HeatState => {
  const base = CRIME_HEAT[crime];
  const level = heat.level < base ? base : heat.cooldown > 0 ? heat.level : clampHeat(heat.level + 1);
  return {
    level,
    faction: heat.faction ?? faction,
    searching: false,
    lastKnown: at,
    searchLeft: HEAT_SEARCH_SECONDS[level],
    cooldown: level !== heat.level ? HEAT_REPORT_COOLDOWN : heat.cooldown,
  };
};

/** Someone of the hunting security sees the player: contact, the search clock starts over. */
export const heatContact = (heat: HeatState, at: Vec3): HeatState =>
  heat.level === 0 ? heat : { ...heat, searching: false, lastKnown: at, searchLeft: HEAT_SEARCH_SECONDS[heat.level] };

/** Nobody of the security sees the player any more: they look around the last known position. */
export const heatLost = (heat: HeatState): HeatState => (heat.level === 0 || heat.searching ? heat : { ...heat, searching: true });

/**
 * Time passes. While searching the clock runs down; at 0 the heat drops one level and the
 * search goes on at the new level (with its own clock) until the heat is gone.
 */
export const tickHeat = (heat: HeatState, dt: number): HeatState => {
  if (heat.level === 0) return heat;
  const cooldown = Math.max(0, heat.cooldown - dt);
  if (!heat.searching) return cooldown === heat.cooldown ? heat : { ...heat, cooldown };
  const left = heat.searchLeft - dt;
  if (left > 0) return { ...heat, cooldown, searchLeft: left };
  const level = clampHeat(heat.level - 1);
  if (level === 0) return NO_HEAT;
  return { ...heat, level, cooldown, searchLeft: HEAT_SEARCH_SECONDS[level] };
};

// Witnesses and the street (ADR-0029).

/** Seconds a civilian needs to get through to the security. */
export const WITNESS_CALL_SECONDS = 5;
/** A civilian sees what happens up to this far, all round, with nothing solid in between. */
export const CIVILIAN_SIGHT = 22;
/** Aiming a drawn weapon at a civilian this close (and this narrowly) scares them off the phone. */
export const INTIMIDATE_RANGE = 6;
export const INTIMIDATE_CONE = 0.3;
/** Seconds a scared witness stays off the phone. */
export const INTIMIDATED_SECONDS = 25;
