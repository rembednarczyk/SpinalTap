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
 * z 86..101) is not in them: it stays as it was until stage 2 (`levelAlchemiaT2`).
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

/**
 * v33 -> v34 (ADR-0074 stage 2): the lower square T2 levelled before the rebuilt Arkady, where the
 * Hebi hollow was, the ridge west of it cut away. Spelled out, the content of its time.
 */

/**
 * Where the ground changed: from Świętoduska's side of the square (x 422) to the Arkady's east
 * face (the line through (448.5; 81.3) and (466.5; 127.7)), from the hollow's south blend (z 80.5)
 * to the square's north end (z 130). East of the face lies Lubartowska's pavement, as it was.
 */
const PLAZA_AREA = { minX: 422, maxX: 467, minZ: 80.5, maxZ: 130 } as const;
const EAST_FACE = { x: 448.5, z: 81.3, dx: 18, dz: 46.4 } as const;

const onPlaza = (p: unknown): boolean => {
  if (!isObject(p) || typeof p.x !== "number" || typeof p.z !== "number") return false;
  const [x, z] = [p.x, p.z];
  if (x < PLAZA_AREA.minX || x > PLAZA_AREA.maxX || z < PLAZA_AREA.minZ || z > PLAZA_AREA.maxZ) return false;
  // West of the east face: the face's direction crossed with the way to the point is positive.
  return EAST_FACE.dx * (z - EAST_FACE.z) - EAST_FACE.dz * (x - EAST_FACE.x) > 0;
};

/** Where a save made in the old hollow or on its slopes wakes: on T2 before the Arkady's south arches, a few centimetres over it. */
export const PLAZA_WAKE = { x: 440, y: -9.15, z: 104, chunk: "krakowskie-2-1" } as const;

/** The bag of the blockade's night, from behind the ruin to T2 before the Arkady's arches (`TARG_OVERPASS_STASH`). */
export const PLAZA_STASHES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly z: number; readonly chunk: string }>> = {
  "stash:targ-overpass": { x: 452.78, y: -9.0, z: 111.82, chunk: "krakowskie-2-1" },
};

const PLAZA_WAKE_AT = { x: PLAZA_WAKE.x, y: PLAZA_WAKE.y, z: PLAZA_WAKE.z };

/** The player woken on T2, everybody else on the square dropped (the content brings them back: the lookout under the arches). */
const plazaEntities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [onPlaza(e.position) ? { ...e, position: PLAZA_WAKE_AT } : e];
    return onPlaza(e.position) ? [] : [e];
  });

/** The overpass bag by the Arkady, the other bags on the square put down on T2. */
const plazaLoot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => {
    if (!isObject(c)) return c;
    const stash = typeof c.key === "string" ? PLAZA_STASHES[c.key] : undefined;
    if (stash) return { ...c, position: { x: stash.x, y: stash.y, z: stash.z }, chunk: stash.chunk };
    return onPlaza(c.position) ? { ...c, position: PLAZA_WAKE_AT, chunk: PLAZA_WAKE.chunk } : c;
  });
  return { ...loot, containers };
};

/** Somebody kept outside the content (reinforcements, a mugging's bodies) on the square: gone with its old ground. */
const keptOffPlaza = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && onPlaza(p.state.position))) : list);

export const levelAlchemiaT2 = (old: Json): Json => {
  const out: Json = { ...old, version: 34 };
  if (Array.isArray(old.entities)) out.entities = plazaEntities(old.entities);
  if (isObject(old.domain)) out.domain = { ...old.domain, loot: plazaLoot(old.domain.loot) };
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOffPlaza(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOffPlaza(old.strayBodies);
  return out;
};

/**
 * v34 -> v35 (ADR-0074 stage 3): the triangular pavilion raised on the corner of Bajkowskiego and
 * Lubartowska, in the car park's notch, with Ren and the Hebi bag on its roof. Spelled out, the
 * content of its time.
 */

/** The pavilion's footprint: its triangle (on Bajkowskiego, the corner, on Lubartowska) and the back-of-house box on its north-west side. */
const PAVILION_TRIANGLE = [
  { x: 420.5, z: -8.85 },
  { x: 432.3, z: -8.2 },
  { x: 436.2, z: 6.0 },
] as const;
const PAVILION_ANNEX = { minX: 424.5, maxX: 428.5, minZ: -3.5, maxZ: 0 } as const;

const inPavilion = (p: unknown): boolean => {
  if (!isObject(p) || typeof p.x !== "number" || typeof p.z !== "number") return false;
  const [x, z] = [p.x, p.z];
  if (x >= PAVILION_ANNEX.minX && x <= PAVILION_ANNEX.maxX && z >= PAVILION_ANNEX.minZ && z <= PAVILION_ANNEX.maxZ) return true;
  // Counter-clockwise corners: inside is left of every side.
  return PAVILION_TRIANGLE.every((a, i) => {
    const b = PAVILION_TRIANGLE[(i + 1) % 3]!;
    return (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x) >= 0;
  });
};

/** Where a save made on the ground the pavilion now stands on wakes: by the foot of its ladder on the car park, a few centimetres over the ground. */
export const PAVILION_WAKE = { x: 423.5, y: -0.73, z: -1.75, chunk: "krakowskie-2-1" } as const;

/** The Hebi bag by Ren, from the hall's green roof to the pavilion's roof (`TARG_ROOF_STASH`). */
export const PAVILION_STASHES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly z: number; readonly chunk: string }>> = {
  "stash:targ-roof": { x: 431.3, y: 3.85, z: -2.7, chunk: "krakowskie-2-1" },
};

/** Ren's state: he comes back from the content, on the pavilion's roof. */
const PAVILION_MOVED: readonly string[] = ["ren"];

const PAVILION_WAKE_AT = { x: PAVILION_WAKE.x, y: PAVILION_WAKE.y, z: PAVILION_WAKE.z };

/** The player woken by the ladder, Ren and everybody else on the pavilion's ground dropped. */
const pavilionEntities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [inPavilion(e.position) ? { ...e, position: PAVILION_WAKE_AT } : e];
    if (typeof e.key === "string" && PAVILION_MOVED.includes(e.key)) return [];
    return inPavilion(e.position) ? [] : [e];
  });

/** The roof bag onto the pavilion's roof, other bags on its ground put down by the ladder. */
const pavilionLoot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => {
    if (!isObject(c)) return c;
    const stash = typeof c.key === "string" ? PAVILION_STASHES[c.key] : undefined;
    if (stash) return { ...c, position: { x: stash.x, y: stash.y, z: stash.z }, chunk: stash.chunk };
    return inPavilion(c.position) ? { ...c, position: PAVILION_WAKE_AT, chunk: PAVILION_WAKE.chunk } : c;
  });
  return { ...loot, containers };
};

/** Somebody kept outside the content (reinforcements, a mugging's bodies) where the pavilion stands: gone. */
const keptOffPavilion = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && inPavilion(p.state.position))) : list);

export const raiseAlchemiaPavilion = (old: Json): Json => {
  const out: Json = { ...old, version: 35 };
  if (Array.isArray(old.entities)) out.entities = pavilionEntities(old.entities);
  if (isObject(old.domain)) out.domain = { ...old.domain, loot: pavilionLoot(old.domain.loot) };
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOffPavilion(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOffPavilion(old.strayBodies);
  return out;
};
