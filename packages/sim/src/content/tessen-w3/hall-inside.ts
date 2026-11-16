import { type DoorDef, type StaticProp, ladderParts, v } from "../builders";
import { box, doorGap, indoor, railing, wallX, wallZ } from "./parts";
import {
  AIRLOCK_N_DOOR,
  AIRLOCK_S_DOOR,
  ARM_BASE,
  ARMS_X,
  BELT_H,
  BELT_L1,
  BELT_L2,
  BELT_X,
  CHAMBER_CEILING,
  CHAMBER_GATE_E,
  CHAMBER_GATE_W,
  CHAMBER_WALL,
  CRANE_TRACK,
  DOOR_H,
  DOOR_W,
  FACADE_GAP,
  GALLERY_OVER_CHAMBER,
  GALLERY_OVER_LINE,
  GALLERY_WINDOW,
  GROUND_CEILING,
  HALL_CEILING,
  HALL_DOORS,
  STAIR_N_DOOR,
  STATIONS,
  TRACK_LADDER,
  TRACK_WALK_N,
  WAGON_OPENING,
  WALL,
} from "./layout";
import { W3_ASSEMBLY, W3_CHAMBER, W3_ROOF, W3_Y, w3 } from "./site";

/**
 * The assembly hall and the test chamber inside (ADR-0082 stage 2, picture 02 and 03): the
 * walls' inner faces (up to the low roofs they hide the facades of the parts either side, over
 * them they stand inside the hall's own facade), the ceilings, belts L1 and L2 with four arms
 * each and the stations S1-S4 by the production aisle, pallets of parts by the walls, the
 * crane's tracks at +12 with the walk on track N and its ladder, the crane's bridge; the test
 * chamber's 0.8 m walls, its gate from the hall and its gate onto the east yard (shut in v1).
 */

const A = W3_ASSEMBLY;
const C = W3_CHAMBER;
const R = W3_ROOF;
const t = WALL;
const o = FACADE_GAP;

/** The assembly hall's walls: across the facades up to the low roofs, inside its own over them. */
const assemblyWalls = (): StaticProp[] => {
  const top = HALL_CEILING;
  const window = { from: GALLERY_OVER_LINE.from, to: GALLERY_OVER_LINE.to, top: GALLERY_WINDOW.top };
  return [
    // South: corridor S's wall (row S) up to its ceiling, this over it.
    ...wallX(A.minX - t, A.maxX, A.minZ - t, A.minZ + t, GROUND_CEILING + 0.3, R),
    ...wallX(A.minX + o, A.maxX - o, A.minZ + o, A.minZ + o + t, R, top),
    // North: corridor N's south wall and the gallery's, its doors and the gallery's window.
    ...wallX(A.minX - t, A.maxX - t, A.maxZ - t, A.maxZ + t, 0, GALLERY_WINDOW.bottom, HALL_DOORS.map((x) => doorGap(x, DOOR_W, DOOR_H))),
    ...wallX(A.minX - t, A.maxX - t, A.maxZ - t, A.maxZ + t, GALLERY_WINDOW.bottom, R, [window]),
    ...wallX(A.minX + o, A.maxX - o, A.maxZ - o - t, A.maxZ - o, R, top),
    // West: the airlocks' doors and the wagon airlock open across.
    ...wallZ(A.minZ + t, A.maxZ - t, A.minX - t, A.minX + t, 0, R, [
      doorGap(AIRLOCK_S_DOOR, DOOR_W, DOOR_H),
      { from: 413.1, to: 422.9, top: WAGON_OPENING },
      doorGap(AIRLOCK_N_DOOR, DOOR_W, DOOR_H),
      doorGap(STAIR_N_DOOR.z, STAIR_N_DOOR.width, DOOR_H),
    ]),
    ...wallZ(A.minZ + o, A.maxZ - o, A.minX + o, A.minX + o + t, R, top),
    // East over the chamber's roof.
    box(A.maxX - o - t, A.maxX - o, CHAMBER_CEILING, top, A.minZ + o, A.maxZ - o, "concrete"),
    box(A.minX + o + t, A.maxX - o - t, top - 0.3, top, A.minZ + o + t, A.maxZ - o - t, "concrete"),
  ];
};

/** The test chamber's thick walls (one across the hall's east facade), its window from the gallery, its ceiling. */
const chamberWalls = (): StaticProp[] => {
  const w = CHAMBER_WALL;
  const top = CHAMBER_CEILING;
  const window = { from: GALLERY_OVER_CHAMBER.from, to: GALLERY_OVER_CHAMBER.to, top: GALLERY_WINDOW.top };
  return [
    ...wallZ(C.minZ - t, C.maxZ + t, C.minX - t, C.minX + w, 0, top, [{ from: CHAMBER_GATE_W.minZ, to: CHAMBER_GATE_W.maxZ, top: CHAMBER_GATE_W.height }]),
    ...wallX(C.minX + w, C.maxX - o, C.minZ - t, C.minZ + w, 0, R),
    ...wallX(C.minX + w, C.maxX - o, C.minZ + o, C.minZ + w, R, top),
    ...wallX(C.minX + w, C.maxX - o, C.maxZ - w, C.maxZ + t, 0, GALLERY_WINDOW.bottom),
    ...wallX(C.minX + w, C.maxX - o, C.maxZ - w, C.maxZ + t, GALLERY_WINDOW.bottom, R, [window]),
    ...wallX(C.minX + w, C.maxX - o, C.maxZ - w, C.maxZ - o, R, top),
    ...wallZ(C.minZ + w, C.maxZ - w, C.maxX - w, C.maxX - o, 0, top, [{ from: CHAMBER_GATE_E.minZ, to: CHAMBER_GATE_E.maxZ, top: CHAMBER_GATE_E.height }]),
    // The shut gate's leaves stand in the facade's doorway, in front of the lining: drawn from afar with the outer walls.
    box(C.maxX - o, C.maxX + 0.1, 0, CHAMBER_GATE_E.height, CHAMBER_GATE_E.minZ, CHAMBER_GATE_E.maxZ, "metal"),
    box(C.minX + w, C.maxX - w, top - 0.3, top, C.minZ + w, C.maxZ - w, "concrete"),
    // The launch area's pad on the floor, under a knee.
    box(2557, 2563, 0, 0.3, 415, 421, "metal"),
  ];
};

