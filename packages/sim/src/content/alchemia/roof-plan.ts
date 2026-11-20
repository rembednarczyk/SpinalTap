import { ATRIUM, MALL_LEVELS, MALL_RAIL } from "./mall-plan";
import type { Corners, Rectangle } from "./rounded";

/*
 * The gallery's green roof (ADR-0093 O4, the board's scheme of storeys and its front view): a
 * courtyard in the roof round the atrium's opening. Pattern: the intensive green roof (roof garden),
 * FLL "Green Roof Guidelines" (Dachbegrünungsrichtlinien, 2018): planting on a substrate layer in
 * raised beds with an edging (trees and shrubs need 0.5 m and more), paved ways between them, the
 * roof's services in their own corner; as the board, a paved ring round the opening and lawns either
 * side. Pure numbers, world metres: `roof-garden.ts` builds the beds, pergolas and the game's models
 * on them, `roof-dress.ts` the services and the residents' garden.
 */

/** The roof's walking level. */
export const ROOF_Y = MALL_LEVELS.roof;

/** The inner faces of the roof's balustrade (`mall.ts`: on the slab's edge, a hand in, a rail thick) and of the atrium's. */
export const ROOF_INNER: Rectangle = { x0: 399.87, x1: 436.13, z0: 32.47, z1: 58.13 };
export const ATRIUM_RAIL: Rectangle = { x0: ATRIUM.x0 - 0.12, x1: ATRIUM.x1 + 0.12, z0: ATRIUM.z0 - 0.12, z1: ATRIUM.z1 + 0.12 };

/**
 * The paved ways (the board's pale paths on the green): the ring round the atrium's balustrade, 2.4 m
 * and more, the ways to the doors of both stair cores' houses and of both lifts' kiosks, the floors
 * under the pergolas and the cross path into the west one. Nothing solid stands on them but the
 * pergolas' posts at their floors' edges.
 */
export const ROOF_PATHS: readonly (Rectangle & { readonly key: string })[] = [
  { key: "ring-s", x0: 408.3, x1: 427.7, z0: 37.5, z1: ATRIUM_RAIL.z0 },
  { key: "ring-w", x0: 408.3, x1: ATRIUM_RAIL.x0, z0: ATRIUM_RAIL.z0, z1: ATRIUM_RAIL.z1 },
  { key: "ring-e", x0: ATRIUM_RAIL.x1, x1: 427.7, z0: ATRIUM_RAIL.z0, z1: ATRIUM_RAIL.z1 },
  { key: "ring-n", x0: 408.3, x1: 427.7, z0: ATRIUM_RAIL.z1, z1: 52.6 },
  // From the south-west core's house (its door in the north wall, z 38.1) east to the ring.
  { key: "core-sw", x0: 400.0, x1: 408.3, z0: 38.2, z1: 40.4 },
  // From the hall's lift's kiosk (its gate north, z 34.9) north to the ring.
  { key: "lift-sw", x0: 412.2, x1: 414.8, z0: 34.95, z1: 37.5 },
  // North from the ring to the north-east core's house (its door in the west wall, z 55.5-57.0).
  { key: "core-ne", x0: 425.3, x1: 427.4, z0: 52.6, z1: 57.9 },
  // East from the ring to the north-east lift's kiosk (its gate south, z 51.9).
  { key: "lift-ne", x0: 427.7, x1: 431.6, z0: 49.7, z1: 51.85 },
  { key: "cross-w", x0: 400.3, x1: 408.3, z0: 46.7, z1: 48.6 },
  { key: "pergola-w", x0: 400.3, x1: 408.3, z0: 48.6, z1: 55.5 },
  { key: "pergola-n", x0: 415.6, x1: 425.3, z0: 52.6, z1: 56.3 },
  { key: "pergola-s", x0: 419.4, x1: 427.7, z0: 32.75, z1: 37.5 },
];

/**
 * A bed: raised (the substrate a knee high in an edging, for trees and shrubs) or low (a lawn on a
 * 0.15 m substrate in its edging, one steps up onto it). Its rounded corners and their radius
 * (`roundedOutline`); its key for what grows in it.
 */
export interface RoofBed extends Rectangle {
  readonly key: string;
  readonly high: number;
  readonly corners: Corners;
  readonly radius: number;
}
/** A raised bed's height (FLL: 0.5 m of substrate and more for small trees) and a low lawn's, over the roof. */
export const BED_RAISED = 0.55;
export const BED_LOW = 0.15;

