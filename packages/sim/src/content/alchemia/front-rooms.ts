import { type ActivityId, type StreetPropItem, type Vec3, figureVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { FRONT_CEILINGS, FRONT_FLOORS } from "./front-levels";
import { barSeats, cafeTable, cartonsAt, cupAt, inBox, litterAt, model, servicesRun, solidOnly, wayLights, windowBar } from "./front-fit";
import { shopHash } from "./shop-fittings";
import type { Piece } from "./plan";

/*
 * The front's arcades and its café furnished (ADR-0093 O5, `docs/zasady-lokacji.md` §2-§5): L1's west
 * wing's arcade from the house with arcades to T0 and L2's spine from the gallery's door to the glass
 * over the square, its cross arcade east and west, the corner by the drinks machines, and the café
 * KISSA NEKO behind the glass over the square, the board's lit tables behind the front's glass. Three
 * layers: the services under the ceilings (pipes, cable trays, strips of light), the game's machines,
 * benches and planters, a counter with its coffee machine, cake case and shelves, tables and chairs;
 * cups, cartons and flyers. A trace of somebody just gone in each (a cup steaming, a chair knocked
 * over, a phone left on a table). The way to the doors lit green in the floor (§4).
 */

const L1 = FRONT_FLOORS.l1;
const L2 = FRONT_FLOORS.l2;
const C1 = FRONT_CEILINGS.l1;
const C2 = FRONT_CEILINGS.l2;

const N = 0;
const S = Math.PI;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/** A neon name on a room's wall or over its counter (proper names, the same in every language, ADR-0056): drawn by the engine's letters. */
export interface VenueSign {
  readonly text: string;
  /** Its plane: along x at `at` = z (facing ±z by `out`), or along z at `at` = x. */
  readonly axis: "x" | "z";
  readonly at: number;
  readonly a0: number;
  readonly a1: number;
  readonly y0: number;
  readonly y1: number;
  readonly out: 1 | -1;
  readonly color: "neon-amber" | "neon-pink" | "neon-red" | "neon-cyan";
}

/** L1's west wing's arcade (x 400.2-403.8): the services, the way lit to its three doors, machines and a bench along its east glass. */
const l1Arcade = (): Piece[] => [
  ...servicesRun(400.2, 403.8, 1.6, 27.0, C1, 3.0),
  ...wayLights(403.45, 403.45, 2.2, 26.6, L1),
  ...litterAt("l1-arcade-door", 401.3, 2.6, L1, 5),
  ...litterAt("l1-north-door", 401.3, 26.4, L1, 3),
  ...cartonsAt("l1-bay", 398.8, 26.5, L1, 3),
  ...cartonsAt("l1-bay-2", 399.5, 26.7, L1, 1),
  // A cup steaming on the bench, a cable taped across the ceiling to the cabinet (§3, §5).
  ...cupAt(403.45, 17.5, L1 + 0.45, true),
  inBox(403.5, 403.55, 23.3, 23.7, L1 + 1.15, C1, "cable"),
];
const L1_PROPS: readonly StreetPropItem[] = [
  model("vending-machine", 403.4, L1, 5.2, W, 3),
  model("vending-machine", 403.4, L1, 6.3, W, 6),
  model("atm", 403.45, L1, 8.4, W, 0),
  model("waste-bin", 403.5, L1, 9.6, W, 1),
  model("bench", 403.45, L1, 18.0, W, 0),
  model("street-cabinet", 403.55, L1, 23.5, W, 0),
  model("planter", 402.9, L1, 3.9, 0, 5),
  model("shrubs", 402.9, L1 + 0.45, 3.9, 1.1, 0x316),
];

/** The window bar in the corner south-east of L2's cross, along its east bar's south glass (z 13.7 inside). */
const SE_BAR = { x0: 422.3, x1: 433.6, z: 13.7 } as const;

/** Still figures (ADR-0058) at the glass: on the window bar's stools, every other one by a hash, and at the café's tables by the glass. */
const glassSitters = (): StreetPropItem[] => [
  ...barSeats(SE_BAR.x0, SE_BAR.x1, SE_BAR.z, 1).flatMap((s, i) =>
    shopHash("l2-window", i, 7) < 0.55 ? [model("figure", s.x, L2, s.z, S, figureVariant({ pose: "sit", body: shopHash("l2-window", i, 8) < 0.5 ? "a" : "b", seat: 0.75, look: Math.floor(shopHash("l2-window", i, 9) * 32) }))] : [],
  ),
  ...[4, 5, 6].map((t, i) => model("figure", CAFE_TABLES_X[t]! - 0.62, L2, CAFE_ROWS[0], E, figureVariant({ pose: "sit", body: i % 2 === 0 ? "b" : "a", seat: 0.45, look: 5 + i * 9 }))),
];

/** The café KISSA NEKO behind L2's glass over the square (x 394.2-416.6, z 4.2-10.6): its counter at its west end, two rows of tables. */
const CAFE_TABLES_X = [399.8, 402.4, 405.0, 407.6, 410.2, 412.8, 415.4] as const;
const CAFE_ROWS = [5.4, 8.9] as const;
const cafe = (): Piece[] => {
  const out: Piece[] = [
    // The counter along z, the barista's side west of it; its cake case and coffee machine on it, the menu over it.
    inBox(396.4, 397.2, 6.0, 10.2, L2 - 0.05, L2 + 1.05, "counter", true),
    inBox(396.5, 397.1, 8.6, 9.8, L2 + 1.05, L2 + 1.4, "vitrine"),
    inBox(396.55, 397.05, 8.7, 9.7, L2 + 1.08, L2 + 1.18, "food"),
    inBox(396.5, 397.0, 6.3, 6.9, L2 + 1.05, L2 + 1.5, "machine"),
    ...cupAt(396.8, 7.3, L2 + 1.05, true),
    ...cupAt(396.7, 7.6, L2 + 1.05, false),
    inBox(396.75, 396.85, 6.4, 9.6, L2 + 2.35, L2 + 2.95, "display"),
    inBox(396.79, 396.81, 6.4, 6.45, L2 + 2.95, C2, "cable"),
    inBox(396.79, 396.81, 9.55, 9.6, L2 + 2.95, C2, "cable"),
    // Shelves of cups, tins and bottles along the glass behind it, its box a solid.
    solidOnly(394.3, 394.75, 6.0, 10.2, L2 - 0.05, L2 + 2.2),
    inBox(394.3, 394.34, 6.0, 10.2, L2, L2 + 2.2, "rack"),
    ...[0.4, 0.85, 1.3, 1.75].flatMap((h, i) => [
      inBox(394.3, 394.75, 6.0, 10.2, L2 + h, L2 + h + 0.03, "rack"),
      ...[6.2, 6.9, 7.5, 8.3, 9.0, 9.6].filter((_, k) => (k + i) % 4 !== 3).map((z, k) => inBox(394.38, 394.7, z, z + 0.4 + ((k * 7 + i) % 3) * 0.1, L2 + h + 0.03, L2 + h + 0.2 + ((k + i) % 3) * 0.08, "goods")),
    ]),
    // Lamps hanging over the tables, warm, on their cables.
    ...CAFE_TABLES_X.flatMap((x) => CAFE_ROWS.flatMap((z) => [inBox(x - 0.17, x + 0.17, z - 0.17, z + 0.17, L2 + 2.25, L2 + 2.6, "lantern"), inBox(x - 0.01, x + 0.01, z - 0.01, z + 0.01, L2 + 2.6, C2, "cable")])),
    ...servicesRun(397.5, 416.6, 6.6, 8.0, C2, 0),
    // The tables (one's chair knocked over, a phone left lit on another: somebody just ran).
    ...CAFE_TABLES_X.flatMap((x, i) => CAFE_ROWS.flatMap((z, k) => cafeTable(x, z, L2, i === 3 && k === 1 ? ["x-"] : ["x-", "x+"], (i + k) % 3 === 0))),
    inBox(408.0, 408.85, 9.2, 9.6, L2, L2 + 0.42, "chair"),
    inBox(410.3, 410.42, 5.2, 5.38, L2 + 0.76, L2 + 0.775, "display"),
    inBox(404.8, 405.3, 8.75, 9.1, L2 + 0.76, L2 + 0.78, "paper"),
    ...litterAt("cafe", 406.0, 7.3, L2, 4),
  ];
  return out;
};
const CAFE_PROPS: readonly StreetPropItem[] = [
  ...glassSitters(),
  // The barista behind the counter: a still figure of the game's, as the shops' sellers.
  model("figure", 395.6, L2, 8.0, E, figureVariant({ pose: "stand", body: "b", seat: 0, look: 13 })),
  model("waste-bin", 398.0, L2, 10.25, N, 2),
];

/** L2's spine and cross arcade: the services, the way lit from the gallery's door, benches and planters in the cross, the corner with the machines. */
const l2Arcade = (): Piece[] => [
  ...servicesRun(416.6, 421.8, 4.6, 31.6, C2, 3.0),
  ...servicesRun(394.6, 435.4, 17.6, 21.6, C2, 3.0),
  ...wayLights(416.9, 416.9, 4.8, 31.8, L2),
  ...wayLights(421.5, 421.5, 4.8, 31.8, L2),
  ...wayLights(395.0, 435.0, 21.3, 21.3, L2),
  // A delivery left before OKAMI ARMS, flyers by the gallery's door.
  ...cartonsAt("l2-delivery", 425.4, 20.9, L2, 3),
  ...cartonsAt("l2-delivery-2", 426.1, 21.0, L2, 2),
  ...litterAt("l2-door", 419.2, 30.6, L2, 5),
  ...litterAt("l2-corner", 427.0, 15.5, L2, 4),
  // The window bar along the east bar's south glass, over the walk to Lubartowska (the board's people at L2's lit glass).
  ...windowBar("l2-window", SE_BAR.x0, SE_BAR.x1, SE_BAR.z, 1, L2),
  // On the spine's walls (the units' sides): ad screens, flyers pasted over flyers, a cable taped up to a screen (§3).
  inBox(416.6, 416.66, 12.2, 15.6, L2 + 1.3, L2 + 2.7, "machine"),
  inBox(416.66, 416.68, 12.3, 15.5, L2 + 1.36, L2 + 2.64, "display"),
  inBox(416.6, 416.66, 24.0, 27.4, L2 + 1.3, L2 + 2.7, "machine"),
  inBox(416.66, 416.68, 24.1, 27.3, L2 + 1.36, L2 + 2.64, "display"),
  inBox(416.62, 416.64, 26.0, 26.04, L2 + 2.7, C2, "cable"),
  ...[22.4, 23.0, 28.3, 28.8, 29.6, 30.4].map((z, i) => inBox(421.76, 421.8, z, z + 0.42, L2 + 1.0 + (i % 3) * 0.25, L2 + 1.6 + (i % 3) * 0.25, "paper")),
  ...[10.9, 11.4, 16.2].map((z, i) => inBox(416.6, 416.64, z, z + 0.42, L2 + 1.1 + i * 0.2, L2 + 1.7 + i * 0.2, "paper")),
  // Lanterns over the bench at the spine's south end by the glass over the square: seen from the square under the screen.
  ...[418.2, 419.4, 420.6].flatMap((x) => [inBox(x - 0.17, x + 0.17, 5.4, 5.74, L2 + 2.3, L2 + 2.65, "lantern"), inBox(x - 0.01, x + 0.01, 5.56, 5.58, L2 + 2.65, C2, "cable")]),
];
const L2_PROPS: readonly StreetPropItem[] = [
  model("bench", 408.0, L2, 19.6, N, 0),
  model("bench", 428.0, L2, 19.6, N, 0),
  model("planter", 395.4, L2, 19.6, 0, 3),
  model("shrubs", 395.4, L2 + 0.45, 19.6, 0.7, 0x412),
  model("planter", 420.4, L2, 7.0, 0, 9),
  model("shrubs", 420.4, L2 + 0.45, 7.0, 2.3, 0x51a),
  model("bench", 419.4, L2, 4.75, S, 1),
  // The corner south-east of the cross: drinks and cash by its east glass, a planter, the window bar's people (`SE_BAR`).
  model("vending-machine", 435.4, L2, 16.0, W, 2),
  model("vending-machine", 435.4, L2, 17.05, W, 7),
  model("atm", 435.45, L2, 18.2, W, 1),
  model("planter", 433.6, L2, 16.6, 0, 11),
  model("shrubs", 433.6, L2 + 0.45, 16.6, 4.1, 0x214),
];

/** The front's arcades and café: drawn pieces with the solids not drawn among them (`drawnOnly`). */
export const frontRoomPieces = (): Piece[] => [...l1Arcade(), ...cafe(), ...l2Arcade()];
/** The game's models in them. */
export const FRONT_ROOM_PROPS: readonly StreetPropItem[] = [...L1_PROPS, ...CAFE_PROPS, ...L2_PROPS];

/** The café's name over its counter, facing the tables. */
export const FRONT_ROOM_SIGNS: readonly VenueSign[] = [{ text: "KISSA NEKO", axis: "z", at: 397.3, a0: 6.3, a1: 9.9, y0: L2 + 3.05, y1: L2 + 3.45, out: 1, color: "neon-amber" }];

const CHUNK = "krakowskie-2-1";
const spot = (at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => ({ chunk: CHUNK, at, yaw, does, indoor: true });

/** The arcades' and the café's still crowd (ADR-0060): at the machines, talking in the cross, at the café's tables and counter, at the glass over the square. */
export const FRONT_ROOM_CROWD: readonly CrowdSpot[] = [
  spot({ x: 402.6, y: L1, z: 5.8 }, E, ["phone"]),
  spot({ x: 401.6, y: L1, z: 14.6 }, S, ["talk", "phone"]),
  spot({ x: 398.0, y: L2, z: 7.6 }, W, ["talk"]),
  spot({ x: CAFE_TABLES_X[1] - 0.62, y: L2, z: CAFE_ROWS[0] }, E, ["sit"]),
  spot({ x: CAFE_TABLES_X[1] + 0.62, y: L2, z: CAFE_ROWS[0] }, W, ["sit"]),
  spot({ x: CAFE_TABLES_X[4] - 0.62, y: L2, z: CAFE_ROWS[1] }, E, ["sit"]),
  spot({ x: CAFE_TABLES_X[6] + 0.62, y: L2, z: CAFE_ROWS[0] }, W, ["sit"]),
  spot({ x: 417.4, y: L2, z: 5.3 }, S, ["lean", "phone"]),
  spot({ x: 410.6, y: L2, z: 20.6 }, W, ["talk"]),
  spot({ x: 425.3, y: L2, z: 15.3 }, S, ["phone", "talk"]),
  spot({ x: 419.6, y: L2, z: 25.4 }, E, ["phone", "talk"]),
];
