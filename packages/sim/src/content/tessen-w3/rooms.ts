import {
  BASEMENT,
  BASEMENT_CEILING,
  BASEMENT_FLOOR,
  CHAMBER_CEILING,
  CULVERT_CRAWL,
  CULVERT_FLIGHT,
  CULVERT_MOUTH,
  CULVERT_Z,
  GROUND_CEILING,
  HALL_CEILING,
  ROOF_UNDERSIDE,
} from "./layout";
import { W3_AIRLOCKS, W3_ASSEMBLY, W3_CHAMBER, W3_HALL_CUT, W3_ROW_N, W3_ROW_S, W3_Y, type W3Rect } from "./site";

/**
 * The hall and the basement as interiors (ADR-0061, ADR-0082 stage 2): boxes in the world, the
 * floor at `bottom`, the underside of the ceiling at `top` (the shape of `InteriorRoom`). Row S
 * steps along its cut south-west corner; the roofs (+10.4) are outside, under them is inside.
 */
export interface W3Room extends W3Rect {
  readonly bottom: number;
  readonly top: number;
}

const room = (r: W3Rect, bottom: number, top: number): W3Room => ({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, bottom: W3_Y + bottom, top: W3_Y + top });

const [cutA, cutB] = W3_HALL_CUT;
/** Row S west of the cut corner's foot in steps along it, each inside the facade. */
const rowSCorner = (): W3Room[] => {
  const steps = 3;
  const out: W3Room[] = [];
  for (let i = 0; i < steps; i++) {
    const x0 = cutA.x + ((cutB.x - cutA.x) * i) / steps;
    const x1 = cutA.x + ((cutB.x - cutA.x) * (i + 1)) / steps;
    // The cut's z at the step's west end: the step stays north of the facade all along it.
    const z0 = cutA.z + ((cutB.z - cutA.z) * (x0 - cutA.x)) / (cutB.x - cutA.x);
    out.push(room({ minX: x0, maxX: x1, minZ: z0, maxZ: W3_ROW_S.maxZ }, 0, GROUND_CEILING));
  }
  return out;
};

export const W3_HALL_ROOMS: readonly W3Room[] = [
  room(W3_ASSEMBLY, 0, HALL_CEILING),
  room(W3_CHAMBER, 0, CHAMBER_CEILING),
  room(W3_AIRLOCKS, 0, ROOF_UNDERSIDE),
  room(W3_ROW_N, 0, ROOF_UNDERSIDE),
  room({ minX: cutB.x, maxX: W3_ROW_S.maxX, minZ: W3_ROW_S.minZ, maxZ: W3_ROW_S.maxZ }, 0, GROUND_CEILING),
  ...rowSCorner(),
];

/** The basement, the culvert from its mouth and its flight down. */
export const W3_BASEMENT_ROOMS: readonly W3Room[] = [
  room(BASEMENT, BASEMENT_FLOOR, BASEMENT_CEILING),
  room({ minX: CULVERT_MOUTH.minX, maxX: CULVERT_FLIGHT.minX, ...CULVERT_Z }, CULVERT_CRAWL.floor, CULVERT_CRAWL.ceiling),
  room({ minX: CULVERT_FLIGHT.minX, maxX: CULVERT_FLIGHT.maxX, ...CULVERT_Z }, BASEMENT_FLOOR, CULVERT_CRAWL.ceiling),
];
