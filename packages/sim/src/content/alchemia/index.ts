import type { GroundPoint, StreetPropItem } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { StaticProp } from "../builders";
import { FOODHALL_CUT, FOODHALL_STAIR_CUT, shellPieces } from "./foodhall";
import { ALCHEMIA_LIFT_MECHANISM, ALCHEMIA_LIFT_NE, ALCHEMIA_LIFT_NE_MECHANISM, LIFT_SHAFT_CUT, liftPieces } from "./lift";
import { HALL, type Piece, solidProp, tiledSolidProps } from "./plan";
import { terracePieces } from "./terrace-steps";
import { ARKADY_PAVEMENT_PROP } from "./arkady";
import { PAVILION_PROPS } from "./pavilion";
import { PAVILION_ROOF_PROPS } from "./pavilion-roof-dress";
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
import { GALLERY_LIGHTS } from "./gallery-lights";
import { EXIT_SIGNS } from "./exit-signs";
import { unitPieces } from "./units";
import { MALL_CUTS, mallInsidePieces, mallOutsidePieces, mallSolidProps } from "./mall";
import { frontPieces } from "./front";
import { frontDressPieces } from "./front-dress";
import { frontGreenPieces } from "./front-green";
import { entrancePieces } from "./entrance";
import { FRONT_SHOP_BUILDS, SHOP_BUILDS, SHOP_PIECES, SHOP_PROPS, modelBoxes, shopCustomers } from "./shops";
import { frontShellInsidePieces, frontShellPieces } from "./front-shell";
import { FRONT_ROOM_CROWD, FRONT_ROOM_PROPS, FRONT_ROOM_SIGNS, type VenueSign, frontRoomPieces } from "./front-rooms";
import { L3_CROWD, L3_PROPS, L3_SIGNS, l3Pieces } from "./front-l3";
import { drawnOnly } from "./front-fit";
import { FRONT_GREEN_PROPS, FRONT_PLANTER_SOLIDS } from "./front-green";
import type { CrowdSpot } from "../crowd-spot";
import { FOODHALL_PROPS, seatingPieces } from "./foodhall-seating";
import { kitchenPieces } from "./foodhall-kitchens";
import { fumikoWindowPieces } from "./fumiko-p0";
import { LANDMARK_PROPS, landmarkPieces } from "./landmark";
import { ROOF_GARDEN_PROPS, ROOF_PLANTER_SOLIDS, roofGardenPieces } from "./roof-garden";
import { ROOF_DRESS_PROPS, roofDressPieces } from "./roof-dress";
import { plazaFloorPieces } from "./front-plaza";
import { plazaCafePieces, plazaCafeSolids } from "./front-plaza-cafe";
import { DEPTAK_PROPS, deptakStallPieces } from "./deptak-stalls";
import { DEPTAK_NIGHT_PROPS, deptakNightPieces } from "./deptak-night";
import { TERRACE_PEOPLE } from "./terrace-people";

