import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { W3_PALLETS } from "./hall-inside";
import { HALL_DOORS, TRACK_WALK_N } from "./layout";
import { W3_ASSEMBLY, W3_Y } from "./site";

/*
 * The detail of W-3's assembly hall after its card (`docs/pomieszczenia/w3-hall.md`, ADR-0098): the models Blender
 * builds (`tools/blender/rooms/w3_hall.py`), beside the engine's own dressing of the hall (the line's arms and
 * screens, the drones, the words). The pallets of parts draw their solids (`W3_PALLETS`, left out of the inside mesh);
 * the rest is drawn only, by the walls, on the walk and in the corners out of the line's way, so the hall's solids and
 * their ids stay. A model's front (+z) faces the world's +z at yaw 0, -z at π (its x along the world's -x), +x at π/2.
 * Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: W3_Y + y, z, yaw, variant: roomDetailShape(key) });

/** The assembly hall's walls' inner faces (0.3 m walls). */
const SOUTH = W3_ASSEMBLY.minZ + 0.3;
const NORTH = W3_ASSEMBLY.maxZ - 0.3;
const WEST = W3_ASSEMBLY.minX + 0.3;
/** The doors' signs over their 2.6 m openings. */
const OVER_DOOR = 2.75;

const pallets = (): StreetPropItem[] =>
  W3_PALLETS.map((p, i) => {
    const south = p.maxZ < (W3_ASSEMBLY.minZ + W3_ASSEMBLY.maxZ) / 2;
    return item(i % 2 === 0 ? "rd-w3h-pallet-crates" : "rd-w3h-pallet-sacks", (p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2, south ? 0 : Math.PI);
  });

export const W3_HALL_DETAIL: readonly StreetPropItem[] = [
  ...pallets(),
  // The pallet truck parked by the south wall between the pallets, the drums in the south-east corner.
  item("rd-w3h-jack", 2532.2, 0, 407.1, 0),
  item("rd-w3h-barrels", 2546.3, 0, 407.1, 0),
  // The leak by the north wall between the last pallet and the east door.
  item("rd-w3h-leak", 2543.5, 0, NORTH, Math.PI),
  // The cable tray along the south wall under the crane's track.
  item("rd-w3h-trays", (W3_ASSEMBLY.minX + W3_ASSEMBLY.maxX) / 2, 6.5, SOUTH, 0),
  // The night shift's thermos, sandwich and hard hat on the walk of track N.
  item("rd-w3h-break", 2523, 12, (TRACK_WALK_N.minZ + TRACK_WALK_N.maxZ) / 2 + 0.2, Math.PI),
  // Exit signs over the north doors; warning plates on the south, north and west walls.
  ...HALL_DOORS.map((x) => item("rd-w3h-exit", x, OVER_DOOR, NORTH, Math.PI)),
  item("rd-w3h-warning", 2533.2, 1.4, SOUTH, 0),
  item("rd-w3h-warning", 2535, 1.4, NORTH, Math.PI),
  item("rd-w3h-warning", WEST, 1.4, 424, Math.PI / 2),
];
