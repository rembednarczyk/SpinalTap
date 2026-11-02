import type { Vec3 } from "@seki/core";
import type { StaticProp } from "./builders";
import { type GroundRect } from "./lublin/shape";
import { ROOM_STOREY, type RoomSite, rawHeight } from "./lublin/sites";

/**
 * A capsule room to let (ADR-0063 stage 3): the ground floor of the tenement at Jezuicka 14 in the
 * Old Town (OSM way 66286373, `building=apartments`, three storeys), opposite Wieża Trynitarska,
 * its door in the street facade facing south. The room is cut into the building as
 * the clinic and Neon Koi are (ADR-0045): the building keeps its storeys over the room's storey,
 * its facade gets a doorway. No story: a place to walk into, with the autosave of ADR-0061.
 *
 * The furniture is the model of `room-props.glb` (igor.tesV's Futuristic Compact Room, CC-BY 4.0,
 * tools/city_room.py): the kitchen run along the west wall, the bed alcove under the wall cabinets
 * at the back, a chest. The simulation has its solids as boxes after the model (a body does not
 * walk through the bed) and the shell the model leaves open: the front wall with the door, the
 * east and back walls, the ceiling under the storeys above and the floor. All of them are drawn by
 * the engine's capsule room with the model (`scenery`: no entity views), only near the room, so
 * the street's draw calls stay as they were.
 *
 * Model coordinates are the glTF's in metres: x east, y up from the floor, z towards the door (the
 * model's open side; the world's south). `capsulePoint` turns them into the world.
 */

/** Middle of the room's floor in the world, x and z. */
const CX = 593.6;
/**
 * The facade the door is in, straightened onto this z (as the clinic's, ADR-0045). The map's wall
 * runs from z -134.3 at its west corner to -134.5 at x 598.7; straight on the line of its east end,
 * no sliver of the old wall is left in front of the room (it would stand full height in the door).
 */
const FRONT = -134.5;
/** Inner half-width (x) and half-depth (z) of the room, and its clear height: the model's box and a few centimetres. */
export const CAPSULE_HALF_WIDTH = 1.86;
export const CAPSULE_HALF_DEPTH = 2.24;
export const CAPSULE_CEILING = 2.8;
/** The facade stands this far in front of the room's front wall; the walls' thickness. */
const FACADE_GAP = 0.04;
const FRONT_WALL = 0.26;
const WALL = 0.2;
/** The door: its middle in model x, its width and height. */
const DOOR_X = 0.2;
const DOOR_WIDTH = 1.2;
const DOOR_HEIGHT = 2.3;

const INNER_FRONT = FRONT + FACADE_GAP + FRONT_WALL;
const CZ = INNER_FRONT + CAPSULE_HALF_DEPTH;
const BACK = CZ + CAPSULE_HALF_DEPTH;

/** The cut in the tenement: the room and its walls. */
const RECT: GroundRect = { minX: CX - CAPSULE_HALF_WIDTH - WALL, maxX: CX + CAPSULE_HALF_WIDTH + WALL, minZ: FRONT, maxZ: BACK + WALL };

/** The floor: 2 cm over the highest ground of the cut (the terrain there rises some 10 cm to the back), in cm. */
const floorOver = (r: GroundRect): number => {
  let top = -Infinity;
  for (let x = r.minX; x <= r.maxX + 1e-6; x += 0.5) for (let z = r.minZ; z <= r.maxZ + 1e-6; z += 0.5) top = Math.max(top, rawHeight(x, z));
  return Math.ceil((top + 0.02) * 100) / 100;
};

/** The room in the tenement, as the clinic's and the bar's (`RoomSite`); the facade faces south. */
export const CAPSULE_SITE: RoomSite = { building: "w66286373", front: FRONT, faces: -1, rect: RECT, floor: floorOver(RECT) };

const FLOOR = CAPSULE_SITE.floor;

/** A point of the model (glTF metres, from the middle of the floor) in the world. */
export const capsulePoint = (x: number, y: number, z: number): Vec3 => ({ x: CX + x, y: FLOOR + y, z: CZ - z });

/** Where the model stands: the middle of the room's floor; its door side (glTF +z) faces south. */
export const CAPSULE_ORIGIN: Vec3 = capsulePoint(0, 0, 0);

