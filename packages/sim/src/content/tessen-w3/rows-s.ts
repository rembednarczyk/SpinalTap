import type { StreetPropItem } from "@seki/core";
import type { DoorDef, StaticProp } from "../builders";
import type { DoorLock } from "../../world/components";
import { barrierLine, barrierSolids, box, doorGap, indoor, wallX, wallZ } from "./parts";
import {
  AIRLOCK_N_DOOR,
  AIRLOCK_S_CORRIDOR,
  AIRLOCK_S_DOOR,
  AIRLOCK_SPLITS,
  DOOR_H,
  DOOR_W,
  DOORS_S,
  FACADE_GAP,
  GROUND_CEILING,
  HALL_DOORS,
  PARTITION,
  ROOF_UNDERSIDE,
  ROW_S_ROOMS,
  ROW_S_SPLITS,
  STAIR_N_DOOR,
  WALL,
} from "./layout";
import { W3_AIRLOCKS, W3_HALL_CUT, W3_ROW_S, W3_Y, w3 } from "./site";

/**
 * Row S of the hall (ADR-0082 stage 2, picture 03): along the south facade store S (with the
 * basement's stair), the parts line, workshops W1 and W2 (the basement's second stair), armoury S
 * (its outer door shut till stage 3 gives it the job's code) and server room S, their doors off
 * corridor S; and the airlocks' strip: personnel airlock S, the wagon airlock open onto the hall,
 * personnel airlock N (its stair up to the mezzanine is row N's). The rooms are 5 m high under a ceiling;
 * the airlocks rise to the roof. Every block is part of the interior, drawn merged.
 */

const S = W3_ROW_S;
const A = W3_AIRLOCKS;
const H = GROUND_CEILING + 0.3;
const [cutA, cutB] = W3_HALL_CUT;
/** The cut corner's wall: its middle this far in from the facade, thick enough for the ceiling's steps to end in it. */
const CUT_IN = 0.5;

const door = (key: string, x: number, z: number, along: "x" | "z", lock?: DoorLock, width = DOOR_W): DoorDef => ({
  key: `door:w3-${key}`,
  at: w3(x, 0, z),
  along,
  width,
  height: DOOR_H,
  leaves: width > 2 ? 2 : 1,
  thickness: PARTITION,
  ...(lock ? { lock } : {}),
});

/**
 * The lockdown's lock (ADR-0082 §3, prepared for stage 3): the server rooms' doors open to anyone
 * till the running job's alarm goes up, then shut and stay shut.
 */
export const LOCKDOWN: DoorLock = { kind: "alarm" };

const corridorZ = ROW_S_ROOMS.maxZ;
const northZ = S.maxZ;

/** Row S's and the airlocks' doors. */
export const W3_ROW_S_DOORS: readonly DoorDef[] = [
  door("store-s", DOORS_S.store, corridorZ, "x"),
  door("parts-line", DOORS_S.line, corridorZ, "x", undefined, 2.4),
  door("workshop-1", DOORS_S.w1, corridorZ, "x"),
  door("workshop-2", DOORS_S.w2, corridorZ, "x"),
  // Stage 3 gives the armoury's doors the job's code (`during: "sabotage"`); till then the outer one is a shut leaf (`shell`).
  door("armoury-s", DOORS_S.armoury, corridorZ, "x"),
  door("server-s", DOORS_S.server, corridorZ, "x", LOCKDOWN),
  door("corridor-s-airlock", AIRLOCK_S_CORRIDOR, northZ, "x"),
  ...HALL_DOORS.map((x, i) => door(`corridor-s-hall-${i + 1}`, x, northZ, "x")),
  door("airlock-s-out", A.minX + WALL / 2, AIRLOCK_S_DOOR, "z"),
  door("airlock-n-out", A.minX + WALL / 2, AIRLOCK_N_DOOR, "z"),
  door("airlock-s-hall", A.maxX, AIRLOCK_S_DOOR, "z"),
  door("airlock-n-hall", A.maxX, AIRLOCK_N_DOOR, "z"),
  door("stair-n", A.maxX, STAIR_N_DOOR.z, "z", undefined, STAIR_N_DOOR.width),
];

