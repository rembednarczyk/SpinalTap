import {
  AIRLOCK_SPLITS,
  BASEMENT,
  BASEMENT_CEILING,
  BASEMENT_FLOOR,
  CHAMBER_CEILING,
  CHAMBER_WALL,
  CULVERT_CRAWL,
  CULVERT_FLIGHT,
  CULVERT_MOUTH,
  CULVERT_Z,
  FACADE_GAP,
  GALLERY_WALL,
  GROUND_CEILING,
  HALL_CEILING,
  MEZZANINE,
  MEZZANINE_SPLITS,
  PARTITION,
  ROOF_UNDERSIDE,
  ROW_N_ROOMS,
  ROW_N_SPLITS,
  ROW_S_ROOMS,
  ROW_S_SPLITS,
  STAIR_N_LANDING,
  WALL,
} from "./layout";
import { W3_AIRLOCKS, W3_ASSEMBLY, W3_CHAMBER, W3_HALL_CUT, W3_ROW_N, W3_ROW_S, W3_Y, type W3Rect } from "./site";

/**
 * The hall and the basement as interiors (ADR-0061, ADR-0082 stage 2): each room a box inside
 * its walls in the world, the floor at `bottom`, the underside of the ceiling at `top` (the
 * shape of `InteriorRoom`). Store S steps along the cut south-west corner inside its wall.
 */
export interface W3Room extends W3Rect {
  readonly bottom: number;
  readonly top: number;
}

const room = (minX: number, maxX: number, minZ: number, maxZ: number, bottom: number, top: number): W3Room => ({ minX, maxX, minZ, maxZ, bottom: W3_Y + bottom, top: W3_Y + top });

const t = WALL;
const p = PARTITION / 2;
const o = FACADE_GAP;
const S = W3_ROW_S;
const N = W3_ROW_N;
const A = W3_AIRLOCKS;
const H = W3_ASSEMBLY;
const C = W3_CHAMBER;

/** The rooms between a row's partitions, `x0`..`x1` across, `z0`..`z1` deep. */
const between = (splits: readonly number[], x0: number, x1: number, z0: number, z1: number, bottom: number, top: number): W3Room[] => {
  const xs = [x0, ...splits, x1];
  return xs.slice(1).map((b, i) => room(i === 0 ? x0 : (xs[i] as number) + p, i === xs.length - 2 ? x1 : b - p, z0, z1, bottom, top));
};

const [cutA, cutB] = W3_HALL_CUT;
/** Store S west of the cut corner's foot in steps, each north of the corner's 0.9 m wall. */
const storeCorner = (): W3Room[] => {
  const steps = 3;
  const inward = 1.2;
  const out: W3Room[] = [];
  for (let i = 0; i < steps; i++) {
    const x0 = S.minX + o + t + ((cutB.x - S.minX - o - t) * i) / steps;
    const x1 = S.minX + o + t + ((cutB.x - S.minX - o - t) * (i + 1)) / steps;
    const z0 = cutA.z + ((cutB.z - cutA.z) * (x0 - cutA.x)) / (cutB.x - cutA.x) + inward;
    out.push(room(x0, x1, z0, ROW_S_ROOMS.maxZ - p, 0, GROUND_CEILING));
  }
  return out;
};

const rowS = (): W3Room[] => {
  const [store, ...rest] = between(ROW_S_SPLITS, S.minX + o + t, S.maxX - o - t, S.minZ + o + t, ROW_S_ROOMS.maxZ - p, 0, GROUND_CEILING);
  return [
    { ...(store as W3Room), minX: cutB.x + 1 },
    ...storeCorner(),
    ...rest,
    room(S.minX + o + t, S.maxX - o - t, ROW_S_ROOMS.maxZ + p, S.maxZ - t, 0, GROUND_CEILING),
  ];
};

const rowN = (): W3Room[] => [
  ...between(ROW_N_SPLITS, N.minX + t, N.maxX - t, ROW_N_ROOMS.minZ + p, N.maxZ - t, 0, GROUND_CEILING).map((r, i, all) => (i === all.length - 1 ? { ...r, top: W3_Y + ROOF_UNDERSIDE } : r)),
  room(STAIR_N_LANDING.maxX, N.maxX - t, N.minZ + t, ROW_N_ROOMS.minZ - p, 0, GROUND_CEILING),
  room(N.minX + t, (ROW_N_SPLITS[ROW_N_SPLITS.length - 1] as number) - p, N.minZ + t, GALLERY_WALL - p, MEZZANINE, ROOF_UNDERSIDE),
  ...between(MEZZANINE_SPLITS, N.minX + t, (ROW_N_SPLITS[ROW_N_SPLITS.length - 1] as number) - p, GALLERY_WALL + p, N.maxZ - t, MEZZANINE, ROOF_UNDERSIDE),
];

export const W3_HALL_ROOMS: readonly W3Room[] = [
  room(H.minX + t, H.maxX - t, H.minZ + t, H.maxZ - t, 0, HALL_CEILING),
  room(C.minX + CHAMBER_WALL, C.maxX - CHAMBER_WALL, C.minZ + CHAMBER_WALL, C.maxZ - CHAMBER_WALL, 0, CHAMBER_CEILING),
  ...[A.minZ + t, ...AIRLOCK_SPLITS, A.maxZ - t].slice(1).map((z1, i, all) => {
    const z0 = [A.minZ + t, ...AIRLOCK_SPLITS][i] as number;
    return room(A.minX + t, A.maxX - t, i === 0 ? z0 : z0 + p, i === all.length - 1 ? z1 : z1 - p, 0, ROOF_UNDERSIDE);
  }),
  ...rowS(),
  ...rowN(),
];

/** The basement, the culvert from its mouth and its flight down. */
export const W3_BASEMENT_ROOMS: readonly W3Room[] = [
  room(BASEMENT.minX, BASEMENT.maxX, BASEMENT.minZ, BASEMENT.maxZ, BASEMENT_FLOOR, BASEMENT_CEILING),
  room(CULVERT_MOUTH.minX, CULVERT_FLIGHT.minX, CULVERT_Z.minZ, CULVERT_Z.maxZ, CULVERT_CRAWL.floor, CULVERT_CRAWL.ceiling),
  room(CULVERT_FLIGHT.minX, CULVERT_FLIGHT.maxX, CULVERT_Z.minZ, CULVERT_Z.maxZ, BASEMENT_FLOOR, CULVERT_CRAWL.ceiling),
];
