import type { GroundPoint, Vec3 } from "@seki/core";

/**
 * Sector W-3, Tessen's drone assembly halls on the Bystrzyca (ADR-0082, variant A "Brama nad
 * korytem"), on the ground of the old docks: the shapes of the site in world metres (x east,
 * z north), heights over the halls' floor `W3_Y`. The numbers are the curator's corrections
 * P1-P13 of the audit (docs/plany/tessen-w3-audyt.md), which overrule the ADR's first draft:
 * - the fence keeps 3 m off the riverside path (OSM w972606056) and its link to the bridge
 *   (w1551242473), and the hall's south-west corner is cut along it (P1);
 * - no pad on the public strip by the metro; the zone's pad meets the terrace over a retaining
 *   wall under the fence (P2);
 * - the quay only along z 418.5..440, a wall about 1.3 m high, the natural bench of the river
 *   instead of a shelf, a culvert x 2466..2514, the pier z 426..438, the tower z 436..446, the
 *   basin x 2508..2592 joined to the river along its north-west corner (P3-P10);
 * - the water at -2.0 (NMT -30.6), as the river draped on the terrain (P9).
 * Pure numbers: the terrain (`lublin/sites.ts`) and the props (`tessen-w3/*.ts`) read them.
 */

/** The halls' floor: the ground of the zone, levelled (the old docks' `DOCKS_PLACE.y`). */
export const W3_Y = -28.6;
/** The Bystrzyca and the basin (NMT median by the bridge and in the bend, audit P9). */
export const W3_WATER_Y = W3_Y - 2;
/** Floor of the basin dug off the river. */
export const W3_BASIN_FLOOR = W3_Y - 3;

/** A point of W-3: world x and z, `y` metres over the halls' floor. */
export const w3 = (x: number, y: number, z: number): Vec3 => ({ x, y: W3_Y + y, z });

export interface W3Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The fence's bend points from the bridge's north-east corner to the hall's cut corner (P1), on to z 392. */
export const W3_FENCE_SW: readonly GroundPoint[] = [
  { x: 2487.6, z: 413 },
  { x: 2500, z: 402.25 },
];
/** The hall's cut corner: its wall is the fence (P1). */
export const W3_HALL_CUT: readonly [GroundPoint, GroundPoint] = [
  { x: 2500, z: 402.25 },
  { x: 2509, z: 396 },
];
/** From the cut corner to the south fence along z 392. */
export const W3_FENCE_S0: GroundPoint = { x: 2515, z: 392 };

/**
 * The zone behind the fence (counter-clockwise from the bridge's north-east corner): along the
 * path's fence to the hall's cut corner, the south fence z 392 to x 2606, the east fence, the
 * basin's quay z 452 west to x 2493 (3 m off the slanted bank, P10/P11), round the tower's north
 * face, the quay's north end z 440 and its edge x 2477 down to the bridge's north edge. The
 * pier (`W3_PIER`) stands off the quay, over the water.
 */
export const W3_ZONE: readonly GroundPoint[] = [
  ...W3_FENCE_SW,
  W3_HALL_CUT[1],
  W3_FENCE_S0,
  { x: 2606, z: 392 },
  { x: 2606, z: 452 },
  { x: 2493, z: 452 },
  { x: 2493, z: 446 },
  { x: 2486, z: 446 },
  { x: 2486, z: 440 },
  { x: 2477, z: 440 },
  { x: 2477, z: 418.5 },
];

/** The public strip outside the fence (metro A at (2527; 388), Genzō by his container): left on the NMT (P2). */
export const W3_PUBLIC: W3Rect = { minX: 2476, maxX: 2606, minZ: 380, maxZ: 392 };
/** The hall: rows S and N, the airlocks, the assembly line and the test chamber (stage 2 hollows it). */
export const W3_HALL: W3Rect = { minX: 2500, maxX: 2572, minZ: 396, maxZ: 440 };
/** Row S, the airlocks' strip, row N, the assembly hall and the test chamber. */
export const W3_ROW_S: W3Rect = { minX: 2500, maxX: 2572, minZ: 396, maxZ: 406 };
export const W3_AIRLOCKS: W3Rect = { minX: 2500, maxX: 2510, minZ: 406, maxZ: 430 };
export const W3_ROW_N: W3Rect = { minX: 2500, maxX: 2572, minZ: 430, maxZ: 440 };
export const W3_ASSEMBLY: W3Rect = { minX: 2510, maxX: 2548, minZ: 406, maxZ: 430 };
export const W3_CHAMBER: W3Rect = { minX: 2548, maxX: 2572, minZ: 406, maxZ: 430 };
/** Roofs of the rows and the airlocks, of the assembly hall (its slab on top), of the test chamber. */
export const W3_ROOF = 10.4;
export const W3_HALL_TOP = 16.6;
export const W3_CHAMBER_TOP = 14;
/** The wagon gate in the hall's west wall (closed in stage 1): z 414..422, 7 m high. */
export const W3_GATE = { x: 2500, minZ: 414, maxZ: 422, height: 7 } as const;

/** The control tower on the hall's north-west corner (P10): the pass office on its ground floor. */
export const W3_TOWER: W3Rect = { minX: 2486, maxX: 2496, minZ: 436, maxZ: 446 };
/** The tower's platform: the roof of its lower part, joined to the pipe walk and the bridge onto row N. */
export const W3_PLATFORM = 10;
/** The quay: its strip behind the wall, the wall (from the river's bench up to the floor, P4), the pier (P7). */
export const W3_QUAY: W3Rect = { minX: 2480, maxX: 2487.5, minZ: 418.5, maxZ: 440 };
/**
 * The quay's wall to x 2480, on the terrain's grid line, so its top is the floor wherever the pad's
 * edge still slopes (review round 2); along z to the quay's north fence.
 */
