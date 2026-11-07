import type { GroundPoint } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { StaticProp } from "../builders";
import { FOODHALL_CUT, FOODHALL_STAIR_CUT, ROOF_PLANTERS, shellPieces } from "./foodhall";
import { ALCHEMIA_LIFT_MECHANISM, liftPieces } from "./lift";
import { HALL, type Piece, box, piece, solidProp } from "./plan";
import { terracePieces } from "./terraces";
import { unitPieces } from "./units";

export { T0 as ALCHEMIA_T0, T1 as ALCHEMIA_T1, HALL as FOODHALL, HALL_INNER as FOODHALL_INNER, type Box as AlchemiaBox, type Piece as AlchemiaPiece, type PieceKind as AlchemiaPieceKind } from "./plan";
export * from "./foodhall";
export * from "./units";
export * from "./lift";
export * from "./terraces";
export * from "./market";
export { ALCHEMIA_NAV } from "./nav";

/**
 * Alchemia by the investor's plan (ADR-0074), stage 1: the food hall with its units, stairs and
 * lift, its green roof and the terraces round it. Everything is drawn by the engine
 * (`renderer/alchemia`) from `ALCHEMIA_PIECES`; the solid ones are the simulation's scenery, with
 * ids from `ROOM_ID_BASE` (outside the allocator).
 */

/** The shared tables in the middle of the hall, either side of its aisle, with their benches. */
const TABLES: readonly Piece[] = [410.5, 419.5].flatMap((x) =>
  [42, 46].flatMap((z) => [
    piece(box(x, x + 6, z, z + 1, HALL.floor - 0.05, HALL.floor + 0.75), "table", true),
    piece(box(x, x + 6, z - 0.85, z - 0.45, HALL.floor - 0.05, HALL.floor + 0.45), "bench", true),
    piece(box(x, x + 6, z + 1.45, z + 1.85, HALL.floor - 0.05, HALL.floor + 0.45), "bench", true),
  ]),
);

const PLANTERS: readonly Piece[] = ROOF_PLANTERS.map((b) => piece(b, "green", false));

const SHELL = shellPieces();
const UNITS = unitPieces();
const LIFT = liftPieces();

/** Every drawn piece of Alchemia. */
export const ALCHEMIA_PIECES: readonly Piece[] = [...SHELL, ...PLANTERS, ...UNITS, ...TABLES, ...LIFT, ...terracePieces()];

/** Every solid of Alchemia, a prop per part of the building, then the lift's moving parts. */
export const ALCHEMIA_PROPS: readonly StaticProp[] = [
  solidProp(SHELL.filter((p) => p.kind !== "step")),
  solidProp(SHELL.filter((p) => p.kind === "step")),
  solidProp(PLANTERS),
  solidProp(UNITS.filter((p) => p.box.z0 >= HALL.maxZ - 8.5)),
  solidProp(UNITS.filter((p) => p.box.z0 < HALL.maxZ - 8.5)),
  solidProp(TABLES),
  solidProp(LIFT),
  ...ALCHEMIA_LIFT_MECHANISM,
];

/** The ground dug out under Alchemia. */
export const ALCHEMIA_CUTS: readonly GroundCut[] = [FOODHALL_STAIR_CUT, FOODHALL_CUT];

/** The middle of the hall: for streaming and drawing distances. */
export const ALCHEMIA_CENTRE: GroundPoint = { x: (HALL.minX + HALL.maxX) / 2, z: (HALL.minZ + HALL.maxZ) / 2 };
