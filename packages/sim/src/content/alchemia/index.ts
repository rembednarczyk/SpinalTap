import type { GroundPoint, StreetPropItem } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { StaticProp } from "../builders";
import { FOODHALL_CUT, FOODHALL_STAIR_CUT, shellPieces } from "./foodhall";
import { ALCHEMIA_LIFT_MECHANISM, ALCHEMIA_LIFT_NE, ALCHEMIA_LIFT_NE_MECHANISM, LIFT_SHAFT_CUT, liftPieces } from "./lift";
import { HALL, type Piece, solidProp, tiledSolidProps } from "./plan";
import { terracePieces } from "./terraces";
import { ARKADY_PAVEMENT_PROP } from "./arkady";
import { PAVILION_PROPS } from "./pavilion";
import { METRO_DOOR_PIECES, METRO_DOOR_VAULT } from "./metro-door";
import { P1_LINK_VAULT, P1_PIECES, P1_RAMP_CUT, P1_RAMP_PROPS, P1_STAIR_CUT, P1_VAULT } from "./parking";
import { P2_CORRIDOR_SHELL, P2_CUT, P2_CUTTING_PIECES, P2_EARTH_PIECES, P2_STAIR_PIECES, P2_STORE_SHELL, P2_VAULT } from "./p2";
import { P2_ROBOTS, P2_STORE_PIECES, P2_STORE_SOLIDS } from "./p2-store";
import { SHELTER_GATE, SHELTER_HATCH_CUT, SHELTER_HATCH_PIECES, SHELTER_PIECES, SHELTER_VAULTS } from "./shelter";
import { doorParts } from "../doors";
import { CAR_LIFT_PIECES, CAR_LIFT_RIDERS } from "./car-lift";
import type { GroundVault } from "../../world/vault";
import { plazaPieces } from "./plaza";
import { squarePieces } from "./square";
import { unitPieces } from "./units";
import { MALL_CUTS, mallInsidePieces, mallOutsidePieces, mallSolidProps } from "./mall";
import { frontPieces } from "./front";
import { frontDressPieces } from "./front-dress";
import { frontGreenPieces } from "./front-green";
import { entrancePieces } from "./entrance";
import { SHOP_BUILDS, SHOP_PIECES, SHOP_PROPS, modelBoxes } from "./shops";
import { FOODHALL_PROPS, seatingPieces } from "./foodhall-seating";
import { kitchenPieces } from "./foodhall-kitchens";
import { fumikoWindowPieces } from "./fumiko-p0";
import { LANDMARK_PROPS, landmarkPieces } from "./landmark";

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
export * from "./shelter";
export * from "./car-lift";
export { PARAPET_BEDS } from "./square";
export * from "./mall-plan";
export { ATRIUM_COLUMN, MALL_HOLES, P1_DOORS, mallGlass, mallInsidePieces, mallOutsidePieces, mallSlabs, rectsMinus } from "./mall";
export { CORE_GOING, coreLanes, coreRisers, coreSpan, corePieces, coreStoreys } from "./mall-cores";
export { escalatorFlight, escalatorPieces, escalatorTread } from "./escalators";
export { slabOf as storeySlabOf } from "./storey";
export { ALCHEMIA_NAV } from "./nav";
export { frontDressPieces } from "./front-dress";
export { FRONT_GREEN_PROPS, frontGreenPieces } from "./front-green";
export { entrancePieces } from "./entrance";
export {
  GLASS_IN as SHOP_GLASS_IN,
  RING_WAYS as SHOP_RING_WAYS,
  SHOPS as GALLERY_SHOPS,
  SHOPFRONT_HEAD,
  SHOP_DOOR,
  type ShopDef as GalleryShopDef,
  type ShopState as GalleryShopState,
  type ShopTrade as GalleryShopTrade,
  isOpen as galleryShopOpen,
  shopAt as galleryShopAt,
  shopCeiling as galleryShopCeiling,
  shopFloor as galleryShopFloor,
  shopFrame as galleryShopFrame,
} from "./shops-plan";
export { GALLERY_CROWD, SHOP_BUILDS, SHOP_PIECES, SHOP_PROPS, SHOP_SOLIDS, type ShopBuild } from "./shops";
export { FOODHALL_PROPS, FUMIKO_STOOLS, TABLE_GROUPS, groupParts, seatingPieces } from "./foodhall-seating";
export { kitchenPieces } from "./foodhall-kitchens";
export { FUMIKO_WINDOW, FUMIKO_WINDOW_SPOT, FUMIKO_WINDOW_YAW, beforeHatch, fumikoWindowPieces } from "./fumiko-p0";
export { FOUNTAIN_P0, LANDMARK_PROPS, landmarkPieces } from "./landmark";
export { ARCADE_BAYS, ARCADE_FRONT, ARCADE_PIER, ARCADE_WALK, arcadePiers } from "./arcade-front";
export { EAST_WING, FOUNTAIN, FRONT_FOOTPRINTS, FRONT_KIOSKS, FRONT_SIGN, GREEN_SLOPE, GREEN_STEPS, L1_TOP, L2_SLABS, L2_TOP, L3, L3_TOP, PASSAGE_COLUMNS, WEST_WING, frontPieces } from "./front";

