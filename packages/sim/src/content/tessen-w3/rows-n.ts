import { type DoorDef, type StaticProp, ladderParts, stairRail, stairs, v } from "../builders";
import { box, doorGap, indoor, merged, railing, wallX, wallZ } from "./parts";
import {
  DOOR_H,
  DOOR_W,
  DOORS_N,
  GALLERY_WALL,
  GROUND_CEILING,
  HATCH_LADDER,
  MEZZANINE,
  MEZZANINE_DOORS,

  MEZZANINE_SPLITS,
  PARTITION,
  ROOF_HATCH,
  ROOF_UNDERSIDE,
  ROW_N_ROOMS,
  ROW_N_SPLITS,
  STAIR_N,
  STAIR_N_LANDING,
  WALL,
} from "./layout";
import { LOCKDOWN } from "./rows-s";
import { W3_ROOF, W3_ROW_N, W3_Y, w3 } from "./site";

/**
 * Row N of the hall (ADR-0082 stage 2, picture 03): on the ground floor corridor N along the
 * hall's north wall and off it stores N1 and N2, the module assembly, calibration (three
 * stations), armoury N (shut for good in v1) and server room N, the silent way's goal, two
 * storeys high with the ladder up to the roof hatch; over them the mezzanine (+5.5): the
 * gallery over the line and the test chamber, the locker room, the shift manager's office and
 * the technical room, up the stair from airlock N.
 */

const N = W3_ROW_N;

const x0 = N.minX + WALL;
const x1 = N.maxX - WALL;
const zN = N.maxZ - WALL;
const corridor = ROW_N_ROOMS.minZ;
const p = PARTITION / 2;
const serverX = ROW_N_SPLITS[ROW_N_SPLITS.length - 1] as number;
/** Corridor N's west end, by the landing over it. */
const corridorWest = STAIR_N_LANDING.maxX;

const door = (key: string, x: number, z: number, y = 0, lock?: DoorDef["lock"]): DoorDef => ({
  key: `door:w3-${key}`,
  at: w3(x, y, z),
  along: "x",
  width: DOOR_W,
  height: DOOR_H,
  leaves: 1,
  thickness: PARTITION,
  ...(lock ? { lock } : {}),
});

/** Row N's doors: off corridor N, onto the mezzanine's rooms. */
export const W3_ROW_N_DOORS: readonly DoorDef[] = [
  door("store-n1", DOORS_N.n1, corridor),
  door("store-n2", DOORS_N.n2, corridor),
  door("modules", DOORS_N.modules, corridor),
  door("calibration", DOORS_N.calibration, corridor),
  door("armoury-n", DOORS_N.armoury, corridor, 0, { kind: "sealed" }),
  door("server-n", DOORS_N.server, corridor, 0, LOCKDOWN),
  ...MEZZANINE_DOORS.map((x, i) => door(`mezzanine-${i + 1}`, x, GALLERY_WALL, MEZZANINE)),
];

/** The ground floor: corridor N's north wall, its west end, the partitions, the mezzanine's floor over them. */
const groundFloor = (): StaticProp[] => [
  ...wallX(corridorWest, x1, corridor - p, corridor + p, 0, GROUND_CEILING, [DOORS_N.n1, DOORS_N.n2, DOORS_N.modules, DOORS_N.calibration, DOORS_N.armoury, DOORS_N.server].map((x) => doorGap(x, DOOR_W, DOOR_H))),
  // Server room N goes up to the roof: its wall onto the corridor's end does too.
  box(serverX, x1, GROUND_CEILING, ROOF_UNDERSIDE, corridor - p, corridor + p, "concrete"),
  box(corridorWest - PARTITION, corridorWest, 0, GROUND_CEILING, N.minZ + WALL, corridor - p, "concrete"),
  // Airlock N's north wall: under the landing up to the ground floor's ceiling, east of it to the roof.
  box(x0, corridorWest, 0, GROUND_CEILING, N.minZ - WALL, N.minZ + WALL, "concrete"),
  box(corridorWest, STAIR_N.maxX + 0.3, 0, ROOF_UNDERSIDE, N.minZ - WALL, N.minZ + WALL, "concrete"),
  ...ROW_N_SPLITS.flatMap((x) => wallZ(corridor + p, zN, x - p, x + p, 0, x === serverX ? ROOF_UNDERSIDE : GROUND_CEILING)),
  // The partition over corridor N's end, closing the mezzanine at its east end.
  box(serverX - p, serverX + p, GROUND_CEILING, ROOF_UNDERSIDE, N.minZ + WALL, corridor + p, "concrete"),
  // The mezzanine's floor over the ground floor's rooms and corridor; the ceiling over corridor N's east end.
  box(x0, serverX - p, GROUND_CEILING, MEZZANINE, N.minZ + WALL, zN, "concrete"),
  box(serverX + p, x1, GROUND_CEILING, GROUND_CEILING + 0.3, N.minZ + WALL, corridor - p, "concrete"),
];

