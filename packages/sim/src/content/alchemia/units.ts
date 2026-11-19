import type { Vec3 } from "@seki/core";
import type { Rect } from "../builders";
import { type Box, EAST, NORTH, type Piece, SOUTH, WEST, box, piece } from "./plan";
import { MALL_LEVELS, MALL_SLAB } from "./mall-plan";
import { GLASS_IN } from "./shops-plan";

/**
 * The twelve units of the food hall (ADR-0074 §3), on the gallery's P3 round the atrium since
 * ADR-0093 O3 (on the hall's floor, P0, until then). Pattern: the mall's food court on its top floor,
 * the anchor that draws the footfall up through the building: counters in the ring between the
 * gallery and the glass, the seating in the strips before them (`foodhall-seating.ts`). Five have
 * their keepers of the game: Fumiko's ramen bar in the north-west corner (her second place, with the
 * hatch onto T1, stayed on P0: `fumiko-p0.ts`), Kenta and Goro on the north side, Oyaji's shop in
 * the south-east corner behind an armoured counter with a back room, and Sachiko's kiosk on the south
 * side. The other seven are kitchens of the real plan's list (S13), three with their shutters down.
 * Their signs are proper names, drawn without words. Moved with their counters, keepers and crowd,
 * their ids and their keepers' keys as they were (a save names them).
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

/** The food hall's floor (P3) and the underside of the roof's slab over it. */
export const FOODHALL_FLOOR = MALL_LEVELS.p3;
export const FOODHALL_CEILING = MALL_LEVELS.roof - MALL_SLAB;

const r = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ });
/** The ring's outer bounds: the glass's inner faces. */
const G = { minX: GLASS_IN.x0, maxX: GLASS_IN.x1, minZ: GLASS_IN.z0, maxZ: GLASS_IN.z1 } as const;
/** The west and east rows' depth from the glass: their customers and the seating in the rest of the strip, before the gallery. */
const WEST_ROW = 404.4;
const EAST_ROW = 431.6;

/**
 * The units in the ring (19 numbers between the gallery's 3 m round the atrium, x 408-428 and z
 * 37-53, and the glass): three on the west strip and three on the east one, 4.2 m deep, their
 * counters to the seating strip before them; three on the north strip and two on the south one, 4.8
 * m deep, their counters to the gallery; Oyaji's in the south-east corner, his counter west to the
 * strip by the gallery's corner. Kept clear: the cores' corridors, both lifts' lobbies, the
 * escalators' landing and the south seating between the hall's lift and Sachiko's kiosk.
 */
export const ALCHEMIA_UNITS: readonly UnitDef[] = [
  // Her counter from the glass to a flap at its south end: her way out (`schedules.ts`).
  { id: "fumiko", keeper: "fumiko", cuisine: "ramen", rect: r(G.minX, WEST_ROW, 49.0, G.maxZ), open: "e" },
  { id: "kenta", keeper: "kenta", cuisine: "okonomiyaki", rect: r(408, 413.67, 53, G.maxZ), open: "s" },
  { id: "goro", keeper: "goro", cuisine: "umbrellas-tea", rect: r(413.67, 419.33, 53, G.maxZ), open: "s" },
  { id: "cafe", cuisine: "coffee", rect: r(419.33, 425, 53, G.maxZ), open: "s" },
  { id: "oyaji", keeper: "oyaji", cuisine: "arms", rect: r(428, G.maxX, G.minZ, 37), open: "w" },
  { id: "thai", cuisine: "thai", rect: r(G.minX, WEST_ROW, 39.8, 44.4), open: "e" },
  { id: "korean", cuisine: "korean", rect: r(G.minX, WEST_ROW, 44.4, 49.0), open: "e", shut: true },
  { id: "greek", cuisine: "greek", rect: r(EAST_ROW, G.maxX, 37, 41.2), open: "w" },
  { id: "georgian", cuisine: "georgian", rect: r(EAST_ROW, G.maxX, 41.2, 45.4), open: "w", shut: true },
  { id: "wok", cuisine: "wok", rect: r(EAST_ROW, G.maxX, 45.4, 49.4), open: "w" },
  { id: "burger", cuisine: "burger", rect: r(408, 412.2, G.minZ, 37), open: "n", shut: true },
  { id: "sachiko", keeper: "sachiko", cuisine: "kiosk", rect: r(421.4, 425.2, G.minZ, 37), open: "n" },
];

