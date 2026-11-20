import type { Vec3 } from "@seki/core";
import { DOORS_N, HALL_DOORS, MEZZANINE, MEZZANINE_DOORS, ROOF_UNDERSIDE, ROW_N_ROOMS, ROW_N_SPLITS } from "./layout";
import { W3_CABIN, W3_ROW_N, W3_Y, w3 } from "./site";

/**
 * W-3's job "Odbiór partii" in the hall (ADR-0082 §1, §2 "Patrole i posterunki", stage 3): the
 * calibration core's terminal in server room N, the room's camera, the patrols of the hall and the
 * mezzanine and the wagon airlock's guard; on the pipes' way (Q2, G-908) row N roof's two cameras
 * and the observer in the tower's cabin. Pure numbers; the contract's templates spawn them.
 */

/** The core's terminal at the back of server room N: the foot of its desk, towards the door. */
export const W3_VIRUS_TERMINAL: Vec3 = w3(2566, 0, 437.1);

/** Server room N, inside its walls: the camera's no-go zone during the sabotage. */
export const W3_SERVER_N = { minX: ROW_N_SPLITS[ROW_N_SPLITS.length - 1] as number, maxX: 2572, minZ: ROW_N_ROOMS.minZ, maxZ: ROW_N_ROOMS.maxZ } as const;

/**
 * The camera in server room N's north-west corner under its ceiling, over the west rack, looking
 * south-east at the door and the front of the core's terminal (decision of 16.11): whoever comes
 * in is seen, but the corner between the terminal and the east rack's end is out of its cone.
 */
export const W3_SERVER_CAMERA = { position: w3(2561.8, 3.6, 438.8), yaw: 2.59 } as const;

/** The camera's dead angle by the terminal, on the east rack's side: in the upload's reach, out of the cone. */
export const W3_CORE_BLIND_SPOT: Vec3 = w3(2568.6, 0, 438.4);

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

/**
 * The shift manager (ADR-0082 §1 p. 2, G-929), the hall's enforcer of disguises: from his desk in
 * his office on the mezzanine out of its door onto the gallery, across it to the window over the
 * line by x 2540, back from the window and along the gallery to his door. Away from the window he
 * keeps 4 m back from it (its sill 1 m over the gallery's floor), so he sees nothing of the hall's
 * floor; at the window (user's decision of 17.11) he halts once a lap looking down over the line,
 * then a step back turns his back to it. The aisle is crossed by timing that halt.
 */
const [, OFFICE_DOOR] = MEZZANINE_DOORS as [number, number, number];
const GALLERY_BACK = 435;
/** The window's halt: a body's radius off the hall's wall (its face at z 430.3), over station S2's end of the line. */
export const W3_MANAGER_WINDOW = { x: 2540, look: 430.95, back: 430.72 } as const;
export const W3_PATROL_MANAGER: readonly [Vec3, ...Vec3[]] = [
  // In front of his desk (x 2528.5..2531.5 from z 437.6), facing his door.
  w3(OFFICE_DOOR, MEZZANINE, 437.15),
  w3(OFFICE_DOOR, MEZZANINE, GALLERY_BACK),
  // At the window he faces the next point, the hall's way; on the step back, the gallery's.
  w3(W3_MANAGER_WINDOW.x, MEZZANINE, W3_MANAGER_WINDOW.look),
  w3(W3_MANAGER_WINDOW.x, MEZZANINE, W3_MANAGER_WINDOW.back),
  w3(W3_MANAGER_WINDOW.x, MEZZANINE, GALLERY_BACK),
  w3(OFFICE_DOOR, MEZZANINE, GALLERY_BACK),
];

/** The wagon airlock's guard, inside it, looking east down the aisle. */
export const W3_AIRLOCK_POST: Vec3 = w3(2505, 0, 418);

/** The guard of armoury S, by its inner door, looking into the room (south). */
export const W3_ARMOURY_POST: Vec3 = w3(2552, 0, 402.6);

/** Row N's roof, over its underside: the roof cameras' no-go zone during the sabotage (Q2, G-908). */
export const W3_ROOF_N = { minX: W3_ROW_N.minX, maxX: W3_ROW_N.maxX, minZ: W3_ROW_N.minZ, maxZ: W3_ROW_N.maxZ, floor: W3_Y + ROOF_UNDERSIDE } as const;

/**
 * Row N roof's two cameras (ADR-0082 §2) on its north parapet, looking out along the roof from its
 * middle: the west one towards the tower's bridge, the east one at the hatch over server room N.
 * Each misses the strip along the hall's wall short of its range and the roof behind it; the
 * cooling units shade the north side. The hatch is in the east one's view: `reboot_optics` it first.
 */
export const W3_ROOF_CAMERAS = [
  { key: "dev:w3-roof-cam-w", position: w3(2530, 11.5, 440), yaw: -Math.PI / 2 },
  { key: "dev:w3-roof-cam-e", position: w3(2556, 11.5, 440), yaw: Math.PI / 2 },
] as const;

/**
 * The observer in the tower's cabin (ADR-0082 §2, `tessen_sniper` with 40 m of sight, no shot
 * before the alarm): at its east panes, looking over the pickup yard and row N's roof and round
 * between them. The cabin's floor hides the bridge under it.
 */
export const W3_OBSERVER = { at: w3(W3_CABIN.maxX - 0.7, W3_CABIN.floor, 441), yaw: 1.0, period: 16 } as const;