export const W3_QUAY_WALL: W3Rect = { minX: 2477, maxX: 2480, minZ: 418.5, maxZ: 440 };
export const W3_PIER: W3Rect = { minX: 2466, maxX: 2477, minZ: 426, maxZ: 438 };
/** The pipeline over the river (P8) and its service walk on top. */
export const W3_PIPES: W3Rect = { minX: 2442, maxX: 2486, minZ: 442, maxZ: 444 };
/** The pipe walk's trestles: on the west bank (the ladder from the path), in the river, on the east bank. */
export const W3_TRESTLES: readonly number[] = [2444, 2465, 2484];
/** The basin dug off the river (P9): its mouth along the north-west corner, where it meets the river. */
export const W3_BASIN: W3Rect = { minX: 2508, maxX: 2592, minZ: 452, maxZ: 478 };
export const W3_BASIN_MOUTH: W3Rect = { minX: 2506, maxX: 2534, minZ: 464, maxZ: 480 };
/** The pickup yard along the basin and the east yard (parking, the gatehouse). */
export const W3_PICKUP: W3Rect = { minX: 2500, maxX: 2606, minZ: 440, maxZ: 452 };
export const W3_EAST_YARD: W3Rect = { minX: 2572, maxX: 2606, minZ: 392, maxZ: 440 };
/** The river's natural bench under the terrace (P5) and the culvert's mouth at its foot (P6, stage 2). */
export const W3_BENCH: W3Rect = { minX: 2457, maxX: 2466, minZ: 384, maxZ: 412 };
export const W3_CULVERT: W3Rect = { minX: 2466, maxX: 2514, minZ: 399.5, maxZ: 401.5 };
/** The service gate and the vehicle gate in the south fence (z 392). */
export const W3_WICKET = { minX: 2549, maxX: 2551 } as const;
export const W3_VEHICLE_GATE = { minX: 2586, maxX: 2596 } as const;
/** The fence: higher than a jump and a pull-up reach (as the docks' was). */
export const W3_FENCE = 2.7;

/**
 * The zone in rectangles, for the pads and the clearing: bands 2.5 m wide (the terrain's cell)
 * stepping along the path's fence from x 2487.5 to 2515, each from 0.3 m inside the fence (0.9 m
 * from x 2497.5, where the path w972606056 runs nearest, scan's pad-on-road), then
 * the rest of the zone from x 2515. The bands west of x 2492.5 end at the tower's north face
 * (z 446), the rest at the basin's quay (z 452). Exact numbers, so `tools/osm-import` can copy them.
 */
export const W3_ZONE_RECTS: readonly W3Rect[] = [
  { minX: 2487.5, maxX: 2490, minZ: 413.3, maxZ: 446 },
  { minX: 2490, maxX: 2492.5, minZ: 411.2, maxZ: 446 },
  { minX: 2492.5, maxX: 2495, minZ: 409.1, maxZ: 452 },
  { minX: 2495, maxX: 2497.5, minZ: 406.9, maxZ: 452 },
  { minX: 2497.5, maxX: 2500, minZ: 405.3, maxZ: 452 },
  { minX: 2500, maxX: 2502.5, minZ: 403.2, maxZ: 452 },
  { minX: 2502.5, maxX: 2505, minZ: 401.4, maxZ: 452 },
  { minX: 2505, maxX: 2507.5, minZ: 399.7, maxZ: 452 },
  { minX: 2507.5, maxX: 2510, minZ: 398, maxZ: 452 },
  { minX: 2510, maxX: 2512.5, minZ: 396.3, maxZ: 452 },
  { minX: 2512.5, maxX: 2515, minZ: 394.6, maxZ: 452 },
  { minX: 2515, maxX: 2606, minZ: 392.3, maxZ: 452 },
];

/**
 * W-3's own chunk (ADR-0082), as Trasa Podziemna's (ADR-0048): its solids and boxes stream in
 * together whenever the player is near the site, wherever along it she stands; it lies over
 * Nabrzeże's chunks and is last in the table, so the ground and the district there stay theirs.
 */
export const W3_CHUNK = "nabrzeze-w3";
export const W3_BOUNDS: W3Rect = { minX: 2440, maxX: 2606, minZ: 380, maxZ: 480 };

/**
 * The zone's rectangles for clearing the map's buildings and trees (review round 2): drawn back
 * 0.5 m more from the path's fence and the south fence, so the furniture's 2 m clearance
 * (`clearOfGame`) ends about 1.2 m outside them: a tree hugging the fence goes, the trees of the
 * terrace and the strip past it stay, as on main.
 */
const CLEAR_IN = 0.5;
export const W3_CLEAR_RECTS: readonly W3Rect[] = W3_ZONE_RECTS.map((r, i) => ({ ...r, minX: i === 0 ? r.minX + CLEAR_IN : r.minX, minZ: r.minZ + CLEAR_IN }));

/** Is (x, z) inside a polygon (even-odd)? */
export const insidePolygon = (ring: readonly GroundPoint[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as GroundPoint;
    const b = ring[j] as GroundPoint;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

const inRect = (r: W3Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** Is (x, z) behind W-3's fence: in the zone or on the pier? */
export const inW3Zone = (x: number, z: number): boolean => insidePolygon(W3_ZONE, x, z) || inRect(W3_PIER, x, z);