/** A partition's thickness: 0.2 m, as a room's wall, so a crouched, aimed shoulder by it starts its shot inside it (G-275). */
export const UNIT_WALL = 0.2;
const COUNTER_DEPTH = 0.8;
const COUNTER = 1.0;
/** Oyaji's counter is armoured and higher, his grille over it up to this much over the floor. */
const ARMOURED = 1.1;
const GRILLE = 2.6;
/** The kiosk's own roof, under the ceiling. */
const KIOSK_ROOF = 2.4;
/** A shutter comes down to the floor across the open side, this high. */
const SHUTTER = 3.0;
/** Where a keeper stands in from the open side, a customer out of it. */
const KEEPER_IN = 1.3;
const CUSTOMER_OUT = 0.9;
/** Fumiko's flap: the gap at her counter's south end she goes in and out by. */
export const FUMIKO_FLAP = 1.2;

export const unitOf = (id: string): UnitDef => {
  const u = ALCHEMIA_UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};

/** A point on the food hall's floor. */
export const onP3 = (x: number, z: number, up = 0): Vec3 => ({ x, y: FOODHALL_FLOOR + up, z });

/** The way a unit's counter faces, out to its customers. */
export const OPEN_YAW: Readonly<Record<UnitOpen, number>> = { n: NORTH, s: SOUTH, e: EAST, w: WEST };

/** A point `out` metres out of a unit's open side (in when negative), `across` from its middle along it. */
export const atUnit = (id: string, out: number, across = 0, up = 0): Vec3 => {
  const { rect: q, open } = unitOf(id);
  const mx = (q.minX + q.maxX) / 2 + across;
  const mz = (q.minZ + q.maxZ) / 2 + across;
  if (open === "n") return onP3(mx, q.maxZ + out, up);
  if (open === "s") return onP3(mx, q.minZ - out, up);
  if (open === "e") return onP3(q.maxX + out, mz, up);
  return onP3(q.minX - out, mz, up);
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
  fumiko: OPEN_YAW.e,
  sachiko: OPEN_YAW.n,
  goro: OPEN_YAW.s,
  oyaji: OPEN_YAW.w,
};

/** Where a customer stands before a keeper's counter: `out` metres out of the open side, facing in. */
export const beforeKeeper = (key: KeeperKey, out = CUSTOMER_OUT, across = 0): Vec3 => atUnit(key, out, across);

/** The counter along a unit's open side, inside it (Fumiko's from her flap to the glass). */
export const counterBox = (u: UnitDef, top: number): Box => {
  const q = u.rect;
  const y0 = FOODHALL_FLOOR - 0.05;
  const y1 = FOODHALL_FLOOR + top;
  if (u.open === "n") return box(q.minX + 0.6, q.maxX - 0.6, q.maxZ - COUNTER_DEPTH, q.maxZ, y0, y1);
  if (u.open === "s") return box(q.minX + 0.6, q.maxX - 0.6, q.minZ, q.minZ + COUNTER_DEPTH, y0, y1);
  if (u.open === "e") return u.id === "fumiko" ? box(q.maxX - COUNTER_DEPTH, q.maxX, q.minZ + UNIT_WALL + FUMIKO_FLAP, q.maxZ, y0, y1) : box(q.maxX - COUNTER_DEPTH, q.maxX, q.minZ + 0.6, q.maxZ - 0.6, y0, y1);
  return box(q.minX, q.minX + COUNTER_DEPTH, q.minZ + 0.6, q.maxZ - 0.6, y0, y1);
};

