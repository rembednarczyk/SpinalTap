import { KAGAMI_CLEANER_KEYS } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * v29 -> v30 (ADR-0063 stage 6): the market on Aleja Tysiąclecia is gone (its stalls, hall, viaduct
 * and roofs) and its people stand in Alchemia on Plac Ofiar Getta. Spelled out, like every
 * migration: the content of its time.
 */

/** Where the market stood, a few metres round its walls (world metres, ADR-0045). */
export const OLD_MARKET_AREA = { minX: 752, maxX: 818, minZ: 313, maxZ: 379 } as const;

/**
 * Where a save made in the old market wakes: on the avenue where its square was, on the ground
 * (the map's terrain there, -20.5 m, and a few centimetres to land on), in its chunk.
 */
export const OLD_MARKET_WAKE = { x: 785, y: -20.45, z: 350, chunk: "podzamcze-1-0" } as const;

/** The market's stashes in Alchemia (`TARG_ROOF_STASH` on the roof terrace, `TARG_OVERPASS_STASH` behind the ruin). */
export const MOVED_STASHES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly z: number; readonly chunk: string }>> = {
  "stash:targ-roof": { x: 422.2175, y: 7.0863, z: 45.5725, chunk: "krakowskie-2-1" },
  "stash:targ-overpass": { x: 452.7804, y: -8.863, z: 111.822, chunk: "krakowskie-2-1" },
};

/** The market's people, wherever a save has them: they come back at their places in Alchemia. */
export const MOVED_PEOPLE: readonly string[] = ["oyaji", "hana", "sachiko", "kenta", "fumiko", "goro", "ren", "kurosawa", "hebi-lookout", ...KAGAMI_CLEANER_KEYS];

const inOldMarket = (p: unknown): boolean =>
  isObject(p) &&
  typeof p.x === "number" &&
  typeof p.z === "number" &&
  p.x >= OLD_MARKET_AREA.minX &&
  p.x <= OLD_MARKET_AREA.maxX &&
  p.z >= OLD_MARKET_AREA.minZ &&
  p.z <= OLD_MARKET_AREA.maxZ;

/** An entity's saved state: the player woken on the avenue, the rest of the market's dropped (they spawn anew). */
const movedEntities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [inOldMarket(e.position) ? { ...e, position: { x: OLD_MARKET_WAKE.x, y: OLD_MARKET_WAKE.y, z: OLD_MARKET_WAKE.z } } : e];
    return typeof e.key === "string" && MOVED_PEOPLE.includes(e.key) ? [] : inOldMarket(e.position) ? [] : [e];
  });

/** The loot: the stashes moved with the market, other bags left in it put by the wake point. */
const movedLoot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => {
    if (!isObject(c)) return c;
    const stash = typeof c.key === "string" ? MOVED_STASHES[c.key] : undefined;
    if (stash) return { ...c, position: { x: stash.x, y: stash.y, z: stash.z }, chunk: stash.chunk };
    return inOldMarket(c.position) ? { ...c, position: { x: OLD_MARKET_WAKE.x, y: OLD_MARKET_WAKE.y, z: OLD_MARKET_WAKE.z }, chunk: OLD_MARKET_WAKE.chunk } : c;
  });
  return { ...loot, containers };
};

/** Somebody kept outside the content (the heat's reinforcements, a mugging's bodies) left in the old market: gone with it. */
const keptOutside = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && inOldMarket(p.state.position))) : list);

export const moveMarketToAlchemia = (old: Json): Json => {
  const out: Json = { ...old, version: 30 };
  if (Array.isArray(old.entities)) out.entities = movedEntities(old.entities);
  if (isObject(old.domain)) out.domain = { ...old.domain, loot: movedLoot(old.domain.loot) };
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOutside(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOutside(old.strayBodies);
  return out;
};
