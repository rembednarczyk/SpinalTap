import type { GroundCut } from "../../world/ground";
import type { Rect } from "../builders";
import { P1_HALL_DOOR } from "./parking";
import { type Box, HALL, HALL_INNER, PARAPET, type Piece, SINK, box, piece } from "./plan";

/**
 * The food hall of Alchemia under the upper terrace (ADR-0074 §1, stage 1): a box of 36 × 26 m dug
 * into the slope between the car park (T0, its green roof) and the square in front of it (T1, its
 * floor), its front of glass onto T1. The ground under its outline is dug to its floor (a
 * `GroundCut`, as under a metro pavilion): no terrain shows inside, and the terrace's ground round
 * it is its walls' earth. Its roof is a slab level with the car park, walked on from there.
 *
 * Its stairs (the stair core by the lift, ADR-0074 §4) rise west along the back wall from the back
 * door by Sachiko's kiosk to a landing level with the roof, under a stair house on the roof whose
 * door opens south onto the car park. The lift beside it is `lift.ts`.
 */

const W = HALL.wall;
const I = HALL_INNER;
const F = HALL.floor;
const C = HALL.ceiling;
const R = HALL.roof;

/** A hole in the front wall: from its west to its east side, from the floor up to `top` over it. */
export interface FrontOpening {
  readonly id: "fumiko-hatch" | "fumiko-door" | "entrance" | "oyaji-door";
  readonly x0: number;
  readonly x1: number;
  readonly top: number;
}

/**
 * The front's openings onto T1: Fumiko's hatch over her counter and her door, the way in (6 m),
 * Oyaji's back door. The rest of the front is glass on a frame (ADR-0071's glass: opaque, the
 * inside's light in it).
 */
export const FRONT_OPENINGS: readonly FrontOpening[] = [
  { id: "fumiko-hatch", x0: 401.0, x1: 405.6, top: 2.4 },
  { id: "fumiko-door", x0: 405.8, x1: 406.8, top: 2.3 },
  { id: "entrance", x0: 413.0, x1: 419.0, top: 3.2 },
  { id: "oyaji-door", x0: 431.0, x1: 432.4, top: 2.3 },
];

export const opening = (id: FrontOpening["id"]): FrontOpening => FRONT_OPENINGS.find((o) => o.id === id)!;

/** The stairs: 26 risers from the floor to the roof, 25 treads going west from `FOOT_X`, then the landing. */
export const STAIR = {
  risers: 26,
  going: 0.28,
  footX: 410.4,
  minZ: I.minZ,
  maxZ: 34.6,
  landingX: I.minX,
} as const;
export const STAIR_RISE = (R - F) / STAIR.risers;
/** The head of the flight: the west end of its last tread, the landing's east edge. */
export const STAIR_HEAD_X = STAIR.footX - (STAIR.risers - 1) * STAIR.going;
/**
 * The flight is open to the hall along its lower nine steps (up to 1.5 m, a drop a body takes): the
 * back door from the hall, by Sachiko's kiosk. Over them the partition shuts the stairs off.
 */
export const BACK_DOOR = { minX: STAIR.footX - 9 * STAIR.going, maxX: 412.3 } as const;

/** The stair house over the upper flight and the landing, its door south onto the car park. */
export const STAIR_HOUSE = { minX: HALL.minX, maxX: 407.8, minZ: HALL.minZ, maxZ: 34.8, height: 2.6, door: { x0: 401.0, x1: 402.6, top: 2.3 } } as const;
/** The roof's hole over the stair and the one over the lift's shaft (`lift.ts`). */
const STAIR_HOLE: Rect = { minX: I.minX, maxX: STAIR_HOUSE.maxX - 0.2, minZ: I.minZ, maxZ: STAIR.maxZ };
export const LIFT_HOLE: Rect = { minX: 412.3, maxX: 414.7, minZ: I.minZ, maxZ: 34.8 };

/** The cut under the hall: its outline dug to its floor. */
export const FOODHALL_CUT: GroundCut = { bounds: { minX: HALL.minX, maxX: HALL.maxX, minZ: HALL.minZ, maxZ: HALL.maxZ }, floor: F };
/**
 * The stairs' own piece of the cut, before the hall's (the first holding a point wins): a body on
 * the flight is on no floor of the hall or of its roof (`heightApart`), so an NPC on it keeps to the
 * level graph's way up or down instead of making for a target a metre or so over or under it
 * straight through the partition (as on a metro pavilion's stairs, G-368).
 */
export const FOODHALL_STAIR_CUT: GroundCut = { bounds: { minX: I.minX, maxX: STAIR.footX, minZ: I.minZ, maxZ: STAIR.maxZ }, floor: F };

/** The hall as an interior of ADR-0061: inside its walls, from the floor to the ceiling. */
export const FOODHALL_ROOM: Rect & { readonly bottom: number; readonly top: number } = { ...I, bottom: F, top: C };

