import { type FigureBody, type FigurePose, type StreetPropItem, figureVariant } from "@seki/core";
import { ARCADE_FRONT } from "./arcade-front";
import { L2_TOP, L3_TOP } from "./front";

/*
 * People on the front's terraces (C7 of the board 1:1, 20.11): the board
 * `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` has its terraces full, people at the rails
 * looking down on the square and at the tables under L3's umbrellas. One walks out there since
 * ADR-0093 O5 (from L3 onto L2's terraces, from the gallery's green roof onto L3's), but they stay the
 * game's still figures (ADR-0058), drawn with the furniture's blocks, not the simulation's crowd: standing on the
 * roofs' solid tops, behind the shrubs along the balustrades (`front-green.ts`), clear of the trees'
 * planters, the holograms' emitters and the umbrellas' tables (test). Placed by hand from the board,
 * each with its own look; the poses the figures' pack has standing (`stand`, `hips`, `smoke`).
 */

/** Facing: south (out over the square), north, east, west. */
const S = Math.PI;
const N = 0;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/** One standing on a roof `y`, at (x, z), facing `yaw`. */
const at = (y: number, x: number, z: number, yaw: number, pose: FigurePose, body: FigureBody, look: number): StreetPropItem => ({
  prop: "figure",
  x,
  y,
  z,
  yaw,
  variant: figureVariant({ pose, body, seat: 0, look }),
});

/** L2's terrace over the house with arcades (C3): at its south rail over the fountain, behind its shrubs. */
const ARCADE_ROOF: readonly StreetPropItem[] = [
  at(L2_TOP, 400.6, ARCADE_FRONT.minZ + 1.35, S, "stand", "a", 4),
  at(L2_TOP, 401.4, ARCADE_FRONT.minZ + 1.5, S + 0.35, "hips", "b", 9),
  at(L2_TOP, 396.4, ARCADE_FRONT.minZ + 2.7, S - 0.5, "smoke", "a", 14),
];

/** L2's south terrace before L3 (B1): at its rail behind the hedge, and two talking by its planters. */
const L2_FRONT: readonly StreetPropItem[] = [
  at(L2_TOP, 398.9, 5.5, S, "stand", "b", 17),
  at(L2_TOP, 405.3, 5.5, S + 0.2, "hips", "a", 21),
  at(L2_TOP, 410.2, 5.6, S - 0.25, "stand", "a", 26),
  at(L2_TOP, 418.2, 5.5, S, "hips", "b", 30),
  at(L2_TOP, 412.4, 8.9, E - 0.3, "stand", "b", 2),
  at(L2_TOP, 413.5, 9.2, W + 0.2, "smoke", "a", 7),
];

/** L2's terrace east of L3, over L1's east wing: one at its rail over the way to Lubartowska. */
const L2_EAST: readonly StreetPropItem[] = [at(L2_TOP, 431.2, 15.0, S + 0.4, "stand", "a", 11), at(L2_TOP, 434.3, 24.5, E, "hips", "b", 23)];

/** L3's roof: standing at the umbrellas' tables (`front-dress.ts`, a table 1 m square at x 402, 408, 414, 420) and at its south rail. */
const L3_ROOF: readonly StreetPropItem[] = [
  at(L3_TOP, 402, 14.15, N, "stand", "a", 5),
  at(L3_TOP, 402.85, 15, W, "hips", "b", 12),
  at(L3_TOP, 408, 15.65, N, "stand", "b", 19),
  at(L3_TOP, 414.85, 15, W, "stand", "a", 28),
  at(L3_TOP, 419.15, 16.5, E, "hips", "a", 1),
  at(L3_TOP, 420, 17.35, S, "stand", "b", 24),
  at(L3_TOP, 405.4, 13.4, S, "stand", "a", 31),
  at(L3_TOP, 416.9, 13.5, S + 0.3, "smoke", "b", 16),
];

/** Every figure on the front's terraces. */
export const TERRACE_PEOPLE: readonly StreetPropItem[] = [...ARCADE_ROOF, ...L2_FRONT, ...L2_EAST, ...L3_ROOF];
