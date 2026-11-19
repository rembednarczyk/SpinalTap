import { HALL } from "./plan";
import type { Corners, Rectangle } from "./rounded";

/*
 * Alchemia as a gallery round an atrium (ADR-0093 O1, the board's floor plan and its scheme of
 * storeys): a body on the food hall's outline whose every floor is a ring round one atrium open from
 * P0's floor to the sky. Pattern: the shopping mall with a central atrium (galleria): shops in the
 * outer ring, a gallery with a balustrade round the atrium, escalators in pairs in it, two cores
 * (stairs and a lift) in opposite corners. Pure numbers, world metres: `mall.ts` builds the slabs,
 * glass and balustrades on them, `mall-cores.ts` the cores, `escalators.ts` the escalators.
 */

/** The floors: P0 the hall's (T1's level), P1 its old roof (T0's), P2 and P3 on the front's L1 and L2 roofs, the roof on L3's. */
export const MALL_LEVELS = { p0: HALL.floor, p1: HALL.roof, p2: 2.3, p3: 6.5, roof: 10.7 } as const;
const L = MALL_LEVELS;
/** Every floor one walks on, lowest first. */
export const MALL_FLOORS: readonly number[] = [L.p0, L.p1, L.p2, L.p3, L.roof];

/** The body's glass line: the hall's outline. */
export const MALL: Rectangle = { x0: HALL.minX, x1: HALL.maxX, z0: HALL.minZ, z1: HALL.maxZ };
/** The atrium, open from P0's floor to the sky. */
export const ATRIUM: Rectangle = { x0: 411, x1: 425, z0: 40, z1: 50 };
/** The gallery round it on P1..P3: 3 m wide. */
export const GALLERY: Rectangle = { x0: 408, x1: 428, z0: 37, z1: 53 };

/** A slab's thickness and its overhang past the glass on the open sides (the front's storeys' C1). */
export const MALL_SLAB = 0.3;
export const MALL_OVER = 0.3;
/** The slab's corners' radius and the glass's, concentric. */
export const MALL_RADIUS = 2.3;
export const MALL_GLASS_RADIUS = MALL_RADIUS - MALL_OVER;
/**
 * Which corners are rounded (south-east, north-east, north-west, south-west): the south ones are
 * joints with the front's L2 and L3 (19.11), which stand against the body's south face.
 */
export const MALL_CORNERS: Corners = [false, true, true, false];
/** The balustrades round the atrium and the roof, solid. */
export const MALL_RAIL = 1.1;

/** The front's slabs reach the body's south face this far (L2's and L3's overhang): the body's own start past them. */
export const FRONT_OVERHANG = 0.3;

/**
 * The two lanes of the escalators along the atrium's south edge, 1.5 m clear each between their
 * balustrades (a 1.0 m step and its skirts; under 1.46 m an NPC's way, its body 0.38 m and a margin on
 * a 0.5 m raster, does not fit through, `nav-raster.ts`).
 */
export const ESCALATOR_SIDE = 0.05;
export const LANE_A = { z0: ATRIUM.z0, z1: ATRIUM.z0 + 1.5 } as const;
export const LANE_B = { z0: LANE_A.z1 + 2 * ESCALATOR_SIDE, z1: LANE_A.z1 + 2 * ESCALATOR_SIDE + 1.5 } as const;

/** One flight of an escalator: its lane, the floors it joins, where its first tread starts and which way it climbs along x. */
export interface Escalator {
  readonly lane: { readonly z0: number; readonly z1: number };
  readonly from: number;
  readonly to: number;
  readonly x0: number;
  readonly dir: 1 | -1;
  readonly risers: number;
  readonly going: number;
  /** The lowest one stands on P0's floor: solid down to it. */
  readonly solid: boolean;
}

/**
 * The criss-cross ("scissor") escalators: P0 to P1 west in lane A, P1 to P2 east in lane B, P2 to P3
 * west in lane A over the first. Risers 0.175 m, treads 0.30 (0.28 on the longer middle one). The
 * first one's foot is at the atrium's east end, so the hall's ways to its back door (P-1) and its
 * stairs, west of it, stay open on P0.
 */
