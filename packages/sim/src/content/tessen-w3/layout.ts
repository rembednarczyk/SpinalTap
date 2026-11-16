import type { W3Rect } from "./site";

/**
 * The hall's inside (ADR-0082 stage 2, the plan of picture 03 on the site of stage 1): numbers
 * shared by the rows, the line, the basement, the level graph and the tests. World x and z,
 * heights over the halls' floor `W3_Y`.
 *
 * Deviations from the ADR's first draft, forced by the site of stage 1:
 * - Nabrzeże's metro platform and its track lie under store S (x 2505..2515, z up to 405.3, its
 *   ceiling 2.5 m under the floor): the basement starts at x 2515, its stair A goes down from the
 *   parts line instead of store S, and the culvert runs along z 406..408 north of the platform,
 *   under the west yard and airlock S, not along z 399.5..401.5;
 * - the culvert ends in a flight down into the basement, not a ladder: a ladder's top would put
 *   a standing body into the culvert's crawl;
 * - the culvert's mouth is dug out of the river's bench (a `GroundCut`) up to where the bank over
 *   it is high enough for a room in the ground (`GroundVault`);
 * - the roof hatch over server room N moves to x 2564, clear of the fifth cooling unit;
 * - the walkers' second way out of the basement is a stair up into workshop W2.
 */

/**
 * Outer walls (inside the facades by `FACADE_GAP`) and partitions; the doors' leaves are as thick
 * as a partition, so the shoulder camera's shot (0.55 m right of the eye) never starts past one
 * from 0.4 m off it (G-275).
 */
export const WALL = 0.3;
export const PARTITION = 0.2;
/** The facades drawn by the map city stand this far outside the walls' faces: no z-fighting. */
export const FACADE_GAP = 0.04;
/** Top of every door opening and its width. */
export const DOOR_H = 2.6;
export const DOOR_W = 1.6;

/** The ground floor of the rows: its rooms' ceiling (underside) and the mezzanine's floor (top). */
export const GROUND_CEILING = 5;
export const MEZZANINE = 5.5;
/** The underside of the low roofs (row N, the airlocks, row S); their top is `W3_ROOF`. */
export const ROOF_UNDERSIDE = 10;
/** The assembly hall's and the test chamber's ceilings (underside), under their roof slabs. */
export const HALL_CEILING = 16;
export const CHAMBER_CEILING = 13.4;
/** The test chamber's walls are this thick (ADR-0082). */
export const CHAMBER_WALL = 0.8;

/** Row S: the rooms z 396..404 (their north wall at z 404), corridor S z 404..406. */
export const ROW_S_ROOMS = { minZ: 396, maxZ: 404 } as const;
/** Row S's partitions (x), west to east: store S | parts line | workshop W1 | W2 | armoury S | server room S. */
export const ROW_S_SPLITS: readonly number[] = [2514, 2530, 2538, 2546, 2558];
/** Row N: corridor N z 430..432, the rooms z 432..440. */
export const ROW_N_ROOMS = { minZ: 432, maxZ: 440 } as const;
/** Row N's partitions (x): stores N1 | N2 | module assembly | calibration | armoury N | server room N. */
export const ROW_N_SPLITS: readonly number[] = [2514, 2524, 2536, 2548, 2560];
/** The airlocks' partitions (z): personnel S | wagon | personnel N. */
export const AIRLOCK_SPLITS: readonly number[] = [413, 423];

/** The doors' middles (x along the corridors' walls, z along the airlocks'). */
export const DOORS_S = { store: 2504, line: 2527, w1: 2534, w2: 2543, armoury: 2552, server: 2565 } as const;
export const DOORS_N = { n1: 2508, n2: 2519, modules: 2530, calibration: 2542, armoury: 2554, server: 2566 } as const;
/** The corridors' doors into the assembly hall (both corridors), the airlocks' doors. */
export const HALL_DOORS: readonly number[] = [2512, 2546];
export const AIRLOCK_S_DOOR = 409.5;
export const AIRLOCK_N_DOOR = 426;
/** Corridor S's door into airlock S. */
export const AIRLOCK_S_CORRIDOR = 2505;

/**
 * The stair from airlock N up to the mezzanine: a flight along the airlock's north wall rising west
 * from the door in the hall's wall (x 2510) to a landing at the mezzanine's floor over the airlock's
 * north-west corner, which opens north onto the gallery.
 */
export const STAIR_N = { minX: 2502.3, maxX: 2509.7, minZ: 428, maxZ: 429.7 } as const;
export const STAIR_N_LANDING = { minX: 2500.3, maxX: 2502.3, minZ: 428, maxZ: 432.3 } as const;
export const STAIR_N_DOOR = { z: 428.85, width: 1.5 } as const;