export { T0 as ALCHEMIA_T0, T1 as ALCHEMIA_T1, HALL as FOODHALL, HALL_INNER as FOODHALL_INNER, type Box as AlchemiaBox, type Piece as AlchemiaPiece, type PieceKind as AlchemiaPieceKind } from "./plan";
export * from "./foodhall";
export * from "./units";
export * from "./lift";
export * from "./terraces";
export * from "./arkady";
export { T2 as ALCHEMIA_T2, T2_PADS, T2_RECTS, T2_STAIRS, MEMORIAL as ALCHEMIA_MEMORIAL, onT2 } from "./plaza";
export * from "./market";
export { T1_CART, T1_DETAIL, T1_EXTRACT, T1_FURNITURE, T1_HATCH, T1_SMOKERS } from "./t1-dress";
export * from "./sellers";
export * from "./pavilion";
export * from "./pavilion-roof-dress";
export * from "./parking";
export * from "./metro-door";
export * from "./p2";
export * from "./p2-store";
export * from "./shelter";
export * from "./car-lift";
export { PARAPET_BEDS } from "./square";
export * from "./mall-plan";
export { EXIT_FLOORS, EXIT_SIGNS } from "./exit-signs";
export { ATRIUM_COLUMN, MALL_HOLES, P1_DOORS, mallGlass, mallInsidePieces, mallOutsidePieces, mallSlabs, rectsMinus } from "./mall";
export { CORE_GOING, coreLanes, coreRisers, coreSpan, corePieces, coreStoreys } from "./mall-cores";
export { escalatorFlight, escalatorPieces, escalatorTread } from "./escalators";
export { slabOf as storeySlabOf } from "./storey";
export { ALCHEMIA_NAV } from "./nav";
export { frontDressPieces } from "./front-dress";
export { FRONT_GREEN_PROPS, FRONT_PLANTER_SOLIDS, FRONT_TREES, frontGreenPieces } from "./front-green";
export * from "./front-levels";
export { FRONT_SHOPS, TOKYO_DRIP_L2 } from "./front-shops";
export { ARCADE_BACK, FRONT_ROOMS, frontGlass } from "./front-shell";
export { FRONT_ROOM_CROWD, FRONT_ROOM_PROPS, type VenueSign } from "./front-rooms";
export { L3_CROWD, L3_GROUPS, L3_PROPS, SKY_BAR, YAKITORI } from "./front-l3";
export { FRONT_NAV } from "./front-nav";
export { entrancePieces } from "./entrance";
export {
  GLASS_IN as SHOP_GLASS_IN,
  RING_WAYS as SHOP_RING_WAYS,
  SHOPS as GALLERY_SHOPS,
  SHOPFRONT_HEAD,
  SHOP_DOOR,
  ALL_SHOPS as ALL_GALLERY_SHOPS,
  shopHead as galleryShopHead,
  type ShopDef as GalleryShopDef,
  type ShopState as GalleryShopState,
  type ShopTrade as GalleryShopTrade,
  isOpen as galleryShopOpen,
  shopAt as galleryShopAt,
  shopCeiling as galleryShopCeiling,
  shopFloor as galleryShopFloor,
  shopFrame as galleryShopFrame,
} from "./shops-plan";
export { ALL_SHOP_BUILDS, FRONT_SHOP_BUILDS, FRONT_SHOP_DETAIL, GALLERY_CROWD, GALLERY_DETAIL, SHOP_BUILDS, SHOP_PIECES, SHOP_PROPS, SHOP_SOLIDS, type ShopBuild } from "./shops";
export { FOODHALL_PROPS, FUMIKO_STOOLS, TABLE_GROUPS, groupParts, seatingPieces } from "./foodhall-seating";
export { kitchenPieces } from "./foodhall-kitchens";
export { FUMIKO_WINDOW, FUMIKO_WINDOW_SPOT, FUMIKO_WINDOW_YAW, beforeHatch, fumikoWindowPieces } from "./fumiko-p0";
export { FOUNTAIN_P0, LANDMARK_PROPS, landmarkPieces } from "./landmark";
export * from "./roof-plan";
export { ROOF_CROWD, ROOF_GARDEN_PROPS, ROOF_PLANTER_SOLIDS, bedOutline, inBed, roofGardenPieces } from "./roof-garden";
export { AIR_HANDLER, CHAIR, CRATES, MAST, PANELS, PANEL_ROWS, ROOF_DRESS_PROPS, WASHING, roofDressPieces } from "./roof-dress";
export { ARCADE_BAYS, ARCADE_FRONT, ARCADE_PIER, ARCADE_WALK, arcadePiers } from "./arcade-front";
export { FOUNTAIN_CENTRE, FOUNTAIN_RADIUS, FOUNTAIN_RIM, PASSAGE_STEPS, PLAZA_FLOOR, PLAZA_GOING, PLAZA_RISER, PLAZA_STEPS, PLAZA_TOP, PODIUM, SOUTH_STEPS, WEST_STEPS, plazaFloorPieces } from "./front-plaza";
export { DEPTAK_CROWD, DEPTAK_KIOSKS, DEPTAK_PROPS, DEPTAK_STALLS, deptakStallPieces, stallSeller } from "./deptak-stalls";
export { CART_CLEAR, DEPTAK_NIGHT_CABLES, DEPTAK_NIGHT_CROWD, DEPTAK_NIGHT_PROPS, DEPTAK_NIGHT_STRINGS, type LanternString, YATAI, deptakNightPieces, stringY } from "./deptak-night";
export { TERRACE_PEOPLE } from "./terrace-people";
export { CAFE_TABLES, FRONT_PLAZA_PROPS, PLAZA_CROWD, PLAZA_FOOTPRINTS, PLAZA_KIOSKS, kioskSpots, plazaCafePieces, plazaCafeSolids } from "./front-plaza-cafe";
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
/** The green roof (ADR-0093 O4): its garden (beds, pergolas, tables) and its services, the residents' garden and the traces. */
const ROOF = [...roofGardenPieces(), ...roofDressPieces()];
/** The green roof's pieces among `ALCHEMIA_PIECES`: the engine draws them by their part of the roof (`roof-geometry.ts`). */
export const ALCHEMIA_ROOF_PIECES: readonly Piece[] = ROOF;

