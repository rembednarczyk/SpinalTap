type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * v35 -> v36 (ADR-0074 stage 4): P-1 dug under Alchemia's car park, its ramp from Bajkowskiego in
 * a walled trench and its stair core's house by metro B. The car park over P-1 stays the ground
 * it was, so a save made on it stays where it is; only the trench and the stair house are new
 * ground. Sachiko's counter turned east to the door from P-1. Spelled out, the content of its time.
 */

/** A rectangle of world metres (ADR-0045). */
interface Area {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The ramp's trench with its parapets, and the stair core's house: the ground they took. */
export const PARKING_AREAS: readonly Area[] = [
  { minX: 409.4, maxX: 418.6, minZ: -5.6, maxZ: 12.1 },
  { minX: 418.2, maxX: 421.8, minZ: 12.3, maxZ: 22.7 },
];

/** Where a save made there wakes: on the car park west of the ramp's top, a few centimetres over it. */
export const PARKING_WAKE = { x: 406, y: -1.2, z: -3, chunk: "krakowskie-2-1" } as const;

/** Sachiko's state: she comes back from the content, behind her counter turned to the door. */
const PARKING_MOVED: readonly string[] = ["sachiko"];

const inParking = (p: unknown): boolean =>
  isObject(p) && typeof p.x === "number" && typeof p.z === "number" && PARKING_AREAS.some((a) => (p.x as number) >= a.minX && (p.x as number) <= a.maxX && (p.z as number) >= a.minZ && (p.z as number) <= a.maxZ);

const WAKE_AT = { x: PARKING_WAKE.x, y: PARKING_WAKE.y, z: PARKING_WAKE.z };

/** The player woken on the car park, Sachiko and everybody else on the dug ground dropped. */
const parkingEntities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [inParking(e.position) ? { ...e, position: WAKE_AT } : e];
    if (typeof e.key === "string" && PARKING_MOVED.includes(e.key)) return [];
    return inParking(e.position) ? [] : [e];
  });

/** Bags left on the dug ground put down where the player wakes. */
const parkingLoot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => (isObject(c) && inParking(c.position) ? { ...c, position: WAKE_AT, chunk: PARKING_WAKE.chunk } : c));
  return { ...loot, containers };
};

/** Somebody kept outside the content (reinforcements, a mugging's bodies) on the dug ground: gone. */
const keptOffParking = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && inParking(p.state.position))) : list);

export const digAlchemiaParking = (old: Json): Json => {
  const out: Json = { ...old, version: 36 };
  if (Array.isArray(old.entities)) out.entities = parkingEntities(old.entities);
  if (isObject(old.domain)) out.domain = { ...old.domain, loot: parkingLoot(old.domain.loot) };
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOffParking(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOffParking(old.strayBodies);
  return out;
};