/** A shutter across the open side, down to the floor. */
const shutterBox = (u: UnitDef): Box => {
  const q = u.rect;
  const [y0, y1] = [FOODHALL_FLOOR - 0.05, FOODHALL_FLOOR + SHUTTER];
  if (u.open === "n") return box(q.minX, q.maxX, q.maxZ - 0.1, q.maxZ, y0, y1);
  if (u.open === "s") return box(q.minX, q.maxX, q.minZ, q.minZ + 0.1, y0, y1);
  if (u.open === "e") return box(q.maxX - 0.1, q.maxX, q.minZ, q.maxZ, y0, y1);
  return box(q.minX, q.minX + 0.1, q.minZ, q.maxZ, y0, y1);
};

/** The partitions on a unit's sides but its open one and those on the glass, up to `top` over the floor. */
const partitions = (u: UnitDef, top: number): Box[] => {
  const q = u.rect;
  const W = UNIT_WALL;
  const [y0, y1] = [FOODHALL_FLOOR - 0.05, FOODHALL_FLOOR + top];
  const out: Box[] = [];
  if (u.open !== "w" && q.minX > G.minX + 1e-6) out.push(box(q.minX, q.minX + W, q.minZ, q.maxZ, y0, y1));
  if (u.open !== "e" && q.maxX < G.maxX - 1e-6) out.push(box(q.maxX - W, q.maxX, q.minZ, q.maxZ, y0, y1));
  if (u.open !== "s" && q.minZ > G.minZ + 1e-6) out.push(box(q.minX, q.maxX, q.minZ, q.minZ + W, y0, y1));
  if (u.open !== "n" && q.maxZ < G.maxZ - 1e-6) out.push(box(q.minX, q.maxX, q.maxZ - W, q.maxZ, y0, y1));
  return out;
};

const CEILING = FOODHALL_CEILING - FOODHALL_FLOOR;

/**
 * Oyaji's back room behind his shop (ADR-0074 §3): a partition across it with a door at its north
 * end; the glass behind it. His stock is there (`foodhall-kitchens.ts`); he sits out the night behind
 * his grille, by the counter (`schedules.ts`).
 */
const OYAJI_BACK_X = 432.6;
export const OYAJI_BACK_DOOR = { minZ: 35.4, maxZ: 36.6 } as const;
const oyajiBack = (): Box[] => {
  const q = unitOf("oyaji").rect;
  const [y0, y1] = [FOODHALL_FLOOR - 0.05, FOODHALL_CEILING];
  const x0 = OYAJI_BACK_X;
  return [box(x0, x0 + UNIT_WALL, q.minZ, OYAJI_BACK_DOOR.minZ, y0, y1), box(x0, x0 + UNIT_WALL, OYAJI_BACK_DOOR.maxZ, q.maxZ - UNIT_WALL, y0, y1)];
};

/** Oyaji's back room, between the partition and the glass. */
export const OYAJI_BACK_ROOM: Rect = { minX: OYAJI_BACK_X + UNIT_WALL, maxX: G.maxX, minZ: G.minZ, maxZ: unitOf("oyaji").rect.maxZ - UNIT_WALL };

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
      extra.push(piece({ ...counter, y0: counter.y1, y1: FOODHALL_FLOOR + GRILLE }, "grille", true, false), ...oyajiBack().map((b) => piece(b, "partition", true)));
    }
    if (kiosk) extra.push(piece(box(u.rect.minX, u.rect.maxX, u.rect.minZ, u.rect.maxZ, FOODHALL_FLOOR + KIOSK_ROOF, FOODHALL_FLOOR + KIOSK_ROOF + 0.12), "roof", true));
    return [...walls, piece(counter, "counter", true), ...extra];
  });
