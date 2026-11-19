import { type Piece, box, piece } from "./plan";
import { TIER_A, TIER_B } from "./tiers";

/** L1's and L2's roofs (as `front.ts`: the tiers' levels). */
const L1_TOP = TIER_A.top;
const L2_TOP = TIER_B.top;

/*
 * The pale house with arcades in the front's axis (C3 of the board 1:1, decision of the user of
 * 19.11: "budynek z arkadami może przejść od frontu"): the board's two-storey house behind the
 * fountain, beside the ramp, with round arches on the ground and windows over them, its roof a
 * terrace on L2's level. It stands over L1's west wing's front, which steps back behind its
 * arcade, and over the way into the passage under L2, which stays open through its arches.
 * Pattern: the arcade (portico) of a market house, the board's and Lublin's own (the Old Town's
 * arcades, the Arkady on Świętoduska): a walk under the upper storey behind a row of piers.
 */

/** The house: its footprint (the west wing's front to the ramp's trench), its arcade's ceiling, its roof. */
export const ARCADE_FRONT = { minX: 394, maxX: 409, minZ: -2, maxZ: 3.7, ceiling: L1_TOP, top: L2_TOP } as const;
/** The arcade: how deep its walk is behind the piers (the west wing's glass stands there), its piers' side and depth. */
export const ARCADE_WALK = 3;
export const ARCADE_PIER = { width: 0.75, depth: 0.8 } as const;
/** Its bays: five round arches between six piers, the board's. */
export const ARCADE_BAYS = 5;
/** The ground under it, as the wings' glass stands in it (`front.ts`). */
const FOOT = -3;
/** The upper storey's roof slab (a masonry house's, thicker than the glass storeys' 0.3 m) and the cornice under it. */
const SLAB = 0.35;
const CORNICE = 0.35;

/** The piers' west edges along the front, from the house's west corner to its east one. */
export const arcadePiers = (): readonly number[] => {
  const A = ARCADE_FRONT;
  const arch = (A.maxX - A.minX - (ARCADE_BAYS + 1) * ARCADE_PIER.width) / ARCADE_BAYS;
  return Array.from({ length: ARCADE_BAYS + 1 }, (_, k) => A.minX + k * (ARCADE_PIER.width + arch));
};

/**
 * The house's pieces: its piers on the ground, its upper storey over the arcade (solid: the
 * arcade's ceiling under it), its roof slab and cornice; the arches, windows and letters are the
 * engine's on its faces.
 */
export const arcadeFrontPieces = (): Piece[] => {
  const A = ARCADE_FRONT;
  const P = ARCADE_PIER;
  return [
    ...arcadePiers().map((x) => piece(box(x, x + P.width, A.minZ, A.minZ + P.depth, FOOT, A.ceiling), "plaster", false)),
    // The upper storey over the arcade, from its ceiling to the roof slab.
    piece(box(A.minX, A.maxX, A.minZ, A.maxZ, A.ceiling, A.top - SLAB), "plaster", false),
    piece(box(A.minX - 0.1, A.maxX + 0.1, A.minZ - 0.1, A.maxZ, A.top - SLAB, A.top), "roof", false),
    piece(box(A.minX - 0.15, A.maxX + 0.15, A.minZ - 0.15, A.minZ, A.top - SLAB - CORNICE, A.top - SLAB), "plaster", false, false),
    // The strip of light along its roof's edge, as every terrace's on the board.
    piece(box(A.minX - 0.12, A.maxX + 0.12, A.minZ - 0.19, A.minZ - 0.15, A.top - SLAB - CORNICE + 0.08, A.top - SLAB - CORNICE + 0.2), "led", false, false),
  ];
};

/** What of the house stands on T0, in plan: its piers (the map's furniture keeps clear of them). */
export const ARCADE_FOOTPRINTS = arcadePiers().map((x) => ({ minX: x, maxX: x + ARCADE_PIER.width, minZ: ARCADE_FRONT.minZ, maxZ: ARCADE_FRONT.minZ + ARCADE_PIER.depth }));