const ALL: Corners = [true, true, true, true];
export const ROOF_BEDS: readonly RoofBed[] = [
  // West: a raised bed with a tree, a picnic lawn beside it (the board's big lawn west of the opening).
  { key: "w-tree", x0: 400.3, x1: 404.3, z0: 40.8, z1: 46.4, high: BED_RAISED, corners: ALL, radius: 1.2 },
  { key: "w-lawn", x0: 404.6, x1: 408.0, z0: 40.8, z1: 46.4, high: BED_LOW, corners: ALL, radius: 0.8 },
  // North-west, behind the west pergola: its corner on the roof's rounded one, concentric with the balustrade.
  { key: "nw", x0: 400.3, x1: 408.0, z0: 55.8, z1: 57.7, high: BED_RAISED, corners: [false, true, true, false], radius: 1.7 },
  // North: a raised bed with a tree west of the north pergola, a strip of shrubs behind it.
  { key: "n-tree", x0: 408.5, x1: 415.3, z0: 52.9, z1: 57.8, high: BED_RAISED, corners: ALL, radius: 1.0 },
  { key: "n-strip", x0: 415.6, x1: 425.1, z0: 56.5, z1: 57.8, high: BED_RAISED, corners: [false, true, true, false], radius: 0.5 },
  // South: a raised bed with a tree by the south-west core, flowers and shrubs by the hall's lift.
  { key: "s-tree", x0: 408.1, x1: 412.0, z0: 32.75, z1: 37.2, high: BED_RAISED, corners: ALL, radius: 0.8 },
  { key: "s-flowers", x0: 415.0, x1: 419.1, z0: 32.75, z1: 36.2, high: BED_RAISED, corners: ALL, radius: 0.8 },
  // East: a bed by the services in the south-east, the meadow north of the residents' garden.
  { key: "e-tree", x0: 427.9, x1: 431.0, z0: 32.75, z1: 36.0, high: BED_RAISED, corners: ALL, radius: 0.8 },
  { key: "e-meadow", x0: 431.9, x1: 435.9, z0: 49.9, z1: 54.0, high: BED_LOW, corners: ALL, radius: 0.8 },
  // Meadows where nobody needs to walk: south of the south-west core's house, by the services' cabinet.
  { key: "sw-meadow", x0: 400.2, x1: 407.6, z0: 32.75, z1: 34.35, high: BED_LOW, corners: ALL, radius: 0.6 },
  { key: "e-strip", x0: 427.9, x1: 431.2, z0: 36.3, z1: 39.55, high: BED_LOW, corners: ALL, radius: 0.6 },
];

/** A pergola: its posts' columns along x and rows along z (each post 0.2 m square, centred there). */
export interface Pergola {
  readonly key: string;
  readonly xs: readonly number[];
  readonly zs: readonly number[];
}
/**
 * Dark timber as on T0's square of stage 7 (ADR-0074), lower (2.9 m there): the rafters with the
 * climbers on them up to the gallery's height (13.5, `alchemia-mall-height`), the lanterns under
 * them still over every head.
 */
export const PERGOLA = { post: 0.2, height: 2.4, beam: 0.16, rafterEvery: 0.6 } as const;
export const PERGOLAS: readonly Pergola[] = [
  { key: "w", xs: [400.6, 404.3, 408.0], zs: [48.9, 55.2] },
  { key: "n", xs: [415.9, 420.5, 425.0], zs: [52.8, 56.2] },
  { key: "s", xs: [419.7, 423.6, 427.5], zs: [33.0, 37.2] },
];

/** The paper lanterns under the pergolas' rafters: ruby red, a box this big, this far under the beam (over every head). */
export const LANTERN = { size: 0.3, drop: 0.3 } as const;

/**
 * The benches (the game's, `bench`: variant 1 with a back, 0 the long ława), facing `yaw` (0 north):
 * two pairs facing each other across the west pergola's floor (its middle open, a way through), a
 * row facing the atrium under the north one, two under the south one, one before the flowers by the
 * hall's lift.
 */
export const ROOF_BENCHES: readonly { readonly x: number; readonly z: number; readonly yaw: number; readonly variant: number }[] = [
  { x: 402.5, z: 50.2, yaw: 0, variant: 1 },
  { x: 402.5, z: 53.9, yaw: Math.PI, variant: 1 },
  { x: 406.1, z: 50.2, yaw: 0, variant: 1 },
  { x: 406.1, z: 53.9, yaw: Math.PI, variant: 1 },
  { x: 418.2, z: 55.4, yaw: Math.PI, variant: 1 },
  { x: 422.8, z: 55.4, yaw: Math.PI, variant: 0 },
  { x: 421.6, z: 33.9, yaw: 0, variant: 1 },
  { x: 425.6, z: 33.9, yaw: 0, variant: 0 },
  { x: 417.05, z: 36.85, yaw: 0, variant: 0 },
];

/** A picnic table at the west pergola's west end, by the balustrade, out of its middle: elbow high, solid. */
export const ROOF_TABLES: readonly Rectangle[] = [{ x0: 400.35, x1: 401.25, z0: 51.35, z1: 52.75 }];

/** The game's planters with their greenery, a solid each as their concrete box: by the south pergola's west end. */
export const ROOF_PLANTERS: readonly { readonly x: number; readonly z: number }[] = [{ x: 420.1, z: 35.1 }, { x: 426.9, z: 35.6 }];

/** The trees (the game's, `tree`): in the raised beds, on their substrate, some 6 m tall (the board's trees on the roof). */
export const ROOF_TREES: readonly { readonly x: number; readonly z: number; readonly seed: number }[] = [
  { x: 402.3, z: 43.6, seed: 31 },
  { x: 411.9, z: 55.4, seed: 59 },
  { x: 410.0, z: 35.0, seed: 47 },
  { x: 429.4, z: 34.4, seed: 76 },
];

/** The park lamps lighting the ways (the game's `lamp-park`), in the beds' corners by the paths. */
export const ROOF_LAMPS: readonly { readonly x: number; readonly z: number }[] = [
  { x: 407.55, z: 41.25 },
  { x: 401.0, z: 45.7 },
  { x: 414.85, z: 53.35 },
  { x: 411.55, z: 36.75 },
  { x: 428.35, z: 35.55 },
  { x: 432.35, z: 50.35 },
];

/** The atrium's balustrade on the roof (`mall.ts`): its height, for the crowd leaning on it. */
export const ROOF_RAIL = MALL_RAIL;
