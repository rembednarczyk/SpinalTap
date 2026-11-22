import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { W3_Y } from "./site";

/*
 * Tessen's pass office's detail after its card (`docs/pomieszczenia/tessen-office.md`, ADR-0098): the
 * models Blender builds (`tools/blender/rooms/tessen_office.py`) where the office's solids stand
 * (`office()` of `tower-pipes.ts`, drawn no more): the guard's desk along the west wall facing east, the
 * filing cabinets and the cards' locker along the north wall, the bench by the door; the cork board on
 * the south wall and the ceiling's lights, drawn only. A model's front (+z) faces the world's +z at
 * yaw 0, +x at π/2, -x at -π/2, -z at π. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: W3_Y + y, z, yaw, variant: roomDetailShape(key) });

/** The office's ceiling over its floor (`OFFICE_TOP` of `tower-pipes.ts`) and the south wall's inner face. */
const CEILING = 4;
const SOUTH_WALL = 436.3;

export const TESSEN_OFFICE_DETAIL: readonly StreetPropItem[] = [
  item("rd-tessen-desk", 2487.2, 0, 441, Math.PI / 2),
  item("rd-tessen-cabinet", 2490, 0, 445.1, Math.PI),
  item("rd-tessen-bench", 2494.9, 0, 438.2, -Math.PI / 2),
  item("rd-tessen-board", 2490.5, 1.3, SOUTH_WALL + 0.025, 0),
  item("rd-tessen-lights", 2491, CEILING - 0.005, 441, 0),
  // ADR-0099 batch 2: the chair pushed back from the desk and turned as its user left it, the shredder at the desk's north
  // end, binders on the filing cabinet's top.
  item("rd-k-office-chair", 2488.25, 0, 441.2, -Math.PI / 2 + 0.35),
  item("rd-k-shredder", 2486.73, 0, 443.2, Math.PI / 2),
  item("rd-k-binders", 2490.3, 1.8, 445.1, Math.PI),
];