/** The mezzanine: the gallery's back wall with the rooms' doors, the rooms' partitions. */
const mezzanine = (): StaticProp[] => [
  ...wallX(x0, serverX - p, GALLERY_WALL - p, GALLERY_WALL + p, MEZZANINE, ROOF_UNDERSIDE, MEZZANINE_DOORS.map((x) => doorGap(x, DOOR_W, MEZZANINE + DOOR_H))),
  ...MEZZANINE_SPLITS.flatMap((x) => wallZ(GALLERY_WALL + p, zN, x - p, x + p, MEZZANINE, ROOF_UNDERSIDE)),
];

/** The stair up from airlock N: the flight rising west along its north wall, its rail, the landing and its rails. */
const stair = (): StaticProp[] => {
  const s = STAIR_N;
  const l = STAIR_N_LANDING;
  const y = (h: number) => W3_Y + h;
  return [
    stairs(s.minX, s.maxX, s.minZ, s.maxZ, y(0), y(MEZZANINE), "x", -1),
    stairRail(s.minX, s.maxX, s.minZ - 0.12, s.minZ, y(0), y(MEZZANINE), "x", -1),
    box(l.minX, l.maxX, GROUND_CEILING, MEZZANINE, l.minZ, N.minZ + WALL, "metal"),
    railing(l.minX, l.maxX, l.minZ - 0.12, l.minZ, MEZZANINE),
  ];
};

/** The rooms' furniture: racks in the stores, the module benches, calibration's three stations, server racks and the core's terminal. */
const furniture = (): StaticProp[] => {
  const back = zN;
  return [
    box(2501, 2512.5, 0, 2.6, back - 0.9, back, "metal"),
    box(2515, 2523, 0, 2.6, back - 0.9, back, "metal"),
    box(2525, 2535, 0, 0.95, back - 1, back, "metal"),
    ...[2538.5, 2542, 2545.5].map((x) => box(x - 0.6, x + 0.6, 0, 1.1, back - 1, back - 0.3, "metal")),
    // Server room N: racks along its walls, the calibration core's terminal at the back.
    box(2560.6, 2561.4, 0, 2.2, 433.2, 439, "metal"),
    box(2570.6, 2571.4, 0, 2.2, 433.2, 437.6, "metal"),
    box(2565.4, 2566.6, 0, 1.2, 437.6, 438.4, "metal"),
    // The mezzanine: lockers, the shift manager's desk, a cabinet in the technical room.
    box(2501, 2523, MEZZANINE, MEZZANINE + 2, back - 0.6, back, "metal"),
    box(2528.5, 2531.5, MEZZANINE, MEZZANINE + 0.8, 437.6, 438.6, "metal"),
    box(2552, 2559.5, MEZZANINE, MEZZANINE + 2, back - 0.8, back, "metal"),
  ];
};

/** Server room N's ladder up to the roof hatch, its top beside the hatch on the roof. */
const hatchLadder = (): StaticProp[] => {
  const l = HATCH_LADDER;
  const h = ROOF_HATCH;
  return [
    ...ladderParts({ key: l.key, x: l.x, z: l.z, yaw: 0, bottom: W3_Y, top: W3_Y + W3_ROOF, exit: v(l.x, W3_Y + W3_ROOF, h.minZ - 0.6) }),
    // The hatch's curb on the roof (its north side is the parapet) and its lid, open on the west.
    box(h.minX - 0.15, h.minX, W3_ROOF, W3_ROOF + 0.5, h.minZ - 0.15, h.maxZ, "metal"),
    box(h.maxX, h.maxX + 0.15, W3_ROOF, W3_ROOF + 0.5, h.minZ - 0.15, h.maxZ, "metal"),
    box(h.minX, h.maxX, W3_ROOF, W3_ROOF + 0.5, h.minZ - 0.15, h.minZ, "metal"),
  ];
};

/** Row N inside: the ground floor, the mezzanine, the stair, the furniture; the hatch's ladder. */
export const W3_ROW_N_PROPS: readonly StaticProp[] = [...indoor([...groundFloor(), ...mezzanine(), ...stair(), ...furniture()]), ...merged(hatchLadder())];
