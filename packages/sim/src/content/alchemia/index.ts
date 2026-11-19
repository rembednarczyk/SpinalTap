import type { GroundPoint } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { StaticProp } from "../builders";
import { FOODHALL_CUT, FOODHALL_STAIR_CUT, ROOF_PLANTERS, shellPieces } from "./foodhall";
import { ALCHEMIA_LIFT_MECHANISM, liftPieces } from "./lift";
import { HALL, type Piece, box, piece, solidProp } from "./plan";
import { terracePieces } from "./terraces";
import { ARKADY_PAVEMENT_PROP } from "./arkady";
import { PAVILION_PROPS } from "./pavilion";
import { METRO_DOOR_PIECES, METRO_DOOR_VAULT } from "./metro-door";
import { P1_PIECES, P1_RAMP_CUT, P1_RAMP_PROPS, P1_STAIR_CUT, P1_VAULT } from "./parking";
import { P2_CORRIDOR_SHELL, P2_CUT, P2_CUTTING_PIECES, P2_EARTH_PIECES, P2_STAIR_PIECES, P2_STORE_SHELL, P2_VAULT } from "./p2";
import { P2_ROBOTS, P2_STORE_PIECES, P2_STORE_SOLIDS } from "./p2-store";
import type { GroundVault } from "../../world/vault";
import { plazaPieces } from "./plaza";
import { squarePieces } from "./square";
import { unitPieces } from "./units";
import { tierPieces } from "./tiers";
import { frontPieces } from "./front";

export { T0 as ALCHEMIA_T0, T1 as ALCHEMIA_T1, HALL as FOODHALL, HALL_INNER as FOODHALL_INNER, type Box as AlchemiaBox, type Piece as AlchemiaPiece, type PieceKind as AlchemiaPieceKind } from "./plan";
export * from "./foodhall";
export * from "./units";
export * from "./lift";
export * from "./terraces";
export * from "./arkady";
export { T2 as ALCHEMIA_T2, T2_PADS, T2_RECTS, T2_STAIRS, MEMORIAL as ALCHEMIA_MEMORIAL, onT2 } from "./plaza";
export * from "./market";
export * from "./pavilion";
export * from "./parking";
export * from "./metro-door";
export * from "./p2";
export * from "./p2-store";
export { PARAPET_BEDS } from "./square";
export { COURTYARD, FLIGHT_A, FLIGHT_B, ROOF_LAWNS, TIER_A, TIER_B, TIER_HEDGES, TIER_PLANTERS, landing as tierLanding, onTierRoof, tierPieces } from "./tiers";
export { ALCHEMIA_NAV } from "./nav";
export { EAST_WING, FRONT_FOOTPRINTS, FRONT_SIGN, GREEN_STEPS, L1_TOP, L2_SLABS, L2_TOP, L3, L3_TOP, PASSAGE_COLUMNS, WEST_WING, frontPieces } from "./front";

/**
 * Alchemia by the investor's plan (ADR-0074): the food hall with its units, stairs and lift, its
 * green roof and the terraces round it (stage 1); the lower square T2 with its stairs and the
 * Arkady rebuilt on it (stage 2); the triangular pavilion on the corner with Ren on its roof
 * (stage 3, `pavilion.ts`); P-1 under the car park (stage 4, `parking.ts`) and P-2 under it (stage 5a, `p2.ts`); T0's square with its
 * pergolas, lanterns and beds and the lawns of the green roof (stage 7, `square.ts`). Everything is drawn by the engine
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

const PLAZA = plazaPieces();
const SQUARE = squarePieces();
const TIERS = tierPieces();
const FRONT = frontPieces();
/** The green tiers' pieces (15.11) and the front's storeys over P-1 (B1, 19.11), among `ALCHEMIA_PIECES`: the engine draws them as a building of their own. */
export const ALCHEMIA_TIER_PIECES: readonly Piece[] = [...TIERS, ...FRONT];

/** Every drawn piece of Alchemia in the world's axes (the Arkady's, askew, are `ARKADY_PIECES`). */
export const ALCHEMIA_PIECES: readonly Piece[] = [...SHELL, ...PLANTERS, ...UNITS, ...TABLES, ...LIFT, ...terracePieces(), ...PLAZA, ...SQUARE, ...TIERS, ...FRONT];

