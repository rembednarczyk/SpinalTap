import { MALL_GLASS_THICK, MALL_LEVELS, MALL_SLAB } from "./mall-plan";

/*
 * The front's storeys as floors one walks on (ADR-0093 O5): L1's wings on T0, L2 on the gallery's P2,
 * L3 on its P3. Pattern: the shopping arcade (pasaż handlowy) on the storeys of a mall's street front,
 * joined to the gallery round the atrium on the same levels (its floors are the gallery's, its doors in
 * the gallery's south glass), as a mall's street wing is joined to its malls. Pure numbers, world
 * metres: `front-shell.ts` builds the glass, the floors and the doors, `front-shops.ts` the units.
 */

/**
 * The floors. L1's west wing over the terrain's highest paving in it (-1.16 drawn at its south-east
 * corner, the terrain under it -1.24..-2.4), its east wing over its own (-0.90): level floors on the
 * slope, whole risers of the rules (0.15-0.18 m) over the ground at their doors. L2 and L3 lie on the gallery's P2 and P3.
 */
export const FRONT_FLOORS = { l1: -1.152, l1e: -0.8, l2: MALL_LEVELS.p2, l3: MALL_LEVELS.p3 } as const;
export type FrontFloor = keyof typeof FRONT_FLOORS;

/**
 * The undersides over them: L2's slab on its columns (0.35 m thick, over both wings too) for L1, the
 * slabs of L2 and L3 (0.3 m) for L2 and L3.
 */
export const FRONT_CEILINGS: Readonly<Record<FrontFloor, number>> = {
  l1: MALL_LEVELS.p2 - 0.35,
  l1e: MALL_LEVELS.p2 - 0.35,
  l2: MALL_LEVELS.p3 - MALL_SLAB,
  l3: MALL_LEVELS.roof - MALL_SLAB,
};

/** The front's glass now that one walks behind it: as deep as the gallery's (0.2 m, G-275's measure). */
export const FRONT_GLASS = MALL_GLASS_THICK;

/** A door's head over its floor (the gallery's P1 doors', `mall.ts`). */
export const FRONT_DOOR_TOP = 2.3;

/**
 * The doors from the gallery's P2 and P3 into L2 and L3 through its south glass (z 32): 4 m, in the
 * middle of the passage on P2 where TOKYO DRIP stood (x 414.8-421.4) and of the seating strip on P3.
 */
export const GALLERY_FRONT_DOOR = { x0: 417.2, x1: 421.2 } as const;

/**
 * L1's west wing's doors: from the arcade under the house with arcades (in its south glass, z 1; steps
 * down inside from the arcade's podium), from the passage under L2 (in its east glass, x 404; steps up
 * outside) and onto T0's strip before the hall's stair house (in its north glass, z 27.5; a flight down
 * outside). Each in a straight run of its glass, clear of the rounded corners.
 */
export const L1_DOORS = {
  arcade: { x0: 400.4, x1: 402.2 },
  east: { z0: 10.8, z1: 12.3 },
  north: { x0: 400.4, x1: 402.2 },
} as const;
/** L1's east wing's door onto the walk to Lubartowska: its unit's shop door (`front-shops.ts`, KONBINI), in its east glass (x 436). */
export const L1E_DOOR = { z0: 15.95, z1: 17.45 } as const;
/** L3's doors onto L2's terraces: south (in its glass at z 12, by the sign's foot) and east (at x 428). */
export const L3_DOORS = { south: { x0: 409.0, x1: 411.4 }, east: { z0: 23.0, z1: 25.0 } } as const;

/** Outdoor steps by the rules (`docs/zasady-lokacji.md` §6): their going, and the riser they aim at. */
export const STEP_GOING = 0.29;
export const STEP_RISE = 0.17;

/**
 * Where the flights outside L1's doors stand on T0, in plan (the map's furniture keeps clear, as of
 * the front's other footprints): east of the west wing's east door, north of its north door, east of
 * the east wing's door. Their lengths hold the most risers they get (`front-shell.ts`).
 */
export const FRONT_STEPS_FOOTPRINTS: readonly { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }[] = [
  { minX: 404, maxX: 405.0, minZ: L1_DOORS.east.z0 - 0.15, maxZ: L1_DOORS.east.z1 + 0.15 },
  { minX: L1_DOORS.north.x0 - 0.2, maxX: L1_DOORS.north.x1 + 0.2, minZ: 27.5, maxZ: 29.6 },
  { minX: 436, maxX: 436.7, minZ: L1E_DOOR.z0 - 0.1, maxZ: L1E_DOOR.z1 + 0.1 },
];

/**
 * The way from the gallery's green roof onto L3's (ADR-0093 O5): a gap in the roof's balustrade over
 * its south edge (z 32.3) into the south pergola, past its planters and benches (`roof-plan.ts`).
 */
export const L3_ROOF_WAY = { x0: 420.2, x1: 423.2 } as const;