export const ESCALATORS: readonly Escalator[] = [
  { lane: LANE_A, from: L.p0, to: L.p1, x0: 424.4, dir: -1, risers: 24, going: 0.3, solid: true },
  { lane: LANE_B, from: L.p1, to: L.p2, x0: 417.5, dir: 1, risers: 26, going: 0.28, solid: false },
  { lane: LANE_A, from: L.p2, to: L.p3, x0: 424.5, dir: -1, risers: 24, going: 0.3, solid: false },
];

/** Where a flight's last tread ends: its head's landing starts there. */
export const escalatorHead = (e: Escalator): number => e.x0 + e.dir * (e.risers - 1) * e.going;

/**
 * The landings at the escalators' heads, on the floor they reach: x span and lanes, the side railed
 * over the atrium (P2's opens east onto the gallery).
 */
export const ESCALATOR_LANDINGS: readonly (Rectangle & { readonly y: number; readonly rail: "w" | null })[] = [
  { x0: 415.5, x1: 417.5, z0: LANE_A.z0, z1: LANE_B.z1 + ESCALATOR_SIDE, y: L.p1, rail: "w" },
  { x0: 424.5, x1: ATRIUM.x1, z0: LANE_A.z0, z1: LANE_B.z1 + ESCALATOR_SIDE, y: L.p2, rail: null },
  { x0: 415.6, x1: 417.6, z0: LANE_A.z0, z1: LANE_A.z1 + ESCALATOR_SIDE, y: L.p3, rail: "w" },
];

/**
 * A stair core of flights in two lanes along x ("dog-leg"), its floor landing at the west end, the mid
 * landing at the east. Lanes and doors 1.5 m: an NPC's way needs 1.46 (as the escalators').
 */
export interface StairCore {
  readonly key: string;
  /** Inside its walls. */
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** The floor landing's length; the flights start past it. */
  readonly landing: number;
  readonly floors: readonly number[];
  /** Its doors at every floor: in which wall, from-to along it. */
  readonly door: { readonly side: "n" | "w"; readonly a0: number; readonly a1: number };
  /** Its walls stand from these heights: under them the glass or the stair house below is its wall. */
  readonly walls: { readonly n: number; readonly s: number; readonly e: number; readonly w: number };
}
export const CORE_WALL = 0.2;
/** The stair houses over the roof: this high. */
export const CORE_HOUSE = 2.6;

/**
 * The south-west core: north of the hall's stair house (whose flight from P0 comes up to P1 in it), the
 * lift beside it; its west wall the glass up to the roof.
 */
export const SW_CORE: StairCore = {
  key: "sw",
  x0: HALL.minX + 0.32,
  x1: 407.6,
  z0: 34.8,
  z1: 37.9,
  landing: 1.6,
  floors: [L.p1, L.p2, L.p3, L.roof],
  door: { side: "n", a0: 400.4, a1: 401.9 },
  walls: { n: L.p1, s: L.p1 + 2.6, e: L.p1, w: L.roof },
};
/** The north-east core: kept clear of the rounded corner, its north wall the glass up to the roof. From P1: P0's corner is Oyaji's shop (O3). */
export const NE_CORE: StairCore = {
  key: "ne",
  x0: 427.7,
  x1: 433.5,
  z0: 54.7,
  z1: HALL.maxZ - 0.2,
  landing: 1.2,
  floors: [L.p1, L.p2, L.p3, L.roof],
  door: { side: "w", a0: 55.5, a1: 57.0 },
  walls: { n: L.roof, s: L.p1, e: L.p1, w: L.p1 },
};
export const STAIR_CORES: readonly StairCore[] = [SW_CORE, NE_CORE];

/** A core's stairwell: inside its walls past the floor landing (a hole in every slab over its lowest floor). */
export const stairwell = (c: StairCore): Rectangle => ({ x0: c.x0 + c.landing, x1: c.x1, z0: c.z0, z1: c.z1 });
