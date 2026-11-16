import type { Vec3 } from "@seki/core";
import { DOORS_N, HALL_DOORS, MEZZANINE, ROW_N_ROOMS, ROW_N_SPLITS } from "./layout";
import { w3 } from "./site";

/**
 * W-3's job "Odbiór partii" in the hall (ADR-0082 §1, §2 "Patrole i posterunki", stage 3): the
 * calibration core's terminal in server room N, the room's camera, the patrols of the hall and the
 * mezzanine and the wagon airlock's guard. Pure numbers; the contract's templates spawn them.
 */

/** The core's terminal at the back of server room N: the foot of its desk, towards the door. */
export const W3_VIRUS_TERMINAL: Vec3 = w3(2566, 0, 437.1);

/** Server room N, inside its walls: the camera's no-go zone during the sabotage. */
export const W3_SERVER_N = { minX: ROW_N_SPLITS[ROW_N_SPLITS.length - 1] as number, maxX: 2572, minZ: ROW_N_ROOMS.minZ, maxZ: ROW_N_ROOMS.maxZ } as const;

/** The camera in server room N's south-east corner under its ceiling, looking at the core's terminal (NW). */
export const W3_SERVER_CAMERA = { position: w3(2571.4, 3.6, 432.6), yaw: -0.88 } as const;

const [WEST_DOOR, EAST_DOOR] = HALL_DOORS as [number, number];
/** Corridor N's middle (z) and the production aisle's line the patrol walks. */
const CORRIDOR_N = 431;
const AISLE = 418;

/**
 * P1, the hall's patrol: up the aisle from the wagon airlock to the chamber's gate, through the
 * corridor's east door, back west along corridor N and down its west door; on every second lap it
 * goes on along the corridor to server room N's door and back. Both legs between the hall and the
 * corridor go through the doors' middles.
 */
export const W3_PATROL_HALL: readonly [Vec3, ...Vec3[]] = [
  w3(WEST_DOOR, 0, AISLE),
  w3(EAST_DOOR, 0, AISLE),
  w3(EAST_DOOR, 0, CORRIDOR_N),
  w3(WEST_DOOR, 0, CORRIDOR_N),
  w3(WEST_DOOR, 0, AISLE),
  w3(EAST_DOOR, 0, AISLE),
  w3(EAST_DOOR, 0, CORRIDOR_N),
  w3(DOORS_N.server, 0, CORRIDOR_N),
  w3(WEST_DOOR, 0, CORRIDOR_N),
];

/** P2, the mezzanine's patrol: along the gallery from the stair's landing to the window over the chamber and back. */
export const W3_PATROL_MEZZANINE: readonly [Vec3, ...Vec3[]] = [w3(2503.5, MEZZANINE, 433.5), w3(2557, MEZZANINE, 433.5)];

/** The wagon airlock's guard, inside it, looking east down the aisle. */
export const W3_AIRLOCK_POST: Vec3 = w3(2505, 0, 418);

/** The guard of armoury S, by its inner door, looking into the room (south). */
export const W3_ARMOURY_POST: Vec3 = w3(2552, 0, 402.6);