/**
 * Alchemia by the investor's plan (ADR-0074): the food hall with its units, stairs and lift, its
 * green roof and the terraces round it (stage 1; the gallery round its atrium since ADR-0093, its
 * food hall on P3 and its shops on P0..P2); the lower square T2 with its stairs and the
 * Arkady rebuilt on it (stage 2); the triangular pavilion on the corner with Ren on its roof
 * (stage 3, `pavilion.ts`); P-1 under the car park (stage 4, `parking.ts`) and P-2 under it (stage 5a, `p2.ts`); T0's square with its
 * pergolas, lanterns and beds and the lawns of the green roof (stage 7, `square.ts`). Everything is drawn by the engine
 * (`renderer/alchemia`) from `ALCHEMIA_PIECES`; the solid ones are the simulation's scenery, with
 * ids from `ROOM_ID_BASE` (outside the allocator).
 */

/**
 * The food hall's seating (ADR-0093 O3: on P3 with its units; the shared tables in the middle of the
 * hall's floor until then), its units' kitchens, Fumiko's second place on P0 with its hatch onto T1,
 * and P0's landmark in the atrium.
 */
const SEATING = seatingPieces();
const KITCHENS = kitchenPieces();
const FUMIKO_P0 = fumikoWindowPieces();
const LANDMARK = landmarkPieces();

const SHELL = shellPieces();
const UNITS = unitPieces();
const LIFT = liftPieces();

const PLAZA = plazaPieces();
const SQUARE = squarePieces();
const LIFT_NE = liftPieces(ALCHEMIA_LIFT_NE);
/** The gallery round the atrium (ADR-0093 O1): its body drawn from afar, its galleries' balustrades, escalators and cores near. */
const MALL_OUT = mallOutsidePieces();
const MALL_IN = mallInsidePieces();
const FRONT = [...frontPieces(), ...frontDressPieces(), ...frontGreenPieces(), ...entrancePieces()];
/**
 * The gallery's body (ADR-0093 O1; the green tiers of 15.11 until then) and the front's storeys over
 * P-1 (B1, 19.11), among `ALCHEMIA_PIECES`: the engine draws them as a building of their own.
 */
export const ALCHEMIA_TIER_PIECES: readonly Piece[] = [...MALL_OUT, ...FRONT];

/** Every drawn piece of Alchemia in the world's axes (the Arkady's, askew, are `ARKADY_PIECES`). */
export const ALCHEMIA_PIECES: readonly Piece[] = [
  ...SHELL,
  ...UNITS,
  ...SEATING,
  ...LIFT,
  ...terracePieces(),
  ...PLAZA,
  ...SQUARE,
  ...MALL_OUT,
  ...FRONT,
  ...MALL_IN,
  ...LIFT_NE,
  ...SHOP_PIECES,
  ...KITCHENS,
  ...FUMIKO_P0,
  ...LANDMARK,
];

/** The game's models of the food hall and of P0's landmark (ADR-0093 O3), drawn with the shops' (one street-props view). */
export const ALCHEMIA_HALL_PROPS: readonly StreetPropItem[] = [...SHOP_PROPS, ...FOODHALL_PROPS, ...LANDMARK_PROPS];

/**
 * The gallery's shops on P1 and P2 (ADR-0093 O2): a prop each, its partitions, shopfront, fittings
 * and the boxes of the game's models in it (a walker in a shop gets its prisms, not the floor's).
 */
export const SHOP_SOLID_PROPS: readonly StaticProp[] = SHOP_BUILDS.map((b) => solidProp([...b.pieces, ...b.solids.map((p) => ({ ...p, solid: true }))]));

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

/** The shelter's solids (stage 5d1): its room with its flights and exhibit, the hatch's shaft, the steel gate's leaf. */
export const SHELTER_PROPS: readonly StaticProp[] = [solidProp(SHELTER_PIECES), solidProp(SHELTER_HATCH_PIECES), ...doorParts(SHELTER_GATE)];

