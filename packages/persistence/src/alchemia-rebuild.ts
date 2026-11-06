import { MOVED_PEOPLE } from "./market-move";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * v32 -> v33 (ADR-0074 stage 1): Alchemia rebuilt by the investor's plan. The hall of igor.tesV,
 * its five stalls and the lift to its roof with the bridge and the terrace are gone; the food hall
 * is dug into the slope where they stood, the square in front of it levelled (T1) and ramps laid
 * beside it. Spelled out, like every migration: the content of its time.
 */

/** A rectangle of world metres (ADR-0045). */
interface Area {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Where the old Alchemia stood and the ground changed: the new hall with its ramps and T1 in
 * front of it (the old hall, its lift, bridge and terrace among them), and the band of the five
 * stalls along the plot's west fence. The hollow of the Hebi stash by the ruin (x 436..449,
 * z 86..101) is not in them: it stays as it was until stage 2.
 */
export const REBUILT_AREAS: readonly Area[] = [
  { minX: 394, maxX: 446, minZ: 28, maxZ: 80 },
  { minX: 401, maxX: 432, minZ: 54, maxZ: 98 },
];

/** Where a save made in the old Alchemia wakes: on T1 in front of the food hall's way in, a few centimetres over it. */
export const ALCHEMIA_WAKE = { x: 416, y: -6.35, z: 62.5, chunk: "krakowskie-2-1" } as const;

/** The Hebi bag by Ren, from the old roof terrace to the hall's green roof (`TARG_ROOF_STASH`). */
export const REBUILT_STASHES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly z: number; readonly chunk: string }>> = {
  "stash:targ-roof": { x: 420.6, y: -2.2, z: 56.2, chunk: "krakowskie-2-1" },
};

/** Keyed things of the old Alchemia gone with it: its lift's cage, gates and buttons (they are rebuilt from content). */
const GONE_KEYS: readonly string[] = ["alchemia-lift"];

const inRebuilt = (p: unknown): boolean =>
  isObject(p) && typeof p.x === "number" && typeof p.z === "number" && REBUILT_AREAS.some((a) => (p.x as number) >= a.minX && (p.x as number) <= a.maxX && (p.z as number) >= a.minZ && (p.z as number) <= a.maxZ);

const WAKE_AT = { x: ALCHEMIA_WAKE.x, y: ALCHEMIA_WAKE.y, z: ALCHEMIA_WAKE.z };

/** The player woken on T1, the market's people dropped (they come back at their new places), the rest in the rebuilt areas too. */
const rebuiltEntities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [inRebuilt(e.position) ? { ...e, position: WAKE_AT } : e];
    if (typeof e.key === "string" && (MOVED_PEOPLE.includes(e.key) || GONE_KEYS.some((k) => (e.key as string).startsWith(k)))) return [];
    return inRebuilt(e.position) ? [] : [e];
  });

/** The loot: the roof stash moved by Ren, other bags left in the rebuilt areas put down on T1. */
const rebuiltLoot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => {
    if (!isObject(c)) return c;
    const stash = typeof c.key === "string" ? REBUILT_STASHES[c.key] : undefined;
    if (stash) return { ...c, position: { x: stash.x, y: stash.y, z: stash.z }, chunk: stash.chunk };
    return inRebuilt(c.position) ? { ...c, position: WAKE_AT, chunk: ALCHEMIA_WAKE.chunk } : c;
  });
  return { ...loot, containers };
};

/** Somebody kept outside the content (the heat's reinforcements, a mugging's bodies) in the rebuilt areas: gone with them. */
const keptOutside = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && inRebuilt(p.state.position))) : list);

export const rebuildAlchemia = (old: Json): Json => {
  const out: Json = { ...old, version: 33 };
  if (Array.isArray(old.entities)) out.entities = rebuiltEntities(old.entities);
  if (isObject(old.domain)) out.domain = { ...old.domain, loot: rebuiltLoot(old.domain.loot) };
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOutside(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOutside(old.strayBodies);
  return out;
};