/** The cut corner's wall line, `CUT_IN` in from the facade, from the west wall to the south wall. */
const cutNormal = (() => {
  const [dx, dz] = [cutB.x - cutA.x, cutB.z - cutA.z];
  const len = Math.hypot(dx, dz);
  return { x: -dz / len, z: dx / len };
})();
const cutLine = [
  { x: cutA.x + cutNormal.x * CUT_IN, z: cutA.z + cutNormal.z * CUT_IN },
  { x: cutB.x + cutNormal.x * CUT_IN, z: cutB.z + cutNormal.z * CUT_IN },
];
/** The z of the cut corner's wall line at x. */
const cutZ = (x: number): number => {
  const [p, q] = cutLine as [{ x: number; z: number }, { x: number; z: number }];
  return p.z + ((x - p.x) * (q.z - p.z)) / (q.x - p.x);
};

/** The cut corner's inner wall, a 0.9 m wall the map's way (drawn with the furniture). */
export const W3_CUT_WALL: readonly StreetPropItem[] = barrierLine("city-wall", H, cutLine, () => W3_Y, "concrete");

/**
 * Store S's floor along the cut corner (P1): the zone's pad stops at the fence's steps, so the
 * terrain under the corner rises up to 0.6 m a metre in from the facade. Dug level to the floor
 * (`GroundCut`) in 1 m steps whose edges end inside the corner's wall, and floored with a slab.
 */
const FLOOR_STEPS = 9;
export const W3_STORE_FLOOR: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = (() => {
  // From under the west wall's lining: it stands on the levelled floor too.
  const west = S.minX + FACADE_GAP;
  const w0 = cutLine[1]!.x;
  const xs = Array.from({ length: FLOOR_STEPS + 1 }, (_, i) => west + ((w0 - west) * i) / FLOOR_STEPS);
  return [
    ...xs.slice(1).map((x1, i) => ({ minX: xs[i] as number, maxX: x1, minZ: cutZ(((xs[i] as number) + x1) / 2), maxZ: northZ - WALL })),
    { minX: w0, maxX: ROW_S_SPLITS[0] as number, minZ: S.minZ + FACADE_GAP + WALL, maxZ: corridorZ },
  ];
})();

/** Row S's shell inside the facade: the outer walls, corridor S's walls, the partitions, the ceiling, store S's floor. */
const shell = (): StaticProp[] => {
  const o = FACADE_GAP;
  const south = S.minZ + o;
  const east = S.maxX - o;
  const west = S.minX + o;
  const t = WALL;
  const p = PARTITION / 2;
  const [w0, w1] = [cutLine[1]!.x, cutLine[0]!.z];
  const bands = Array.from({ length: 9 }, (_, i) => west + t + ((w0 - west - t) * i) / 9);
  return [
    ...wallX(w0, east, south, south + t, 0, H, [doorGap(DOORS_S.armoury, DOOR_W, DOOR_H)]),
    // The shut leaf stands in the facade's doorway, in front of the lining: drawn from afar with the outer walls.
    box(DOORS_S.armoury - DOOR_W / 2, DOORS_S.armoury + DOOR_W / 2, 0, DOOR_H, S.minZ - 0.1, south, "metal"),
    ...wallZ(south, northZ - t, east - t, east, 0, H),
    ...wallZ(w1, northZ - t, west, west + t, 0, H),
    // Corridor S: its south wall with the rooms' doors, its north wall with the airlock's and the hall's doors.
    ...wallX(west + t, east - t, corridorZ - p, corridorZ + p, 0, H, [
      doorGap(DOORS_S.store, DOOR_W, DOOR_H),
      doorGap(DOORS_S.line, 2.4, DOOR_H),
      doorGap(DOORS_S.w1, DOOR_W, DOOR_H),
      doorGap(DOORS_S.w2, DOOR_W, DOOR_H),
      doorGap(DOORS_S.armoury, DOOR_W, DOOR_H),
      doorGap(DOORS_S.server, DOOR_W, DOOR_H),
    ]),
    ...wallX(west + t, 2548, northZ - t, northZ + t, 0, H, [AIRLOCK_S_CORRIDOR, ...HALL_DOORS].map((x) => doorGap(x, DOOR_W, DOOR_H))),
    ...ROW_S_SPLITS.flatMap((x) => wallZ(south + t, corridorZ - p, x - p, x + p, 0, H)),
    // The ceiling: whole east of the cut corner, in 1 m steps along it (each ending inside its wall).
    box(w0, east - t, GROUND_CEILING, H, south + t, northZ - t, "concrete"),
    ...bands.map((x0, i) => box(x0, bands[i + 1] ?? w0, GROUND_CEILING, H, cutZ((x0 + (bands[i + 1] ?? w0)) / 2), northZ - t, "concrete")),
    ...W3_STORE_FLOOR.map((r) => box(r.minX, r.maxX, -0.25, -0.01, r.minZ, r.maxZ, "concrete")),
  ];
};