const SHELL = shellPieces();
const UNITS = unitPieces();
const LIFT = liftPieces();

const PLAZA = plazaPieces();
const SQUARE = squarePieces();
const LIFT_NE = liftPieces(ALCHEMIA_LIFT_NE);
/** The gallery round the atrium (ADR-0093 O1): its body drawn from afar, its galleries' balustrades, escalators and cores near. */
const MALL_OUT = mallOutsidePieces();
const MALL_IN = mallInsidePieces();
/** The front's storeys (B1) with their glass, floors and steps as rooms since ADR-0093 O5 (`front-shell.ts`), drawn with the storeys. */
const FRONT = [...frontPieces(), ...frontDressPieces(), ...frontGreenPieces(), ...entrancePieces(), ...frontShellPieces()];
/**
 * The front's rooms furnished (ADR-0093 O5): the steps in from the arcade, the arcades and the café
 * (`front-rooms.ts`), L3's bar, grill and tables (`front-l3.ts`); drawn near only, with the solids
 * not drawn among them.
 */
const FRONT_IN = [...frontShellInsidePieces(), ...frontRoomPieces(), ...l3Pieces()];
/** The front's rooms' fittings (O5) with the solids not drawn among them: the glitch scan's `alchemia-front-footprint` measures them. */
export const FRONT_ROOM_PIECES: readonly Piece[] = FRONT_IN;
/** Of them what the engine draws (among `ALCHEMIA_PIECES`). */
export const FRONT_ROOM_DRAWN: readonly Piece[] = drawnOnly(FRONT_IN);
/** The front's units (O5), a prop each among the last of Alchemia's. */
const FRONT_SHOP_PIECES = FRONT_SHOP_BUILDS.flatMap((b) => b.pieces);
/** The square before the front (C5, 19.11): its podium, stairs and fountain, its kiosks and café; drawn with the front. */
const FRONT_SQUARE = [...plazaFloorPieces(), ...plazaCafePieces()];
/** The deptak's stalls dressed (C7, 20.11): crates, buckets, tags, lamps, cables, cartons and the tea; drawn with the front. */
const DEPTAK = deptakStallPieces();
/** The deptak's south end at night (22.11): the lanterns over it, the yatai with its stools and sign, the cans; drawn with the front, after every piece above. */
const NIGHT = deptakNightPieces();
/** Of Alchemia's pieces those of the deptak's night (the engine draws them by their kind, `deptak-night-geometry.ts`). */
export const DEPTAK_NIGHT_PIECES: readonly Piece[] = NIGHT;
/**
 * The gallery's body (ADR-0093 O1; the green tiers of 15.11 until then) and the front's storeys over
 * P-1 (B1, 19.11), among `ALCHEMIA_PIECES`: the engine draws them as a building of their own.
 */
