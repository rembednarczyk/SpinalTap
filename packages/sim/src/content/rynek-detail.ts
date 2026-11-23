import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { againstWall } from "./lublin/places";
import { groundY } from "./lublin/terrain";

/*
 * The Rynek of the Old Town after its card (`docs/lokacje/rynek.md`, ADR-0102 point 5): what the market square needs
 * besides the landmark's recipe and the district's neons, as street pieces drawn with the furniture (vertices, not draw
 * calls). Pattern: environmental storytelling (Smith and Worch, GDC 2010), the one-page level of Librande (GDC 2010).
 *
 * - Tetsu's folding table of gadgets in front of DENKI drawn where its solid stands (`KANAL_PROPS`, the block no more
 *   drawn: `scenery`), humming from its power strip on a car battery (§17); the boxes and cables under DENKI's window.
 * - SAKE's door with its sake barrels, cups and empties; KARAOKE's with the chalk board of tonight's songs, the flyers
 *   and the butts of those who came out between songs (§14's clusters, at the fronts the district's neons hang on).
 * - The drinks machine of `enc_kanal_vending` (ink: „Automat z napojami przy DENKI”) where the encounter stands, and a
 *   lantern on the house at the mouth of Grodzka, the way out of the square lit (§13): the game's furniture, their
 *   solids with the street's (`RYNEK_FURNITURE`).
 */

/** Tetsu's table: the middle of its solid (`KANAL_PROPS`) and the facing of DENKI's front behind him. */
export const TETSU_TABLE = { x: 572.3, z: -32, yaw: againstWall(571.5, -31).yaw } as const;
/** The fronts the district's neons hang on: SAKE, KARAOKE, DENKI (`KANAL_PROPS`, `facadeNeon`). */
export const RYNEK_FRONTS = { sake: { x: 558.4, z: -85.1 }, karaoke: { x: 556, z: -36.5 }, denki: { x: 571, z: -29.5 } } as const;
/** The drinks machine of the vending encounter (`ENCOUNTERS`, `kanal_vending`, at (590, -10)). */
export const RYNEK_VENDING = againstWall(590, -10, 0.42);
/** The lantern on the house at the mouth of Grodzka out of the square (577, -23). */
export const GRODZKA_LANTERN = againstWall(577, -23, 0.05);

const model = (key: string, x: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: groundY(x, z), z, yaw, variant: roomDetailShape(key) });
/** A model at a front's foot, facing out of it. */
const atFront = (key: string, p: { readonly x: number; readonly z: number }): StreetPropItem => {
  const w = againstWall(p.x, p.z, 0.05);
  return model(key, w.at.x, w.at.z, w.yaw);
};

/** The machine and the lantern, the game's furniture with their solids. */
export const RYNEK_FURNITURE: readonly StreetPropItem[] = [
  { prop: "vending-machine", x: RYNEK_VENDING.at.x, y: RYNEK_VENDING.at.y, z: RYNEK_VENDING.at.z, yaw: RYNEK_VENDING.yaw, variant: 0 },
  { prop: "lamp-wall-lantern", x: GRODZKA_LANTERN.at.x, y: GRODZKA_LANTERN.at.y, z: GRODZKA_LANTERN.at.z, yaw: GRODZKA_LANTERN.yaw, variant: 1 },
];

/** The square's models (`tools/blender/rooms/rynek.py`) and its furniture, in the order of the card. */
export const RYNEK_DETAIL: readonly StreetPropItem[] = [
  model("rd-ry-table", TETSU_TABLE.x, TETSU_TABLE.z, TETSU_TABLE.yaw),
  atFront("rd-ry-denki", RYNEK_FRONTS.denki),
  atFront("rd-ry-sake", RYNEK_FRONTS.sake),
  atFront("rd-ry-karaoke", RYNEK_FRONTS.karaoke),
  ...RYNEK_FURNITURE,
];