/**
 * P-2's solids (stage 5a), the last of Alchemia's: its store's shell with the earth beside it, its
 * corridor's with the cutting, its stairs, its store's fittings with the pallets and their cars.
 */
export const P2_PROPS: readonly StaticProp[] = [
  solidProp([...P2_STORE_SHELL, ...P2_EARTH_PIECES]),
  solidProp([...P2_CORRIDOR_SHELL, ...P2_CUTTING_PIECES]),
  solidProp(P2_STAIR_PIECES),
  solidProp([...P2_STORE_PIECES, ...P2_STORE_SOLIDS]),
];

/** Every solid of Alchemia, a prop per part of the food hall, its lift's moving parts, then T2 and the Arkady. */
export const ALCHEMIA_PROPS: readonly StaticProp[] = [
  solidProp(SHELL.filter((p) => p.kind !== "step")),
  solidProp(SHELL.filter((p) => p.kind === "step")),
  solidProp(PLANTERS),
  solidProp(UNITS.filter((p) => p.box.z0 >= HALL.maxZ - 8.5)),
  solidProp(UNITS.filter((p) => p.box.z0 < HALL.maxZ - 8.5)),
  solidProp(TABLES),
  solidProp(LIFT),
  ...ALCHEMIA_LIFT_MECHANISM,
  // Stage 2 after stage 1's, so their ids (from ROOM_ID_BASE, in this order) stay as they were. The
  // Arkady themselves stand in the map's ruin's place among its buildings (`lublin/city.ts`).
  solidProp(PLAZA),
  ARKADY_PAVEMENT_PROP,
  // Stage 3 after stage 2's: the pavilion on the corner with its ladder.
  ...PAVILION_PROPS,
  // Stage 4 after stage 3's: P-1 under the car park (its shell, then its fittings) and its ramp.
  solidProp(P1_PIECES.filter((p) => p.kind === "wall" || p.kind === "roof" || p.kind === "floor" || p.kind === "parapet" || p.kind === "step")),
  solidProp(P1_PIECES.filter((p) => p.kind !== "wall" && p.kind !== "roof" && p.kind !== "floor" && p.kind !== "parapet" && p.kind !== "step")),
  ...P1_RAMP_PROPS,
  // Stage 7 after stage 4's: T0's square, its pergolas' posts and the beds along the trench.
  solidProp(SQUARE),
  // The green tiers of 15.11 after stage 7's: their glass, slabs, parapets and planters, then their stairs.
  solidProp(TIERS.filter((p) => p.kind !== "step")),
  solidProp(TIERS.filter((p) => p.kind === "step")),
  // Stage 10 after the tiers: the passage from metro B's hall down to P-1.
  solidProp(METRO_DOOR_PIECES),
  // Stage 5a after stage 10's: P-2's shell with its portal and cutting, the flight down from P-1, the store's fittings.
  ...P2_PROPS,
  // The front over P-1 (B1, 19.11) after stage 5a's: its wings, storeys, columns and green steps, one prop of its own.
  solidProp(FRONT),
  // Stage 5b after the front: P-2's robots, running by the clock.
  ...P2_ROBOTS,
];

/** The ground dug out under Alchemia. */
export const ALCHEMIA_CUTS: readonly GroundCut[] = [FOODHALL_STAIR_CUT, FOODHALL_CUT, P1_RAMP_CUT, P1_STAIR_CUT, P2_CUT];

/** The rooms of Alchemia in the ground, its terrain whole over them (stage 4: P-1 with P-2's store under it; stage 5a: P-2's corridor). */
export const ALCHEMIA_VAULTS: readonly GroundVault[] = [P1_VAULT, METRO_DOOR_VAULT, P2_VAULT];

/** The middle of the hall: for streaming and drawing distances. */
export const ALCHEMIA_CENTRE: GroundPoint = { x: (HALL.minX + HALL.maxX) / 2, z: (HALL.minZ + HALL.maxZ) / 2 };
