import type { Vec3 } from "@seki/core";
import type { Rect } from "../builders";
import { type Box, EAST, HALL, HALL_INNER, NORTH, type Piece, SOUTH, WEST, box, onFloor, piece } from "./plan";

/**
 * The twelve units of the food hall (ADR-0074 §3): 5 × 6 m or so along its walls, round the shared
 * tables in the middle. Five have their keepers of the game: Kenta and Goro either side of the way
 * in from T1, Fumiko's ramen bar in the north-west corner with its counter through the front onto
 * T1 and a door of its own (it works when the hall is shut), Oyaji's shop in the north-east corner
 * behind an armoured counter, with a back room and a second way out onto T1, and Sachiko's kiosk by
 * the back door to the stairs. The other seven are kitchens of the real plan's list (S13), three
 * with their shutters down. Their signs are proper names, drawn without words.
 */

/** Which side of a unit is its counter, open to its customers. */
export type UnitOpen = "n" | "s" | "e" | "w";

export interface UnitDef {
  readonly id: string;
  /** The keeper's key, for the units of the game's people. */
  readonly keeper?: "kenta" | "fumiko" | "sachiko" | "goro" | "oyaji";
  /** Its kitchen (the real plan's list, S13): the sign's colour in the engine. */
  readonly cuisine: string;
  readonly rect: Rect;
  readonly open: UnitOpen;
  /** Its shutter is down: no counter, no way in. */
  readonly shut?: true;
}

const r = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ });
const I = HALL_INNER;
/** The front row's depth from the front wall, Oyaji's deeper one. */
const FRONT = I.maxZ - 6;
const OYAJI_FRONT = I.maxZ - 8;

export const ALCHEMIA_UNITS: readonly UnitDef[] = [
  { id: "fumiko", keeper: "fumiko", cuisine: "ramen", rect: r(I.minX, 407, FRONT, HALL.maxZ), open: "n" },
  { id: "kenta", keeper: "kenta", cuisine: "okonomiyaki", rect: r(407, 413, FRONT, I.maxZ), open: "s" },
  { id: "goro", keeper: "goro", cuisine: "umbrellas-tea", rect: r(419, 425, FRONT, I.maxZ), open: "s" },
  { id: "cafe", cuisine: "coffee", rect: r(425, 429.6, FRONT, I.maxZ), open: "s" },
  { id: "oyaji", keeper: "oyaji", cuisine: "arms", rect: r(429.6, I.maxX, OYAJI_FRONT, I.maxZ), open: "s" },
  { id: "thai", cuisine: "thai", rect: r(I.minX, 406.4, 38.8, 44.6), open: "e" },
  { id: "korean", cuisine: "korean", rect: r(I.minX, 406.4, 44.6, FRONT), open: "e", shut: true },
  { id: "greek", cuisine: "greek", rect: r(429.6, I.maxX, 36, 42.8), open: "w" },
  // Short of Oyaji's counter: his customers stand in the aisle before it.
  { id: "georgian", cuisine: "georgian", rect: r(429.6, I.maxX, 42.8, OYAJI_FRONT - 3), open: "w", shut: true },
  { id: "wok", cuisine: "wok", rect: r(415.2, 421.6, I.minZ, 38.4), open: "n" },
  { id: "burger", cuisine: "burger", rect: r(421.6, 428.2, I.minZ, 38.4), open: "n", shut: true },
  { id: "sachiko", keeper: "sachiko", cuisine: "kiosk", rect: r(404.4, 407.7, 34.8, 37.4), open: "n" },
];

const PARTITION = 0.15;
const COUNTER_DEPTH = 0.8;
const COUNTER = 1.0;
/** Oyaji's counter is armoured and higher, his grille over it up to this much over the floor. */
const ARMOURED = 1.1;
const GRILLE = 2.6;
/** The kiosk's own roof, under the hall's ceiling. */
const KIOSK_ROOF = 2.4;
/** A shutter comes down to the floor across the open side, this high. */
const SHUTTER = 3.0;
/** Where a keeper stands in from the open side, a customer out of it. */
const KEEPER_IN = 1.3;
const CUSTOMER_OUT = 0.9;

const unit = (id: string): UnitDef => {
  const u = ALCHEMIA_UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};

/** The way a unit's counter faces, out to its customers. */
export const OPEN_YAW: Readonly<Record<UnitOpen, number>> = { n: NORTH, s: SOUTH, e: EAST, w: WEST };

/** A point `out` metres out of a unit's open side (in when negative), `across` from its middle along it. */
export const atUnit = (id: string, out: number, across = 0, up = 0): Vec3 => {
  const { rect: q, open } = unit(id);
  const mx = (q.minX + q.maxX) / 2 + across;
  const mz = (q.minZ + q.maxZ) / 2 + across;
  if (open === "n") return onFloor(mx, q.maxZ + out, up);
  if (open === "s") return onFloor(mx, q.minZ - out, up);
  if (open === "e") return onFloor(q.maxX + out, mz, up);
  return onFloor(q.minX - out, mz, up);
};

/** Where each keeper stands behind the counter, and which way he or she faces (out of the unit). */
export const KEEPER_SPOTS = {
  kenta: atUnit("kenta", -KEEPER_IN),
  fumiko: atUnit("fumiko", -KEEPER_IN),
  sachiko: atUnit("sachiko", -KEEPER_IN),
  goro: atUnit("goro", -KEEPER_IN),
  oyaji: atUnit("oyaji", -KEEPER_IN),
} as const;

export type KeeperKey = keyof typeof KEEPER_SPOTS;

