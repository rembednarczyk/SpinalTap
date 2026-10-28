import { isMetroStationId } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringList = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === "string");

const MODIFIERS = ["night_only", "time_limit", "bodyguards", "ambush", "twin"];
const SECURITY = ["light", "standard", "lockdown"];
const TRAITS = ["paranoid", "drinker", "creature_of_habit", "armored"];
const TWISTS = ["wrong_target", "setup"];

/** A metro ride in progress (ADR-0034): two stations and a whole arrival tick. */
export const findMetroError = (m: unknown): string | null => {
  if (!isObject(m)) return "metro";
  const ride = m.ride;
  if (ride === null) return null;
  if (!isObject(ride) || !isMetroStationId(ride.from) || !isMetroStationId(ride.to)) return "metro ride";
  if (!Number.isInteger(ride.arriveTick) || (ride.arriveTick as number) < 0) return "metro ride";
  return null;
};

/** The street encounters played: one-offs by id, nightly ones with the night they played. */
export const findEncountersError = (e: unknown): string | null => {
  if (!isObject(e) || !isStringList(e.used) || !isObject(e.nights)) return "encounters";
  return Object.values(e.nights).every((n) => Number.isInteger(n)) ? null : "encounters";
};

/** The optional wave 2 fields of a contract and its log: the variation and the hooks found. */
export const findContractWave2Error = (contracts: Json): string | null => {
  if (contracts.hooks !== undefined && !isStringList(contracts.hooks)) return "contract hooks";
  const active = contracts.active;
  if (!isObject(active) || active.variation === undefined) return null;
  const v = active.variation;
  if (!isObject(v) || !Array.isArray(v.modifiers) || !v.modifiers.every((m) => typeof m === "string" && MODIFIERS.includes(m))) return "contract variation";
  if (typeof v.security !== "string" || !SECURITY.includes(v.security)) return "contract variation";
  if (v.trait !== undefined && (typeof v.trait !== "string" || !TRAITS.includes(v.trait))) return "contract variation";
  if (v.twist !== undefined && (typeof v.twist !== "string" || !TWISTS.includes(v.twist))) return "contract variation";
  return null;
};