/** The front wall: glass between the openings, a lintel of glass over each up to the ceiling. */
const front = (): Piece[] => {
  const z0 = HALL.maxZ - W;
  const z1 = HALL.maxZ;
  const out: Piece[] = [];
  let x: number = HALL.minX;
  for (const o of [...FRONT_OPENINGS].sort((a, b) => a.x0 - b.x0)) {
    if (o.x0 > x) out.push(piece(box(x, o.x0, z0, z1, F - SINK, C), "glass", false));
    out.push(piece(box(o.x0, o.x1, z0, z1, F + o.top, C), "glass", false));
    x = o.x1;
  }
  out.push(piece(box(x, HALL.maxX, z0, z1, F - SINK, C), "glass", false));
  return out;
};

/** The back and side walls, up to the ceiling; the back one with the door onto P-1 (stage 4) at the stairs' foot. */
const walls = (): Piece[] => [
  piece(box(HALL.minX, P1_HALL_DOOR.x0, HALL.minZ, HALL.minZ + W, F - SINK, C), "wall", false),
  piece(box(P1_HALL_DOOR.x0, P1_HALL_DOOR.x1, HALL.minZ, HALL.minZ + W, F + P1_HALL_DOOR.top, C), "wall", false),
  piece(box(P1_HALL_DOOR.x1, HALL.maxX, HALL.minZ, HALL.minZ + W, F - SINK, C), "wall", false),
  piece(box(HALL.minX, HALL.minX + W, HALL.minZ + W, HALL.maxZ - W, F - SINK, C), "wall", false),
  piece(box(HALL.maxX - W, HALL.maxX, HALL.minZ + W, HALL.maxZ - W, F - SINK, C), "wall", false),
];

/** The roof slab round its two holes, the parapet on its west, north and east edges. */
const roof = (): Piece[] => {
  const s = (x0: number, x1: number, z0: number, z1: number): Piece => piece(box(x0, x1, z0, z1, C, R), "roof", false);
  const top = R + PARAPET;
  return [
    s(HALL.minX, HALL.maxX, LIFT_HOLE.maxZ, HALL.maxZ),
    s(HALL.minX, HALL.maxX, HALL.minZ, I.minZ),
    s(HALL.minX, I.minX, I.minZ, LIFT_HOLE.maxZ),
    s(I.minX, STAIR_HOLE.maxX, STAIR_HOLE.maxZ, LIFT_HOLE.maxZ),
    s(STAIR_HOLE.maxX, LIFT_HOLE.minX, I.minZ, LIFT_HOLE.maxZ),
    s(LIFT_HOLE.maxX, HALL.maxX, I.minZ, LIFT_HOLE.maxZ),
    piece(box(HALL.minX, HALL.minX + 0.25, STAIR_HOUSE.maxZ, HALL.maxZ, R, top), "parapet", false),
    piece(box(HALL.minX + 0.25, HALL.maxX - 0.25, HALL.maxZ - 0.25, HALL.maxZ, R, top), "parapet", false),
    piece(box(HALL.maxX - 0.25, HALL.maxX, HALL.minZ, HALL.maxZ, R, top), "parapet", false),
  ];
};

/** The flight's treads (solid from the floor), the landing, the partition between it and the hall. */
const stairs = (): Piece[] => {
  const out: Piece[] = [];
  for (let k = 1; k < STAIR.risers; k++) {
    const x1 = STAIR.footX - (k - 1) * STAIR.going;
    out.push(piece(box(x1 - STAIR.going, x1, STAIR.minZ, STAIR.maxZ, F - 0.05, F + k * STAIR_RISE), "step", true));
  }
  out.push(piece(box(STAIR.landingX, STAIR_HEAD_X, STAIR.minZ, STAIR.maxZ, F - 0.05, R), "step", true));
  out.push(piece(box(I.minX, BACK_DOOR.minX, STAIR.maxZ, STAIR.maxZ + 0.2, F - 0.05, C), "partition", true));
  return out;
};

/** The stair house on the roof: its walls round the hole, the door in its south one, its roof. */
const stairHouse = (): Piece[] => {
  const h = STAIR_HOUSE;
  const [y0, y1] = [R, R + h.height];
  const d = h.door;
  return [
    piece(box(h.minX, h.minX + W, h.minZ, h.maxZ, y0, y1), "wall", false),
    piece(box(h.minX + W, h.maxX, h.maxZ - 0.2, h.maxZ, y0, y1), "wall", false),
    piece(box(h.maxX - 0.2, h.maxX, h.minZ, h.maxZ - 0.2, y0, y1), "wall", false),
    piece(box(h.minX + W, d.x0, h.minZ, h.minZ + W, y0, y1), "wall", false),
    piece(box(d.x1, h.maxX - 0.2, h.minZ, h.minZ + W, y0, y1), "wall", false),
    piece(box(d.x0, d.x1, h.minZ, h.minZ + W, R + d.top, y1), "wall", false),
    piece(box(h.minX - 0.1, h.maxX + 0.1, h.minZ - 0.1, h.maxZ + 0.1, y1, y1 + 0.15), "roof", false),
  ];
};

/** The hall's shell: walls, front, roof and parapets (drawn from outside), the stairs (inside). */
export const shellPieces = (): Piece[] => [...walls(), ...front(), ...roof(), ...stairHouse(), ...stairs()];

/** The planters of the green roof (T0) along its north parapet: knee high, solid. */
export const ROOF_PLANTERS: readonly Box[] = [404, 412, 422, 430].map((x) => box(x, x + 4, HALL.maxZ - 1.45, HALL.maxZ - 0.25, R, R + 0.5));