export const ALCHEMIA_TIER_PIECES: readonly Piece[] = [...MALL_OUT, ...FRONT, ...FRONT_SQUARE, ...DEPTAK, ...NIGHT];

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
  ...ROOF,
  ...FRONT_SQUARE,
  ...DEPTAK,
  ...FRONT_ROOM_DRAWN,
  ...FRONT_SHOP_PIECES,
  ...NIGHT,
  // The gallery's ceiling fittings over its strips (22.11, §13: no light from nowhere), last: drawn only.
  ...GALLERY_LIGHTS,
  // The green exit signs over the cores' doors (22.11, §13: the way out stands out), last: drawn only.
  ...EXIT_SIGNS,
];

/** The game's models on the green roof (ADR-0093 O4): trees, shrubs, benches, park lamps, planters, the services' cabinet. */
export const ALCHEMIA_ROOF_PROPS: readonly StreetPropItem[] = [...ROOF_GARDEN_PROPS, ...ROOF_DRESS_PROPS];

/**
 * The green roof's solids (O4) a prop per tile: its beds, pergolas' posts, tables, services and the
 * residents' crates and chair, the planters' boxes and the boxes of the game's models (the trees'
 * trunks, the benches, the lamps' posts, the cabinet).
 */
export const ROOF_SOLID_PROPS: readonly StaticProp[] = tiledSolidProps([...ROOF, ...ROOF_PLANTER_SOLIDS, ...modelBoxes(ALCHEMIA_ROOF_PROPS)], 12);

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
 * The square before the front (C5): its podium, stairs, fountain, kiosks, tables and chairs and the
 * game's models on it, a prop per 8 m tile (a walker near a prop gets all its prisms).
 */
export const FRONT_PLAZA_SOLID_PROPS: readonly StaticProp[] = tiledSolidProps([...FRONT_SQUARE, ...plazaCafeSolids()], 8);

/**
 * The game's models of C7 (20.11): the deptak's stalls' sellers and crates, the people on the front's
 * terraces (still figures, drawn only), one street-props view.
 */
export const C7_PROPS: readonly StreetPropItem[] = [...DEPTAK_PROPS, ...TERRACE_PEOPLE, ...DEPTAK_NIGHT_PROPS];

/** The deptak's stalls' solids (C7): the flower buckets, the cartons and the crates' boxes, a prop per 8 m tile, after the square's. */
export const DEPTAK_SOLID_PROPS: readonly StaticProp[] = tiledSolidProps([...DEPTAK, ...modelBoxes(DEPTAK_PROPS.filter((p) => p.prop !== "figure"))], 8);
/** The deptak's night (22.11): the yatai's body, its stools, the sign and the crates, a prop per 8 m tile, last. */
export const DEPTAK_NIGHT_SOLID_PROPS: readonly StaticProp[] = tiledSolidProps(NIGHT, 8);

/**
 * The front's solids on the ground in its old slot (B1): the green steps and the house with arcades'
 * piers. The rest of the front's storeys a prop per 12 m tile (ADR-0093 O5: a walker near a prop gets
 * all its prisms, and one walks in the storeys now).
 */
const FRONT_GROUND = FRONT.filter((p) => p.solid && p.box.y0 <= -2.9 && (p.kind === "green" || p.kind === "plaster"));
const FRONT_GROUND_SET: ReadonlySet<Piece> = new Set(FRONT_GROUND);
export const FRONT_STOREY_PROPS: readonly StaticProp[] = tiledSolidProps(FRONT.filter((p) => !FRONT_GROUND_SET.has(p)), 12);

/** The front's units (O5): a prop each, as the gallery's. */
export const FRONT_SHOP_SOLID_PROPS: readonly StaticProp[] = FRONT_SHOP_BUILDS.map((b) => solidProp([...b.pieces, ...b.solids.map((p) => ({ ...p, solid: true }))]));

/** The game's models in the front's rooms (O5): the arcades' machines and benches, the café's and the bar's people, the units' models. */
export const FRONT_ROOM_MODELS: readonly StreetPropItem[] = [...FRONT_ROOM_PROPS, ...L3_PROPS, ...FRONT_SHOP_BUILDS.flatMap((b) => b.props)];