/** The door in the front wall, at the middle of the wall's thickness, on the floor. */
export const CAPSULE_DOOR = { at: { x: CX + DOOR_X, y: FLOOR, z: FRONT + FACADE_GAP + FRONT_WALL / 2 }, width: DOOR_WIDTH, height: DOOR_HEIGHT } as const;

/** A solid box of the room between world corners (x, y over the floor, z), drawn by the engine. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): StaticProp => ({
  center: { x: (x0 + x1) / 2, y: FLOOR + (y0 + y1) / 2, z: (z0 + z1) / 2 },
  view: { kind: "block", size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 }, material: "concrete", interior: true },
  solid: true,
  interior: true,
  scenery: true,
});

/** A box of the model's furniture between model corners (glTF metres). */
const piece = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): StaticProp => {
  const a = capsulePoint(x0, y0, z0);
  const b = capsulePoint(x1, y1, z1);
  return box(Math.min(a.x, b.x), Math.max(a.x, b.x), y0, y1, Math.min(a.z, b.z), Math.max(a.z, b.z));
};

const doorL = CX + DOOR_X - DOOR_WIDTH / 2;
const doorR = CX + DOOR_X + DOOR_WIDTH / 2;
const frontZ0 = FRONT + FACADE_GAP;

/** The walls up to the cut storey's top, with the door in the front one. */
export const CAPSULE_WALLS: readonly StaticProp[] = [
  box(RECT.minX, doorL, 0, ROOM_STOREY, frontZ0, INNER_FRONT),
  box(doorR, RECT.maxX, 0, ROOM_STOREY, frontZ0, INNER_FRONT),
  box(doorL, doorR, DOOR_HEIGHT, ROOM_STOREY, frontZ0, INNER_FRONT),
  box(RECT.minX, CX - CAPSULE_HALF_WIDTH, 0, ROOM_STOREY, INNER_FRONT, RECT.maxZ),
  box(CX + CAPSULE_HALF_WIDTH, RECT.maxX, 0, ROOM_STOREY, INNER_FRONT, RECT.maxZ),
  box(CX - CAPSULE_HALF_WIDTH, CX + CAPSULE_HALF_WIDTH, 0, ROOM_STOREY, BACK, RECT.maxZ),
];

/** The ceiling under the storeys above, and the floor the room stands on (its top is the room's floor). */
export const CAPSULE_CEILING_SLAB: StaticProp = box(CX - CAPSULE_HALF_WIDTH, CX + CAPSULE_HALF_WIDTH, CAPSULE_CEILING, ROOM_STOREY, INNER_FRONT, BACK);
export const CAPSULE_FLOOR_SLAB: StaticProp = box(RECT.minX, RECT.maxX, -0.3, 0, frontZ0, RECT.maxZ);

/**
 * The model's furniture as solids (tools/city_room.py, model metres): the kitchen run along the
 * west wall up to its counter, the bed alcove with the bookcase at its foot, the chest by the east
 * wall. The wall cabinets hang over the bed, out of a standing body's way.
 */
export const CAPSULE_FURNITURE: readonly StaticProp[] = [
  piece(-1.86, -1.22, 0, 0.95, -1.48, 2.21),
  piece(-1.22, 1.86, 0, 1.0, -2.24, -0.23),
  piece(0.8, 1.78, 0, 0.5, -0.1, 0.5),
];

/** Every solid of the room, in the order their ids are given. */
export const CAPSULE_PROPS: readonly StaticProp[] = [...CAPSULE_WALLS, CAPSULE_CEILING_SLAB, CAPSULE_FLOOR_SLAB, ...CAPSULE_FURNITURE];

/**
 * The room as an area of ADR-0061 (an `InteriorRoom` of `interior-areas.ts`, which lists it): inside
 * the walls, from the floor to the ceiling.
 */
export const CAPSULE_INTERIOR_ROOM: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly bottom: number; readonly top: number } = {
  minX: CX - CAPSULE_HALF_WIDTH,
  maxX: CX + CAPSULE_HALF_WIDTH,
  minZ: INNER_FRONT,
  maxZ: BACK,
  bottom: FLOOR,
  top: FLOOR + CAPSULE_CEILING,
};