/** The car lift's solids (stage 5e): its railing at P-2, its platform and the car riding it by the clock. */
export const CAR_LIFT_PROPS: readonly StaticProp[] = [solidProp(CAR_LIFT_PIECES), ...CAR_LIFT_RIDERS];

/**
 * The gallery's solids (ADR-0093 O1), the last of Alchemia's: its body (slabs, glass, the roof's
 * balustrades), its galleries' balustrades and the cores' walls and the north-east lift's shaft a prop
 * per tile, each escalator's flight and each core storey's flights a prop (`mallSolidProps`); then the
 * lift's moving parts.
 */
export const MALL_PROPS: readonly StaticProp[] = [...mallSolidProps(MALL_OUT, LIFT_NE), ...ALCHEMIA_LIFT_NE_MECHANISM];

/**
 * The food hall's kitchens on P3 a prop per tile, Fumiko's second place and P0's landmark (ADR-0093
 * O3), the boxes of the game's models in both last: Alchemia's last solids.
 */
export const FOODHALL_SOLID_PROPS: readonly StaticProp[] = [
  ...tiledSolidProps(KITCHENS, 12),
  solidProp(FUMIKO_P0),
  solidProp(LANDMARK),
  solidProp(modelBoxes([...FOODHALL_PROPS, ...LANDMARK_PROPS])),
];

/**
 * Every solid of Alchemia, a prop per part of the food hall, its lift's moving parts, then T2 and the
 * Arkady. The units' two props and the tables' one hold the food hall on P3 since ADR-0093 O3 (its
 * units, north and south of z 45, and its seating), so the ids after them stay as they were.
 */
export const ALCHEMIA_PROPS: readonly StaticProp[] = [
  solidProp(SHELL.filter((p) => p.kind !== "step")),
  solidProp(SHELL.filter((p) => p.kind === "step")),
  solidProp(UNITS.filter((p) => p.box.z0 >= 45)),
  solidProp(UNITS.filter((p) => p.box.z0 < 45)),
  solidProp(SEATING),
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
  // Stage 10 after stage 7's (the green tiers between them went with ADR-0093 O1): the passage from metro B's hall down to P-1.
  solidProp(METRO_DOOR_PIECES),
  // Stage 5a after stage 10's: P-2's shell with its portal and cutting, the flight down from P-1, the store's fittings.
  ...P2_PROPS,
  // The front over P-1 (B1, 19.11) after stage 5a's: its wings, storeys, columns and green steps, one prop of its own.
  solidProp(FRONT),
  // Stage 5b after the front: P-2's robots, running by the clock.
  ...P2_ROBOTS,
  // Stage 5d1 after 5b's: the shelter.
  ...SHELTER_PROPS,
  // Stage 5e after 5d1's: the car lift from P-1's north cabin down to P-2's lane.
  ...CAR_LIFT_PROPS,
  // The gallery round the atrium (ADR-0093 O1).
  ...MALL_PROPS,
  // Its shops on P1 and P2 (O2), then P0's (O3), so every id above stays.
  ...SHOP_SOLID_PROPS,
  // The food hall's kitchens, Fumiko's second place and P0's landmark (O3) last.
  ...FOODHALL_SOLID_PROPS,
];

/** The ground dug out under Alchemia. */
// The lift's shaft (stage 5c) before the hall's cut it lies in, as the hall's stairs: the first cut over a point is its floor.
// The gallery's cores and escalators (ADR-0093 O1) as the hall's stairs, before the hall's cut.
export const ALCHEMIA_CUTS: readonly GroundCut[] = [LIFT_SHAFT_CUT, FOODHALL_STAIR_CUT, ...MALL_CUTS, FOODHALL_CUT, P1_RAMP_CUT, P1_STAIR_CUT, P2_CUT, SHELTER_HATCH_CUT];

/** The rooms of Alchemia in the ground, its terrain whole over them (stage 4: P-1 with P-2's store under it; stage 5a: P-2's corridor; stage 5d1: the shelter and its way to the gate; ADR-0093 O2b: P-1's passage to its stair core). */
export const ALCHEMIA_VAULTS: readonly GroundVault[] = [P1_VAULT, METRO_DOOR_VAULT, P2_VAULT, ...SHELTER_VAULTS, P1_LINK_VAULT];

/** The middle of the hall: for streaming and drawing distances. */
export const ALCHEMIA_CENTRE: GroundPoint = { x: (HALL.minX + HALL.maxX) / 2, z: (HALL.minZ + HALL.maxZ) / 2 };