/** The mezzanine (row N's upper floor): the gallery over the line z 430..436, its rooms z 436..440, x 2500..2560. */
export const MEZZANINE_RECT: W3Rect = { minX: 2500, maxX: 2560, minZ: 430, maxZ: 440 };
export const GALLERY_WALL = 436;
/** The gallery's rooms (x): the locker room | the shift manager's office | the technical room. */
export const MEZZANINE_SPLITS: readonly number[] = [2524, 2536];
export const MEZZANINE_DOORS: readonly number[] = [2512, 2530, 2548];
/** The gallery's windows onto the hall and over the test chamber (open, a sill 1 m over its floor). */
export const GALLERY_WINDOW = { bottom: 6.5, top: 8.5 } as const;
export const GALLERY_OVER_LINE = { from: 2511, to: 2547 } as const;
export const GALLERY_OVER_CHAMBER = { from: 2550, to: 2558 } as const;

/** The test chamber's gates: west from the hall, east onto the east yard (shut in v1). */
export const CHAMBER_GATE_W = { minZ: 415, maxZ: 421, height: 6 } as const;
export const CHAMBER_GATE_E = { minZ: 414, maxZ: 422, height: 6 } as const;
/** The wagon airlock opens onto the hall across its whole width, this high. */
export const WAGON_OPENING = 7.5;

/** The assembly line (ADR-0082): belts L1 and L2, their stations, the production aisle between them. */
export const BELT_X = { minX: 2513, maxX: 2545 } as const;
export const BELT_L1 = { minZ: 410, maxZ: 412 } as const;
export const BELT_L2 = { minZ: 424, maxZ: 426 } as const;
export const BELT_H = 1.2;
export const ARM_BASE = { size: 1.4, height: 1.8 } as const;
export const ARMS_X: readonly number[] = [2516, 2524, 2532, 2540];
export const STATIONS = {
  S1: { x: 2519, z: 412.8 },
  S2: { x: 2537, z: 412.8 },
  S3: { x: 2519, z: 423.2 },
  S4: { x: 2537, z: 423.2 },
} as const;
export const AISLE = { minZ: 413, maxZ: 423 } as const;

/** The crane's tracks at +12 along the hall's long walls, the walk on track N, the ladder up to it. */
export const CRANE_TRACK = 12;
export const TRACK_WALK_N = { minX: 2510.3, maxX: 2547.7, minZ: 428.5, maxZ: 429.7 } as const;
export const TRACK_LADDER = { key: "w3-track", x: 2520, z: 429.3 } as const;

/** The cooling units on row N's roof (3 x 2 x 1.4) and the hatch into server room N with its ladder. */
export const COOLERS_X: readonly number[] = [2520, 2532, 2544, 2556, 2568];
export const COOLER = { w: 3, d: 2, h: 1.4, z: 438 } as const;
export const ROOF_HATCH = { minX: 2563.4, maxX: 2564.6, minZ: 438.4, maxZ: 439.7 } as const;
export const HATCH_LADDER = { key: "w3-hatch", x: 2564, z: 439.3 } as const;

/** The basement under the parts line, the workshops, corridor S and the hall's south strip: its floor and ceiling (underside). */
export const BASEMENT: W3Rect = { minX: 2515, maxX: 2546, minZ: 396, maxZ: 408.4 };
export const BASEMENT_FLOOR = -4.5;
export const BASEMENT_CEILING = -0.4;
/** Stair A from the parts line down west into the basement; stair B from the basement up south into workshop W2. */
export const STAIR_A: W3Rect = { minX: 2517, maxX: 2525, minZ: 402, maxZ: 403.8 };
export const STAIR_B: W3Rect = { minX: 2539, maxX: 2541, minZ: 397.6, maxZ: 403.6 };
/** The goods lift's shaft from the basement up into the parts line, the player's ladder in it. */
export const LIFT_SHAFT: W3Rect = { minX: 2529.2, maxX: 2530.8, minZ: 400.2, maxZ: 401.8 };
export const SHAFT_LADDER = { key: "w3-shaft", x: 2530, z: 401.4 } as const;

/**
 * The culvert (P6): its mouth dug into the river's bench, the crawl under the terrace and store S,
 * the flight down into the basement. Floor and ceiling (underside) over `W3_Y`: 1.5 m to crawl and
 * 1.35 m under the headwall over the mouth's floor, for a crouching body of 1.26 m (a standing one
 * is 1.8 m); the ADR's ceiling at -0.2 left the mouth 1.25 m.
 */
export const CULVERT_Z = { minZ: 406.2, maxZ: 408.2 } as const;
export const CULVERT_MOUTH = { minX: 2462, maxX: 2472, floor: -1.45 } as const;
export const CULVERT_CRAWL = { minX: 2472, maxX: 2509, floor: -1.6, ceiling: -0.1 } as const;
export const CULVERT_FLIGHT = { minX: 2509, maxX: 2515 } as const;