/**
 * The chamber's gate from the hall (anyone may pass); the one onto the east yard is shut till the
 * drones fly (ADR-0082), a still pair of leaves in its opening (`chamberWalls`).
 */
export const W3_CHAMBER_DOORS: readonly DoorDef[] = [
  { key: "door:w3-chamber-w", at: w3(C.minX + 0.25, 0, (CHAMBER_GATE_W.minZ + CHAMBER_GATE_W.maxZ) / 2), along: "z", width: CHAMBER_GATE_W.maxZ - CHAMBER_GATE_W.minZ, height: CHAMBER_GATE_W.height, leaves: 2, thickness: 0.2 },
];

/** The line: the belts (cover for one crouching), the arms' bases on the far side of each, the stations by the aisle, pallets. */
const line = (): StaticProp[] => {
  const s = ARM_BASE.size;
  const h = ARM_BASE.height;
  const belt = (z0: number, z1: number) => box(BELT_X.minX, BELT_X.maxX, 0, BELT_H, z0, z1, "metal");
  const station = (x: number, z0: number, z1: number) => box(x - 0.6, x + 0.6, 0, 1.1, z0, z1, "metal");
  return [
    belt(BELT_L1.minZ, BELT_L1.maxZ),
    belt(BELT_L2.minZ, BELT_L2.maxZ),
    ...ARMS_X.map((x) => box(x - s / 2, x + s / 2, 0, h, BELT_L1.minZ - 0.1 - s, BELT_L1.minZ - 0.1, "metal")),
    ...ARMS_X.map((x) => box(x - s / 2, x + s / 2, 0, h, BELT_L2.maxZ + 0.1, BELT_L2.maxZ + 0.1 + s, "metal")),
    station(STATIONS.S1.x, BELT_L1.maxZ, BELT_L1.maxZ + 0.5),
    station(STATIONS.S2.x, BELT_L1.maxZ, BELT_L1.maxZ + 0.5),
    station(STATIONS.S3.x, BELT_L2.minZ - 0.5, BELT_L2.minZ),
    station(STATIONS.S4.x, BELT_L2.minZ - 0.5, BELT_L2.minZ),
    // Pallets of parts (1.4 m) by the long walls, clear of the doors and the ladder.
    box(2527, 2529.4, 0, 1.4, 406.6, 407.8, "metal"),
    box(2535, 2537.4, 0, 1.4, 406.6, 407.8, "metal"),
    box(2530, 2532.4, 0, 1.4, 428.3, 429.5, "metal"),
    box(2538, 2540.4, 0, 1.4, 428.3, 429.5, "metal"),
  ];
};

/** The crane's tracks at +12 along both long walls, the walk on track N with its rail. */
const crane = (): StaticProp[] => {
  const k = CRANE_TRACK;
  const w = TRACK_WALK_N;
  const hole = { minX: TRACK_LADDER.x - 0.7, maxX: TRACK_LADDER.x + 0.7 };
  return [
    box(A.minX + 0.3, A.maxX - 0.3, k - 0.5, k - 0.2, A.minZ + 0.3, A.minZ + 0.8, "metal"),
    box(w.minX, hole.minX, k - 0.2, k, w.minZ, w.maxZ, "metal"),
    box(hole.maxX, w.maxX, k - 0.2, k, w.minZ, w.maxZ, "metal"),
    railing(w.minX, w.maxX, w.minZ - 0.1, w.minZ, k),
    railing(w.maxX - 0.1, w.maxX, w.minZ, w.maxZ, k),
  ];
};

/**
 * The crane's bridge over the tracks (no solid; the simulation does not know it moves): the
 * renderer draws it on the line's moving mesh, travelling along x between `minX` and `maxX`,
 * at rest at `x` (ADR-0082 §3.8). Heights over the halls' floor.
 */
export const W3_CRANE_BRIDGE = { x: 2530, minX: 2513, maxX: 2545, width: 1.2, bottom: CRANE_TRACK + 0.1, top: CRANE_TRACK + 0.9, minZ: A.minZ + 0.6, maxZ: A.maxZ - 0.6 } as const;

/** The ladder up to the walk on track N, against the hall's north wall. */
const trackLadder = (): StaticProp[] => {
  const l = TRACK_LADDER;
  return ladderParts({ key: l.key, x: l.x, z: l.z, yaw: 0, bottom: W3_Y, top: W3_Y + CRANE_TRACK, exit: v(l.x + 1.4, W3_Y + CRANE_TRACK, TRACK_WALK_N.minZ + 0.6) });
};

/** The assembly hall and the test chamber inside, the track's ladder. */
export const W3_HALL_INSIDE_PROPS: readonly StaticProp[] = [...indoor([...assemblyWalls(), ...chamberWalls(), ...line(), ...crane()]), ...trackLadder()];