export const KEEPER_YAW: Readonly<Record<KeeperKey, number>> = {
  kenta: OPEN_YAW.s,
  fumiko: OPEN_YAW.n,
  sachiko: OPEN_YAW.n,
  goro: OPEN_YAW.s,
  oyaji: OPEN_YAW.s,
};

/** Where a customer stands before a keeper's counter: `out` metres out of the open side, facing in. */
export const beforeKeeper = (key: KeeperKey, out = CUSTOMER_OUT, across = 0): Vec3 => atUnit(key, out, across);

/** The counter along a unit's open side, inside it. */
const counterBox = (u: UnitDef, top: number): Box => {
  const q = u.rect;
  const y0 = HALL.floor - 0.05;
  const y1 = HALL.floor + top;
  if (u.open === "n") return box(q.minX + 0.6, q.maxX - (u.id === "fumiko" ? 1.4 : 0.6), q.maxZ - COUNTER_DEPTH, q.maxZ, y0, y1);
  if (u.open === "s") return box(q.minX + 0.6, q.maxX - 0.6, q.minZ, q.minZ + COUNTER_DEPTH, y0, y1);
  if (u.open === "e") return box(q.maxX - COUNTER_DEPTH, q.maxX, q.minZ + 0.6, q.maxZ - 0.6, y0, y1);
  return box(q.minX, q.minX + COUNTER_DEPTH, q.minZ + 0.6, q.maxZ - 0.6, y0, y1);
};

/** A shutter across the open side, down to the floor. */
const shutterBox = (u: UnitDef): Box => {
  const q = u.rect;
  const [y0, y1] = [HALL.floor - 0.05, HALL.floor + SHUTTER];
  if (u.open === "n") return box(q.minX, q.maxX, q.maxZ - 0.1, q.maxZ, y0, y1);
  if (u.open === "s") return box(q.minX, q.maxX, q.minZ, q.minZ + 0.1, y0, y1);
  if (u.open === "e") return box(q.maxX - 0.1, q.maxX, q.minZ, q.maxZ, y0, y1);
  return box(q.minX, q.minX + 0.1, q.minZ, q.maxZ, y0, y1);
};

/** The partitions on a unit's sides but its open one and those on the hall's walls, up to `top` over the floor. */
const partitions = (u: UnitDef, top: number): Box[] => {
  const q = u.rect;
  const [y0, y1] = [HALL.floor - 0.05, HALL.floor + top];
  const out: Box[] = [];
  if (u.open !== "w" && q.minX > I.minX + 1e-6) out.push(box(q.minX, q.minX + PARTITION, q.minZ, q.maxZ, y0, y1));
  if (u.open !== "e" && q.maxX < I.maxX - 1e-6) out.push(box(q.maxX - PARTITION, q.maxX, q.minZ, q.maxZ, y0, y1));
  if (u.open !== "s" && q.minZ > I.minZ + 1e-6) out.push(box(q.minX, q.maxX, q.minZ, q.minZ + PARTITION, y0, y1));
  if (u.open !== "n" && q.maxZ < I.maxZ - 1e-6) out.push(box(q.minX, q.maxX, q.maxZ - PARTITION, q.maxZ, y0, y1));
  return out;
};

const CEILING = HALL.ceiling - HALL.floor;

/**
 * Oyaji's back room behind his shop (ADR-0074 §3): a partition across it with a door at its east
 * end; its way out onto T1 is a door in the front wall (`FRONT_OPENINGS`).
 */
const OYAJI_BACK_Z = OYAJI_FRONT + 4;
export const OYAJI_BACK_DOOR = { minX: I.maxX - 1.4, maxX: I.maxX - 0.2 } as const;
const oyajiBack = (): Box[] => {
  const q = unit("oyaji").rect;
  const [y0, y1] = [HALL.floor - 0.05, HALL.ceiling];
  return [box(q.minX, OYAJI_BACK_DOOR.minX, OYAJI_BACK_Z, OYAJI_BACK_Z + PARTITION, y0, y1), box(OYAJI_BACK_DOOR.maxX, q.maxX, OYAJI_BACK_Z, OYAJI_BACK_Z + PARTITION, y0, y1)];
};

/** Every piece of the units: partitions, counters, Oyaji's grille and back room, the kiosk's roof, the shutters. */
export const unitPieces = (): Piece[] =>
  ALCHEMIA_UNITS.flatMap((u): Piece[] => {
    const kiosk = u.id === "sachiko";
    const walls = partitions(u, kiosk ? KIOSK_ROOF : CEILING).map((b) => piece(b, "partition", true));
    if (u.shut) return [...walls, piece(shutterBox(u), "shutter", true)];
    const armoured = u.id === "oyaji";
    const counter = counterBox(u, armoured ? ARMOURED : COUNTER);
    const extra: Piece[] = [];
    if (armoured) {
      extra.push(piece({ ...counter, y0: counter.y1, y1: HALL.floor + GRILLE }, "grille", true, false), ...oyajiBack().map((b) => piece(b, "partition", true)));
    }
    if (kiosk) extra.push(piece(box(u.rect.minX, u.rect.maxX, u.rect.minZ, u.rect.maxZ, HALL.floor + KIOSK_ROOF, HALL.floor + KIOSK_ROOF + 0.12), "roof", true));
    // Fumiko's counter stands in the front wall's opening, part of the front: drawn as the inside's.
    return [...walls, piece(counter, "counter", true), ...extra];
  });

/** Oyaji's back room, between the partition and the front wall: where he sits out the night by its door. */
export const OYAJI_BACK_ROOM: Rect = { minX: unit("oyaji").rect.minX, maxX: I.maxX, minZ: OYAJI_BACK_Z + PARTITION, maxZ: I.maxZ };
