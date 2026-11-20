import { CITY_DISTRICT_IDS, GANG_RULES, isFactionId, isMetroStationId } from "@seki/core";

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

/** The optional wave 2 field of the contract log: the hooks found. */
export const findContractWave2Error = (contracts: Json): string | null =>
  contracts.hooks !== undefined && !isStringList(contracts.hooks) ? "contract hooks" : null;

/** The optional wave 2 field of a contract (ADR-0034): its variation. */
export const findVariationError = (contract: Json): string | null => {
  if (contract.variation === undefined) return null;
  const v = contract.variation;
  if (!isObject(v) || !Array.isArray(v.modifiers) || !v.modifiers.every((m) => typeof m === "string" && MODIFIERS.includes(m))) return "contract variation";
  if (typeof v.security !== "string" || !SECURITY.includes(v.security)) return "contract variation";
  if (v.trait !== undefined && (typeof v.trait !== "string" || !TRAITS.includes(v.trait))) return "contract variation";
  if (v.twist !== undefined && (typeof v.twist !== "string" || !TWISTS.includes(v.twist))) return "contract variation";
  return null;
};

/** The gangs' standings per district (ADR-0091): `<faction>:<district>` keys, a grudge 0..100 and the end of a provocation or null. */
export const findGangStandingsError = (g: unknown): string | null => {
  if (!isObject(g)) return "gang standings";
  for (const [key, s] of Object.entries(g)) {
    const [faction, district, ...rest] = key.split(":");
    if (rest.length > 0 || faction === undefined || !isFactionId(faction) || !(CITY_DISTRICT_IDS as readonly string[]).includes(district ?? "")) return "gang standings";
    if (!isObject(s) || typeof s.grudge !== "number" || !Number.isFinite(s.grudge) || s.grudge < 0 || s.grudge > GANG_RULES.maxGrudge) return "gang standings";
    if (!(s.provokedUntil === null || (typeof s.provokedUntil === "number" && Number.isFinite(s.provokedUntil)))) return "gang standings";
    if (!(s.warnedUntil === undefined || (typeof s.warnedUntil === "number" && Number.isFinite(s.warnedUntil)))) return "gang standings";
  }
  return null;
};

/** The street's crimes (ADR-0091 stage 5): the board's slot, the ids done, the day and its paid count, the followed one. */
export const findStreetCrimesError = (c: unknown): string | null => {
  if (!isObject(c) || !Number.isInteger(c.slot) || !isStringList(c.done) || !Number.isInteger(c.day)) return "street crimes";
  if (!Number.isInteger(c.paidToday) || (c.paidToday as number) < 0) return "street crimes";
  return c.tracked === null || typeof c.tracked === "string" ? null : "street crimes";
};