/**
 * The front's fittings (O5) and the planters and trunks of the trees on its terraces, which one walks
 * now: a prop per 12 m tile.
 */
export const FRONT_ROOM_SOLID_PROPS: readonly StaticProp[] = tiledSolidProps(
  [...FRONT_IN, ...modelBoxes([...FRONT_ROOM_PROPS, ...L3_PROPS]), ...FRONT_PLANTER_SOLIDS, ...modelBoxes(FRONT_GREEN_PROPS.filter((p) => p.prop === "tree"))],
  12,
);

/** Every solid of the front's storeys as rooms (O5), the last of `ALCHEMIA_PROPS`. */
export const FRONT_O5_PROPS: readonly StaticProp[] = [...FRONT_STOREY_PROPS, ...FRONT_SHOP_SOLID_PROPS, ...FRONT_ROOM_SOLID_PROPS];

/** The front's still crowd (O5): its units' customers, the arcades' and the café's people, L3's. */
export const FRONT_CROWD: readonly CrowdSpot[] = [...shopCustomers(FRONT_SHOP_BUILDS), ...FRONT_ROOM_CROWD, ...L3_CROWD];

/** The neon names of the front's café, bar and grill (O5), drawn by the engine's letters. */
export const FRONT_VENUE_SIGNS: readonly VenueSign[] = [...FRONT_ROOM_SIGNS, ...L3_SIGNS];

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
  // The front over P-1 (B1, 19.11) after stage 5a's: its green steps and the house with arcades' piers, on the ground, one prop
  // of its own (its storeys and their rooms a prop per tile among the last since ADR-0093 O5: one walks in them now).
  solidProp(FRONT_GROUND),
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
  // The food hall's kitchens, Fumiko's second place and P0's landmark (O3).
  ...FOODHALL_SOLID_PROPS,
  // The green roof (O4), its ids as on main.
  ...ROOF_SOLID_PROPS,
  // The square before the front (C5), so every id above stays.
  ...FRONT_PLAZA_SOLID_PROPS,
  // The deptak's stalls' goods (C7).
  ...DEPTAK_SOLID_PROPS,
  // The front's storeys as rooms (ADR-0093 O5): their slabs, glass, floors, balustrades and steps a prop per tile, their units a
  // prop each, their fittings and the terraces' planters a prop per tile.
  ...FRONT_O5_PROPS,
  // The deptak's night by Bajkowskiego (22.11), so every id above stays.
  ...DEPTAK_NIGHT_SOLID_PROPS,
  // Ren's camp and the services on the pavilion's roof (23.11, `docs/lokacje/alchemia-pawilon-dach.md`), last, so every id above stays.
  ...PAVILION_ROOF_PROPS,
];

/** The ground dug out under Alchemia. */
// The lift's shaft (stage 5c) before the hall's cut it lies in, as the hall's stairs: the first cut over a point is its floor.
// The gallery's cores and escalators (ADR-0093 O1) as the hall's stairs, before the hall's cut.
export const ALCHEMIA_CUTS: readonly GroundCut[] = [LIFT_SHAFT_CUT, FOODHALL_STAIR_CUT, ...MALL_CUTS, FOODHALL_CUT, P1_RAMP_CUT, P1_STAIR_CUT, P2_CUT, SHELTER_HATCH_CUT];

/** The rooms of Alchemia in the ground, its terrain whole over them (stage 4: P-1 with P-2's store under it; stage 5a: P-2's corridor; stage 5d1: the shelter and its way to the gate; ADR-0093 O2b: P-1's passage to its stair core). */
export const ALCHEMIA_VAULTS: readonly GroundVault[] = [P1_VAULT, METRO_DOOR_VAULT, P2_VAULT, ...SHELTER_VAULTS, P1_LINK_VAULT];

/** The middle of the hall: for streaming and drawing distances. */
export const ALCHEMIA_CENTRE: GroundPoint = { x: (HALL.minX + HALL.maxX) / 2, z: (HALL.minZ + HALL.maxZ) / 2 };