/** The rooms' furniture: racks in store S, benches on the parts line and in the workshops, the armoury's racks and crates, server racks. */
const furniture = (): StaticProp[] => {
  const back = S.minZ + FACADE_GAP + WALL;
  return [
    // Store S: racks along its back wall east of the cut corner, a crate of parts.
    box(2510, 2513.8, 0, 2.4, back, back + 0.8, "metal"),
    box(2508.4, 2510, 0, 1.2, 400.2, 401.4, "metal"),
    // The parts line: two benches along the back wall.
    box(2515, 2521, 0, 0.95, back, back + 0.9, "metal"),
    box(2523, 2528.8, 0, 0.95, back, back + 0.9, "metal"),
    // Workshops: a bench in W1, a lathe in W2 east of its stair.
    box(2531, 2536.8, 0, 0.95, back, back + 0.9, "metal"),
    box(2531, 2532.2, 0, 1.4, 401.5, 403.3, "metal"),
    box(2543.6, 2545.6, 0, 1.3, back, back + 1.1, "metal"),
    // Armoury S: gun racks on its east and west walls, the arms chest and the charges' case.
    box(2546.2, 2546.8, 0, 2, 397.4, 402.8, "metal"),
    box(2557.2, 2557.8, 0, 2, 397.4, 402.8, "metal"),
    box(2550.6, 2553.4, 0, 0.8, back + 0.2, back + 1.1, "metal"),
    box(2554.4, 2555.6, 0, 0.9, 400.4, 401.2, "metal"),
    // Server room S: two rows of racks, the cooling's cabinet.
    box(2560, 2570.4, 0, 2.2, 398.4, 399.2, "metal"),
    box(2560, 2570.4, 0, 2.2, 401.2, 402, "metal"),
    box(2570.6, 2571.3, 0, 2.2, 397, 398.2, "metal"),
  ];
};

/**
 * The airlocks: their partitions to the roof, the wall onto corridor S above its ceiling, lockers
 * in airlock S either side of its outer door.
 */
const airlocks = (): StaticProp[] => {
  const x0 = A.minX + WALL;
  const x1 = A.maxX - WALL;
  const p = PARTITION / 2;
  const top = ROOF_UNDERSIDE;
  return [
    ...AIRLOCK_SPLITS.flatMap((z) => wallX(x0, x1, z - p, z + p, 0, top)),
    box(x0, x1, H, top, A.minZ - WALL, A.minZ + WALL, "concrete"),
    box(x0, x0 + 0.5, 0, 2, 406.6, 408.6, "metal"),
    box(x0, x0 + 0.5, 0, 2, 410.4, 412.6, "metal"),
  ];
};

/** Row S and the airlocks, inside: the shell, the furniture, the cut corner's wall's solids. */
export const W3_ROW_S_PROPS: readonly StaticProp[] = [...indoor([...shell(), ...furniture(), ...airlocks()]), ...barrierSolids(W3_CUT_WALL)];
